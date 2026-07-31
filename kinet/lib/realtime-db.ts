import { auth, rtdb } from "@/lib/firebase";
import {
  onValue,
  push,
  ref,
  remove,
  set,
  update,
  onDisconnect,
  serverTimestamp,
  type DatabaseReference,
  type DataSnapshot,
} from "firebase/database";

// ==================== TYPES ====================

export interface RTDBMessage {
  conversationId: string;
  senderId: string;
  text: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  deleted?: boolean;
  readBy: string[];
  createdAt?: number;
}

export interface TypingStatus {
  isTyping: boolean;
  timestamp: number;
}

export interface UserPresence {
  status: "online" | "offline";
  lastSeen: number;
}

export interface LikeStatus {
  liked: boolean;
  timestamp: number;
}

export interface CommentReaction {
  emoji: string;
  userId: string;
  timestamp: number;
}

// ==================== MESSAGES ====================

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Record<string, RTDBMessage>) => void
): (() => void) | null {
  if (!rtdb) {
    callback({});
    return null;
  }

  const messagesRef = ref(rtdb, `messages/${conversationId}`);

  return onValue(
    messagesRef,
    (snapshot: DataSnapshot) => {
      const messages = snapshot.val() as Record<string, RTDBMessage> | null;
      callback(messages ?? {});
    },
    () => {
      callback({});
    }
  );
}

export async function sendRTDBMessage(
  conversationId: string,
  text: string,
  attachmentUrl?: string | null,
  attachmentType?: string | null
): Promise<string | null> {
  if (!auth?.currentUser || !rtdb) {
    return null;
  }

  const messageRef = push(ref(rtdb, `messages/${conversationId}`));
  const messageId = messageRef.key;

  if (!messageId) {
    return null;
  }

  const messageData: RTDBMessage = {
    conversationId,
    senderId: auth.currentUser.uid,
    text: text.trim(),
    attachmentUrl: attachmentUrl || null,
    attachmentType: attachmentType || null,
    deleted: false,
    readBy: [auth.currentUser.uid],
    createdAt: Date.now(),
  };

  await set(messageRef, messageData);
  return messageId;
}

export async function deleteRTDBMessage(conversationId: string, messageId: string): Promise<void> {
  if (!rtdb) {
    return;
  }

  await update(ref(rtdb, `messages/${conversationId}/${messageId}`), {
    deleted: true,
    text: "Message deleted",
    attachmentUrl: null,
    attachmentType: null,
  });
}

export async function markRTDBMessagesAsRead(
  conversationId: string,
  messageIds: string[]
): Promise<void> {
  if (!auth?.currentUser || !rtdb || messageIds.length === 0) {
    return;
  }

  const updates: Record<string, boolean> = {};
  messageIds.forEach((messageId) => {
    updates[`messages/${conversationId}/${messageId}/readBy/${auth.currentUser!.uid}`] = true;
  });

  await update(ref(rtdb), updates);
}

// ==================== TYPING INDICATORS ====================

export function subscribeToTypingStatus(
  conversationId: string,
  callback: (typingUsers: Record<string, TypingStatus>) => void
): (() => void) | null {
  if (!rtdb) {
    callback({});
    return null;
  }

  const typingRef = ref(rtdb, `typing/${conversationId}`);

  return onValue(
    typingRef,
    (snapshot: DataSnapshot) => {
      const typing = snapshot.val() as Record<string, TypingStatus> | null;
      callback(typing ?? {});
    },
    () => {
      callback({});
    }
  );
}

export async function setTypingStatus(conversationId: string, isTyping: boolean): Promise<void> {
  if (!auth?.currentUser || !rtdb) {
    return;
  }

  const currentUser = auth.currentUser;
  const typingRef = ref(rtdb, `typing/${conversationId}/${currentUser.uid}`);

  if (isTyping) {
    await set(typingRef, {
      isTyping: true,
      timestamp: Date.now(),
    });

  // Auto-clear typing status after 3 seconds
    setTimeout(async () => {
      const currentStatus = await new Promise<{ isTyping: boolean } | null>((resolve) => {
        onValue(typingRef, (snapshot) => {
          resolve(snapshot.val());
        }, { onlyOnce: true });
      });

      if (currentStatus?.isTyping) {
        await set(typingRef, {
          isTyping: false,
          timestamp: Date.now(),
        });
      }
    }, 3000);
  } else {
    await set(typingRef, {
      isTyping: false,
      timestamp: Date.now(),
    });
  }
}

// ==================== USER PRESENCE ====================

export function setupPresenceListener(
  userId: string,
  callback: (presence: UserPresence | null) => void
): (() => void) | null {
  if (!rtdb) {
    callback(null);
    return null;
  }

  const presenceRef = ref(rtdb, `presence/${userId}`);

  return onValue(
    presenceRef,
    (snapshot: DataSnapshot) => {
      const presence = snapshot.val() as UserPresence | null;
      callback(presence);
    },
    () => {
      callback(null);
    }
  );
}

export async function setUserOnline(): Promise<void> {
  if (!auth?.currentUser || !rtdb) {
    return;
  }

  const userId = auth.currentUser.uid;
  const presenceRef = ref(rtdb, `presence/${userId}`);

  // Set status to online
  await set(presenceRef, {
    status: "online",
    lastSeen: Date.now(),
  });

  // Set up disconnect handler to mark user as offline
  await onDisconnect(presenceRef).set({
    status: "offline",
    lastSeen: Date.now(),
  });
}

