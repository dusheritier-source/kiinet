import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  writeBatch,
  where,
} from "firebase/firestore";

import { auth, db, isTransientFirestoreError } from "@/lib/firebase";
import { createNotification, markConversationNotificationsRead } from "@/lib/notifications";
import { uploadMessageAttachment } from "@/lib/message-attachments";
import { getUserProfileById, isMutualFollow } from "@/lib/user-profile";

export interface ConversationSummary {
  id: string;
  participantIds: string[];
  participantProfiles: Array<{
    uid: string;
    displayName: string;
    photoURL: string;
  }>;
  lastMessage: string;
  lastSenderId?: string | null;
  unreadBy: string[];
  typingBy: string[];
  mutedBy: string[];
  archivedBy: string[];
  pinnedBy: string[];
  hiddenBy: string[];
  requestStatus: "pending" | "accepted" | "declined";
  requestedBy?: string | null;
  kind: "direct" | "group";
  groupName?: string | null;
  groupPhotoURL?: string | null;
  adminIds: string[];
  createdBy?: string | null;
  leftBy: string[];
  updatedAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  deleted?: boolean;
  readBy: string[];
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
  clientStatus?: "queued" | "pending" | "failed";
  replyTo?: { id: string; senderId: string; text: string } | null;
  reactions: Record<string, string[]>;
  pinnedBy: string[];
  savedBy: string[];
  hiddenFor: string[];
  expiresAt?: { seconds?: number; nanoseconds?: number } | Date | null;
}

type ListenerCleanup = () => void;
const MESSAGE_PAGE_SIZE = 40;

function mapConversationMessage(docSnapshot: { id: string; data: () => Record<string, unknown> }): ConversationMessage {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    conversationId: String(data.conversationId ?? ""),
    senderId: String(data.senderId ?? ""),
    text: String(data.text ?? ""),
    attachmentUrl: data.attachmentUrl ? String(data.attachmentUrl) : null,
    attachmentType: data.attachmentType ? String(data.attachmentType) : null,
    attachmentName: data.attachmentName ? String(data.attachmentName) : null,
    attachmentSize: typeof data.attachmentSize === "number" ? data.attachmentSize : null,
    deleted: Boolean(data.deleted),
    readBy: Array.isArray(data.readBy) ? (data.readBy as string[]) : [],
    createdAt: (data.createdAt as ConversationMessage["createdAt"]) ?? null,
    replyTo: data.replyTo && typeof data.replyTo === "object"
      ? (data.replyTo as ConversationMessage["replyTo"])
      : null,
    reactions: data.reactions && typeof data.reactions === "object"
      ? (data.reactions as Record<string, string[]>)
      : {},
    pinnedBy: Array.isArray(data.pinnedBy) ? (data.pinnedBy as string[]) : [],
    savedBy: Array.isArray(data.savedBy) ? (data.savedBy as string[]) : [],
    hiddenFor: Array.isArray(data.hiddenFor) ? (data.hiddenFor as string[]) : [],
    expiresAt: (data.expiresAt as ConversationMessage["expiresAt"]) ?? null,
  };
}

async function getCurrentUserMiniProfile() {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const user = auth.currentUser;

  try {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnapshot.exists()
      ? (profileSnapshot.data() as Record<string, unknown>)
      : null;

    return {
      uid: user.uid,
      displayName: user.displayName || String(profile?.displayName ?? "Kinet User"),
      photoURL: user.photoURL || String(profile?.photoURL ?? ""),
    };
  } catch (error) {
    if (isTransientFirestoreError(error)) {
      return {
        uid: user.uid,
        displayName: user.displayName || "Kinet User",
        photoURL: user.photoURL || "",
      };
    }
    throw error;
  }
}

function buildConversationKey(ids: string[]) {
  return [...ids].sort().join("__");
}

export async function createOrGetConversation(otherUserId: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const currentUserId = auth.currentUser.uid;
  const participantIds = [currentUserId, otherUserId].sort();
  const key = buildConversationKey(participantIds);

  if (currentUserId === otherUserId) {
    throw new Error("You cannot message yourself.");
  }

  const deterministicConversation = await getDoc(doc(db, "conversations", key));
  if (deterministicConversation.exists()) {
    await setDoc(doc(db, "conversations", key), { hiddenBy: arrayRemove(currentUserId) }, { merge: true });
    return deterministicConversation.id;
  }

  const currentUserProfile = await getCurrentUserMiniProfile();
  const otherUserSnapshot = await getDoc(doc(db, "users", otherUserId));
  const otherUser = otherUserSnapshot.exists()
    ? (otherUserSnapshot.data() as Record<string, unknown>)
    : null;
  const currentUserSnapshot = await getDoc(doc(db, "users", currentUserId));
  const currentUserData = currentUserSnapshot.exists() ? currentUserSnapshot.data() : {};
  const currentBlocked = Array.isArray(currentUserData.blockedUsers) ? currentUserData.blockedUsers as string[] : [];
  const otherBlocked = Array.isArray(otherUser?.blockedUsers) ? otherUser.blockedUsers as string[] : [];
  if (currentBlocked.includes(otherUserId) || otherBlocked.includes(currentUserId)) {
    throw new Error("This conversation is unavailable.");
  }
  const otherSettings = (otherUser?.settings ?? {}) as Record<string, unknown>;
  const messagePrivacy = String(otherSettings.messagePrivacy ?? "everyone");
  const targetFollowers = Array.isArray(otherUser?.followers) ? otherUser.followers as string[] : [];
  if (messagePrivacy === "no_one" || (messagePrivacy === "following" && !targetFollowers.includes(currentUserId))) {
    throw new Error("This user is not accepting messages from you.");
  }

  await setDoc(doc(db, "conversations", key), {
    key,
    participantIds,
    participantProfiles: [
      currentUserProfile,
      {
        uid: otherUserId,
        displayName: String(otherUser?.displayName ?? "Kinet User"),
        photoURL: String(otherUser?.photoURL ?? ""),
      },
    ],
    lastMessage: "",
    lastSenderId: null,
    unreadBy: [],
    typingBy: [],
    mutedBy: [],
    archivedBy: [],
    pinnedBy: [],
    hiddenBy: [],
    requestStatus: "pending",
    requestedBy: currentUserId,
    kind: "direct",
    groupName: null,
    groupPhotoURL: null,
    adminIds: [],
    createdBy: currentUserId,
    leftBy: [],
    updatedAt: serverTimestamp(),
  });

  void createNotification({
    type: "message",
    recipientId: otherUserId,
    actorId: currentUserId,
    actorName: currentUserProfile.displayName,
    actorAvatar: currentUserProfile.photoURL,
    message: `${currentUserProfile.displayName} sent you a message request.`,
    conversationId: key,
  }).catch(() => undefined);

  return key;
}