export async function setUserOffline(): Promise<void> {
  if (!auth?.currentUser || !rtdb) {
    return;
  }

  const userId = auth.currentUser.uid;
  const presenceRef = ref(rtdb, `presence/${userId}`);
  await set(presenceRef, {
    status: "offline",
    lastSeen: Date.now(),
  });
}

// ==================== LIKES ====================

export function subscribeToPostLikes(
  postId: string,
  callback: (likes: Record<string, LikeStatus>) => void
): (() => void) | null {
  if (!rtdb) {
    callback({});
    return null;
  }

  const likesRef = ref(rtdb, `likes/${postId}`);

  return onValue(
    likesRef,
    (snapshot: DataSnapshot) => {
      const likes = snapshot.val() as Record<string, LikeStatus> | null;
      callback(likes ?? {});
    },
    () => {
      callback({});
    }
  );
}

export async function togglePostLike(postId: string, userId: string, liked: boolean): Promise<void> {
  if (!rtdb) {
    return;
  }

  const likeRef = ref(rtdb, `likes/${postId}/${userId}`);

  if (liked) {
    await set(likeRef, {
      liked: true,
      timestamp: Date.now(),
    });
  } else {
    await remove(likeRef);
  }
}

export async function getPostLikesCount(postId: string): Promise<number> {
  if (!rtdb) {
    return 0;
  }

  const likesRef = ref(rtdb, `likes/${postId}`);
  return new Promise((resolve) => {
    onValue(
      likesRef,
      (snapshot: DataSnapshot) => {
        const likes = snapshot.val() as Record<string, LikeStatus> | null;
        const count = likes ? Object.keys(likes).length : 0;
        resolve(count);
      },
      () => {
        resolve(0);
      },
      { onlyOnce: true }
    );
  });
}

export async function hasUserLikedPost(postId: string, userId: string): Promise<boolean> {
  if (!rtdb) {
    return false;
  }

  const likeRef = ref(rtdb, `likes/${postId}/${userId}`);
  return new Promise((resolve) => {
    onValue(
      likeRef,
      (snapshot: DataSnapshot) => {
        resolve(snapshot.exists());
      },
      () => {
        resolve(false);
      },
      { onlyOnce: true }
    );
  });
}

// ==================== COMMENTS REACTIONS ====================

export function subscribeToCommentReactions(
  commentId: string,
  callback: (reactions: Record<string, Record<string, CommentReaction>>) => void
): (() => void) | null {
  if (!rtdb) {
    callback({});
    return null;
  }

  const reactionsRef = ref(rtdb, `reactions/${commentId}`);

  return onValue(
    reactionsRef,
    (snapshot: DataSnapshot) => {
      const reactions = snapshot.val() as Record<string, Record<string, CommentReaction>> | null;
      callback(reactions ?? {});
    },
    () => {
      callback({});
    }
  );
}

export async function toggleCommentReaction(
  commentId: string,
  emoji: string,
  userId: string
): Promise<void> {
  if (!auth?.currentUser || !rtdb) {
    return;
  }

  const reactionRef = ref(rtdb, `reactions/${commentId}/${emoji}/${userId}`);

  const snapshot = await new Promise<DataSnapshot>((resolve) => {
    onValue(reactionRef, resolve, { onlyOnce: true });
  });

  if (snapshot.exists()) {
    await remove(reactionRef);
  } else {
    await set(reactionRef, {
      emoji,
      userId,
      timestamp: Date.now(),
    });
  }
}

// ==================== NOTIFICATIONS ====================

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Record<string, unknown>) => void
): (() => void) | null {
  if (!rtdb) {
    callback({});
    return null;
  }

  const notificationsRef = ref(rtdb, `notifications/${userId}`);

  return onValue(
    notificationsRef,
    (snapshot: DataSnapshot) => {
      const notifications = snapshot.val() as Record<string, unknown> | null;
      callback(notifications ?? {});
    },
    () => {
      callback({});
    }
  );
}

export async function sendNotification(
  userId: string,
  type: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!auth?.currentUser || !rtdb) {
    return;
  }

  const currentUser = auth.currentUser;
  const notificationRef = push(ref(rtdb, `notifications/${userId}`));

  await set(notificationRef, {
    type,
    message,
    actorId: currentUser.uid,
    read: false,
    createdAt: Date.now(),
    ...data,
  });
}

export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  if (!rtdb) {
    return;
  }

  await update(ref(rtdb, `notifications/${userId}/${notificationId}`), {
    read: true,
  });
}

// ==================== UTILITY FUNCTIONS ====================

export function getRTDBRef(path: string): DatabaseReference | null {
  if (!rtdb) {
    return null;
  }
  return ref(rtdb, path);
}

export async function getRTDBValue(path: string): Promise<unknown> {
  if (!rtdb) {
    return null;
  }

  const dbRef = ref(rtdb, path);
  return new Promise((resolve) => {
    onValue(
      dbRef,
      (snapshot: DataSnapshot) => {
        resolve(snapshot.val());
      },
      () => {
        resolve(null);
      },
      { onlyOnce: true }
    );
  });
}

export async function setRTDBValue(path: string, value: unknown): Promise<void> {
  if (!rtdb) {
    return;
  }

  const dbRef = ref(rtdb, path);
  await set(dbRef, value);
}

export async function updateRTDBValue(path: string, updates: Record<string, unknown>): Promise<void> {
  if (!rtdb) {
    return;
  }

  const dbRef = ref(rtdb, path);
  await update(dbRef, updates);
}

export async function deleteRTDBValue(path: string): Promise<void> {
  if (!rtdb) {
    return;
  }

  const dbRef = ref(rtdb, path);
  await remove(dbRef);
}