export async function createGroupConversation(name: string, memberIds: string[]) {
  if (!auth.currentUser || !db) throw new Error("You must be signed in.");
  const currentUserId = auth.currentUser.uid;
  const groupName = name.trim();
  if (groupName.length < 2 || groupName.length > 80) throw new Error("Group name must be 2–80 characters.");
  const participantIds = Array.from(new Set([currentUserId, ...memberIds])).slice(0, 100);
  if (participantIds.length < 3) throw new Error("Choose at least two other people.");

  const profiles = await Promise.all(participantIds.map(async (uid) => {
    const snapshot = await getDoc(doc(db!, "users", uid));
    const data = snapshot.exists() ? snapshot.data() : {};
    return { uid, data, displayName: String(data.displayName ?? "Kinet User"), photoURL: String(data.photoURL ?? "") };
  }));
  const ineligibleMember = profiles.find((profile) => profile.uid !== currentUserId && !isMutualFollow(currentUserId, profile.data));
  if (ineligibleMember) {
    throw new Error("Groups can only include people who follow each other.");
  }
  const participantProfiles = profiles.map(({ data: _data, ...profile }) => profile);
  const conversationRef = doc(collection(db, "conversations"));
  await setDoc(conversationRef, {
    key: conversationRef.id,
    participantIds,
    participantProfiles,
    kind: "group",
    groupName,
    groupPhotoURL: null,
    adminIds: [currentUserId],
    createdBy: currentUserId,
    lastMessage: "Group created",
    lastSenderId: currentUserId,
    unreadBy: [], typingBy: [], mutedBy: [], archivedBy: [], pinnedBy: [], hiddenBy: [], leftBy: [],
    requestStatus: "accepted",
    requestedBy: currentUserId,
    updatedAt: serverTimestamp(),
  });
  const creator = participantProfiles.find((profile) => profile.uid === currentUserId)!;
  memberIds.filter((uid) => uid !== currentUserId).forEach((uid) => {
    void createNotification({
      type: "message",
      recipientId: uid,
      actorId: creator.uid,
      actorName: creator.displayName,
      actorAvatar: creator.photoURL,
      message: `${creator.displayName} added you to ${groupName}.`,
      conversationId: conversationRef.id,
    }).catch(() => undefined);
  });
  return conversationRef.id;
}

export async function leaveGroupConversation(conversationId: string) {
  if (!auth.currentUser || !db) throw new Error("You must be signed in.");
  const snapshot = await getDoc(doc(db, "conversations", conversationId));
  if (!snapshot.exists() || snapshot.data().kind !== "group") throw new Error("Group not found.");
  await setDoc(snapshot.ref, {
    leftBy: arrayUnion(auth.currentUser.uid),
    hiddenBy: arrayUnion(auth.currentUser.uid),
    mutedBy: arrayUnion(auth.currentUser.uid),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function markConversationRead(conversationId: string) {
  if (!auth?.currentUser || !db) {
    return;
  }

  await markConversationNotificationsRead(conversationId);

  const currentUser = auth.currentUser;

  const snapshot = await getDoc(doc(db, "conversations", conversationId));
  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data() as Record<string, unknown>;
  const unreadBy = Array.isArray(data.unreadBy) ? (data.unreadBy as string[]) : [];
  if (!unreadBy.includes(currentUser.uid)) {
    return;
  }

  await setDoc(
    doc(db, "conversations", conversationId),
    {
      unreadBy: unreadBy.filter((uid) => uid !== currentUser.uid),
    },
    { merge: true }
  );
}

export async function setConversationTyping(conversationId: string, isTyping: boolean) {
  if (!auth?.currentUser || !db) {
    return;
  }

  const currentUser = auth.currentUser;

  const snapshot = await getDoc(doc(db, "conversations", conversationId));
  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data() as Record<string, unknown>;
  const typingBy = Array.isArray(data.typingBy) ? (data.typingBy as string[]) : [];
  const nextTypingBy = isTyping
    ? Array.from(new Set([...typingBy, currentUser.uid]))
    : typingBy.filter((uid) => uid !== currentUser.uid);

  await setDoc(
    doc(db, "conversations", conversationId),
    { typingBy: nextTypingBy },
    { merge: true }
  );
}

export async function sendConversationMessage(
  conversationId: string,
  text: string,
  attachmentFile?: File | null,
  messageId?: string,
  onUploadProgress?: (progress: number) => void,
  replyTo?: ConversationMessage["replyTo"],
  options?: { expiresInSeconds?: number | null; notificationType?: "story_reply"; storyId?: string }
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const trimmedText = text.trim();
  if (!trimmedText && !attachmentFile) {
    return;
  }
  const linkCount = (trimmedText.match(/https?:\/\//gi) ?? []).length;
  if (linkCount > 5 || /(.)\1{24,}/.test(trimmedText)) {
    throw new Error("This message looks like spam. Edit it before sending.");
  }
  const sender = await getCurrentUserMiniProfile();
  const conversationSnapshot = await getDoc(doc(db, "conversations", conversationId));
  const conversation = conversationSnapshot.exists()
    ? (conversationSnapshot.data() as Record<string, unknown>)
    : null;
  const participantIds = Array.isArray(conversation?.participantIds)
    ? (conversation?.participantIds as string[])
    : [];
  const recipientIds = participantIds.filter((id) => id !== sender.uid);
  const leftBy = Array.isArray(conversation?.leftBy) ? conversation.leftBy as string[] : [];
  const activeRecipientIds = recipientIds.filter((uid) => !leftBy.includes(uid));
  const recipientId = recipientIds[0];
  const mutedBy = Array.isArray(conversation?.mutedBy) ? (conversation.mutedBy as string[]) : [];
  const requestStatus = String(conversation?.requestStatus ?? "accepted");
  const requestedBy = String(conversation?.requestedBy ?? sender.uid);

  if (!conversation || !participantIds.includes(sender.uid) || !recipientId) {
    throw new Error("This conversation is unavailable.");
  }
  if (conversation.kind !== "group") {
    const [senderProfileSnapshot, recipientProfileSnapshot] = await Promise.all([
      getDoc(doc(db, "users", sender.uid)),
      getDoc(doc(db, "users", recipientId)),
    ]);
    const senderBlocked = senderProfileSnapshot.exists() && Array.isArray(senderProfileSnapshot.data().blockedUsers)
      ? senderProfileSnapshot.data().blockedUsers as string[] : [];
    const recipientBlocked = recipientProfileSnapshot.exists() && Array.isArray(recipientProfileSnapshot.data().blockedUsers)
      ? recipientProfileSnapshot.data().blockedUsers as string[] : [];
    if (senderBlocked.includes(recipientId) || recipientBlocked.includes(sender.uid)) {
      throw new Error("Messaging is unavailable because one of you has blocked the other.");
    }
  }
  if (requestStatus === "declined" || (requestStatus === "pending" && requestedBy !== sender.uid)) {
    throw new Error("Accept this message request before replying.");
  }

  if (typeof window !== "undefined") {
    const rateKey = `kinet:message-rate:${sender.uid}`;
    const now = Date.now();
    const recent = (JSON.parse(localStorage.getItem(rateKey) || "[]") as number[]).filter((time) => now - time < 10000);
    if (recent.length >= 5) throw new Error("You are sending too quickly. Wait a moment and try again.");
    localStorage.setItem(rateKey, JSON.stringify([...recent, now]));
  }

  const messageRef = messageId ? doc(db, "messages", messageId) : doc(collection(db, "messages"));
  const conversationRef = doc(db, "conversations", conversationId);
  const uploadedAttachment = attachmentFile
    ? await uploadMessageAttachment(conversationId, attachmentFile, onUploadProgress)
    : null;
  const batch = writeBatch(db);
  batch.set(messageRef, {
    conversationId,
    senderId: sender.uid,
    text: trimmedText,
    attachmentUrl: uploadedAttachment?.url ?? null,
    attachmentType: uploadedAttachment?.type ?? null,
    attachmentName: uploadedAttachment?.name ?? null,
    attachmentSize: uploadedAttachment?.size ?? null,
    replyTo: replyTo ?? null,
    reactions: {},
    pinnedBy: [],
    savedBy: [],
    hiddenFor: [],
    expiresAt: options?.expiresInSeconds ? new Date(Date.now() + options.expiresInSeconds * 1000) : null,
    readBy: [sender.uid],
    createdAt: serverTimestamp(),
  });
  batch.set(
    conversationRef,
    {
      lastMessage: trimmedText || (uploadedAttachment?.type.startsWith("image/") ? "Sent a photo" : uploadedAttachment?.type.startsWith("audio/") ? "Sent a voice note" : "Sent an attachment"),
      lastSenderId: sender.uid,
      unreadBy: activeRecipientIds.length ? arrayUnion(...activeRecipientIds) : [],
      hiddenBy: activeRecipientIds.length ? arrayRemove(...activeRecipientIds) : [],
      typingBy: [],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

  activeRecipientIds.filter((uid) => !mutedBy.includes(uid)).forEach((notificationRecipientId) => {
    // Notification delivery should never make an already-sent message look failed.
    void createNotification({
      type: options?.notificationType ?? (replyTo ? "message_reply" : conversation.kind === "group" ? "group_message" : "message"),
      recipientId: notificationRecipientId,
      actorId: sender.uid,
      actorName: sender.displayName,
      actorAvatar: sender.photoURL,
      message: options?.notificationType === "story_reply" ? `${sender.displayName} replied to your story.` : replyTo ? `${sender.displayName} replied to a message.` : trimmedText ? `${sender.displayName}: ${trimmedText.slice(0, 120)}` : `${sender.displayName} sent an attachment.`,
      conversationId,
      messageId: messageRef.id,
      storyId: options?.storyId,
    }).catch(() => undefined);
  });

  return messageRef.id;
}

export async function updateConversationState(
  conversationId: string,
  field: "mutedBy" | "archivedBy" | "pinnedBy" | "hiddenBy",
  enabled: boolean
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const currentUser = auth.currentUser;

  const snapshot = await getDoc(doc(db, "conversations", conversationId));
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
  const current = Array.isArray(data?.[field]) ? (data?.[field] as string[]) : [];
  const nextValues = enabled
    ? Array.from(new Set([...current, currentUser.uid]))
    : current.filter((uid) => uid !== currentUser.uid);

  await setDoc(doc(db, "conversations", conversationId), { [field]: nextValues }, { merge: true });
}

export async function markConversationUnread(conversationId: string) {
  if (!auth.currentUser || !db) throw new Error("You must be signed in.");
  await setDoc(doc(db, "conversations", conversationId), { unreadBy: arrayUnion(auth.currentUser.uid) }, { merge: true });
}

export async function respondToMessageRequest(conversationId: string, accept: boolean) {
  if (!auth.currentUser || !db) throw new Error("You must be signed in.");
  await setDoc(doc(db, "conversations", conversationId), {
    requestStatus: accept ? "accepted" : "declined",
    ...(accept ? {} : { hiddenBy: arrayUnion(auth.currentUser.uid) }),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateConversationMessage(messageId: string, text: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "messages", messageId),
    {
      text: text.trim(),
      editedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteConversationMessage(messageId: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "messages", messageId),
    {
      text: "Message deleted",
      attachmentUrl: null,
      attachmentType: null,
      attachmentName: null,
      attachmentSize: null,
      deleted: true,
      deletedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function mapConversationSummaries(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): ConversationSummary[] {
  return docs
    .map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        participantIds: Array.isArray(data.participantIds) ? data.participantIds as string[] : [],
        participantProfiles: Array.isArray(data.participantProfiles) ? data.participantProfiles as ConversationSummary["participantProfiles"] : [],
        lastMessage: String(data.lastMessage ?? ""),
        lastSenderId: data.lastSenderId ? String(data.lastSenderId) : null,
        unreadBy: Array.isArray(data.unreadBy) ? data.unreadBy as string[] : [],
        typingBy: Array.isArray(data.typingBy) ? data.typingBy as string[] : [],
        mutedBy: Array.isArray(data.mutedBy) ? data.mutedBy as string[] : [],
        archivedBy: Array.isArray(data.archivedBy) ? data.archivedBy as string[] : [],
        pinnedBy: Array.isArray(data.pinnedBy) ? data.pinnedBy as string[] : [],
        hiddenBy: Array.isArray(data.hiddenBy) ? data.hiddenBy as string[] : [],
        requestStatus: data.requestStatus === "pending" || data.requestStatus === "declined" ? data.requestStatus : "accepted",
        requestedBy: data.requestedBy ? String(data.requestedBy) : null,
        kind: data.kind === "group" ? "group" : "direct",
        groupName: data.groupName ? String(data.groupName) : null,
        groupPhotoURL: data.groupPhotoURL ? String(data.groupPhotoURL) : null,
        adminIds: Array.isArray(data.adminIds) ? data.adminIds as string[] : [],
        createdBy: data.createdBy ? String(data.createdBy) : null,
        leftBy: Array.isArray(data.leftBy) ? data.leftBy as string[] : [],
        updatedAt: data.updatedAt as ConversationSummary["updatedAt"],
      } satisfies ConversationSummary;
    })
    .sort((first, second) => (second.updatedAt?.seconds ?? 0) - (first.updatedAt?.seconds ?? 0));
}

export async function getConversationsOnce(userId: string): Promise<ConversationSummary[]> {
  const firebaseApp = (await import("@/lib/firebase")).default;
  if (!firebaseApp) return [];
  const firestoreLite = await import("firebase/firestore/lite");
  const liteDb = firestoreLite.getFirestore(firebaseApp);
  const conversationsQuery = firestoreLite.query(
    firestoreLite.collection(liteDb, "conversations"),
    firestoreLite.where("participantIds", "array-contains", userId),
    firestoreLite.limit(30)
  );
  const snapshot = await firestoreLite.getDocs(conversationsQuery);
  return mapConversationSummaries(snapshot.docs);
}

export function subscribeToConversations(
  userId: string,
  callback: (conversations: ConversationSummary[]) => void,
  onError?: (error: Error) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const conversationsQuery = query(
    collection(db, "conversations"),
    where("participantIds", "array-contains", userId),
    limit(30)
  );

  let active = true;
  let snapshotVersion = 0;
  const unsubscribe = onSnapshot(
    conversationsQuery,
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      const version = ++snapshotVersion;
      const sorted = mapConversationSummaries(snapshot.docs);
      const mapped = sorted;

      // Stored participant profiles are enough to paint the inbox immediately.
      // Fresh profile lookups should never block navigation or the first render.
      callback(sorted);

      const participantIds = Array.from(new Set(mapped.flatMap((conversation) => conversation.participantIds)));
      void Promise.all(participantIds.map(async (uid) => {
        const profile = await getUserProfileById(uid).catch(() => null);
        return [uid, profile] as const;
      })).then((profiles) => {
        if (!active || version !== snapshotVersion) return;
        const resolvedProfiles = new Map<string, Record<string, unknown>>();
        profiles.forEach(([uid, profile]) => {
          if (profile) resolvedProfiles.set(uid, profile as Record<string, unknown>);
        });
        callback(sorted.map((conversation) => ({
          ...conversation,
          participantProfiles: conversation.participantIds.map((uid) => {
            const stored = conversation.participantProfiles.find((profile) => profile.uid === uid);
            const current = resolvedProfiles.get(uid);
            return {
              uid,
              displayName: String(current?.displayName ?? stored?.displayName ?? "Kinet User"),
              photoURL: String(current?.photoURL ?? stored?.photoURL ?? ""),
            };
          }),
        })));
      });
    },
    (error) => {
      onError?.(error instanceof Error ? error : new Error("Unable to load conversations."));
    }
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

export function subscribeToConversationMessages(
  conversationId: string,
  callback: (messages: ConversationMessage[], hasOlder: boolean) => void,
  onError?: (error: Error) => void
): ListenerCleanup {
  if (!db) {
    callback([], false);
    return () => undefined;
  }

  const firestore = db;

  const messagesQuery = query(
    collection(firestore, "messages"),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "desc"),
    limit(MESSAGE_PAGE_SIZE)
  );

  return onSnapshot(
    messagesQuery,
    async (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      const nextMessages = snapshot.docs
        .map(mapConversationMessage)
        .sort((first, second) => (first.createdAt?.seconds ?? 0) - (second.createdAt?.seconds ?? 0));

      callback(nextMessages, snapshot.docs.length === MESSAGE_PAGE_SIZE);

      if (auth?.currentUser) {
        const currentUser = auth.currentUser;
        await Promise.all(
          nextMessages
            .filter(
              (message) =>
                message.senderId !== currentUser.uid &&
                !message.readBy.includes(currentUser.uid)
            )
            .map((message) =>
              setDoc(
                doc(firestore, "messages", message.id),
                { readBy: [...message.readBy, currentUser.uid] },
                { merge: true }
              )
            )
        );
      }
    },
    (subscriptionError) => {
      callback([], false);
      onError?.(subscriptionError);
    }
  );
}

export async function toggleConversationMessageReaction(messageId: string, emoji: string) {
  if (!db || !auth.currentUser) throw new Error("You must be signed in.");
  const firestore = db;
  const userId = auth.currentUser.uid;
  const result = await runTransaction(firestore, async (transaction) => {
    const messageRef = doc(firestore, "messages", messageId);
    const snapshot = await transaction.get(messageRef);
    if (!snapshot.exists()) throw new Error("Message not found.");
    const current = (snapshot.data().reactions ?? {}) as Record<string, string[]>;
    const users = Array.isArray(current[emoji]) ? current[emoji] : [];
    const nextUsers = users.includes(userId) ? users.filter((uid) => uid !== userId) : [...users, userId];
    transaction.update(messageRef, { reactions: { ...current, [emoji]: nextUsers } });
    return { added: !users.includes(userId), senderId: String(snapshot.data().senderId ?? ""), conversationId: String(snapshot.data().conversationId ?? "") };
  });
  if (result.added && result.senderId && result.senderId !== userId) {
    await createNotification({ type: "message_reaction", recipientId: result.senderId, actorId: userId, actorName: auth.currentUser.displayName || "Someone", actorAvatar: auth.currentUser.photoURL || "", message: `${auth.currentUser.displayName || "Someone"} reacted ${emoji} to your message.`, conversationId: result.conversationId, messageId });
  }
}

export async function toggleConversationMessageFlag(
  messageId: string,
  field: "pinnedBy" | "savedBy" | "hiddenFor"
) {
  if (!db || !auth.currentUser) throw new Error("You must be signed in.");
  const firestore = db;
  const userId = auth.currentUser.uid;
  await runTransaction(firestore, async (transaction) => {
    const messageRef = doc(firestore, "messages", messageId);
    const snapshot = await transaction.get(messageRef);
    if (!snapshot.exists()) throw new Error("Message not found.");
    const current = Array.isArray(snapshot.data()[field]) ? (snapshot.data()[field] as string[]) : [];
    transaction.update(messageRef, {
      [field]: current.includes(userId) ? current.filter((uid) => uid !== userId) : [...current, userId],
    });
  });
}

export async function getOlderConversationMessages(
  conversationId: string,
  before: NonNullable<ConversationMessage["createdAt"]>
) {
  if (!db || !auth.currentUser) throw new Error("You must be signed in.");

  const snapshot = await getDocs(
    query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "desc"),
      startAfter(before),
      limit(MESSAGE_PAGE_SIZE)
    )
  );

  return {
    messages: snapshot.docs.map(mapConversationMessage).reverse(),
    hasOlder: snapshot.docs.length === MESSAGE_PAGE_SIZE,
  };
}

export async function getConversationMessage(messageId: string) {
  if (!db || !auth.currentUser) throw new Error("You must be signed in.");
  const snapshot = await getDoc(doc(db, "messages", messageId));
  return snapshot.exists() ? mapConversationMessage(snapshot) : null;
}
