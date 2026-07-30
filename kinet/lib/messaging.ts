import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db, isTransientFirestoreError } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";

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
  updatedAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  deleted?: boolean;
  readBy: string[];
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

type ListenerCleanup = () => void;

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

  const snapshot = await getDocs(
    query(collection(db, "conversations"), where("key", "==", key), limit(1))
  );
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  const currentUserProfile = await getCurrentUserMiniProfile();
  const otherUserSnapshot = await getDoc(doc(db, "users", otherUserId));
  const otherUser = otherUserSnapshot.exists()
    ? (otherUserSnapshot.data() as Record<string, unknown>)
    : null;

  const created = await addDoc(collection(db, "conversations"), {
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
    updatedAt: serverTimestamp(),
  });

  return created.id;
}

export async function markConversationRead(conversationId: string) {
  if (!auth?.currentUser || !db) {
    return;
  }

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
  attachmentFile?: File | null
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const trimmedText = text.trim();
  if (!trimmedText && !attachmentFile) {
    return;
  }

  const sender = await getCurrentUserMiniProfile();
  const conversationSnapshot = await getDoc(doc(db, "conversations", conversationId));
  const conversation = conversationSnapshot.exists()
    ? (conversationSnapshot.data() as Record<string, unknown>)
    : null;
  const participantIds = Array.isArray(conversation?.participantIds)
    ? (conversation?.participantIds as string[])
    : [];
  const recipientId = participantIds.find((id) => id !== sender.uid);

  let attachmentUrl = "";
  let attachmentType = "";

  if (attachmentFile) {
    const uploadedAttachment = await uploadToFirebaseStorage(
      attachmentFile,
      `Kinet/messages/${conversationId}`
    );
    attachmentUrl = uploadedAttachment.url;
    attachmentType = attachmentFile.type || "file";
  }

  await addDoc(collection(db, "messages"), {
    conversationId,
    senderId: sender.uid,
    text: trimmedText,
    attachmentUrl: attachmentUrl || null,
    attachmentType: attachmentType || null,
    readBy: [sender.uid],
    createdAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "conversations", conversationId),
    {
      lastMessage: trimmedText || "Sent an attachment",
      lastSenderId: sender.uid,
      unreadBy: recipientId ? arrayUnion(recipientId) : [],
      typingBy: [],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (recipientId) {
    await createNotification({
      type: "message",
      recipientId,
      actorId: sender.uid,
      actorName: sender.displayName,
      actorAvatar: sender.photoURL,
      message: `${sender.displayName} sent you a message.`,
    });
  }
}

export async function updateConversationState(
  conversationId: string,
  field: "mutedBy" | "archivedBy",
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
      deleted: true,
      deletedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeToConversations(
  userId: string,
  callback: (conversations: ConversationSummary[]) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const conversationsQuery = query(
    collection(db, "conversations"),
    where("participantIds", "array-contains", userId),
    orderBy("updatedAt", "desc"),
    limit(30)
  );

  return onSnapshot(
    conversationsQuery,
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            participantIds: Array.isArray(data.participantIds) ? (data.participantIds as string[]) : [],
            participantProfiles: Array.isArray(data.participantProfiles)
              ? (data.participantProfiles as ConversationSummary["participantProfiles"])
              : [],
            lastMessage: String(data.lastMessage ?? ""),
            lastSenderId: data.lastSenderId ? String(data.lastSenderId) : null,
            unreadBy: Array.isArray(data.unreadBy) ? (data.unreadBy as string[]) : [],
            typingBy: Array.isArray(data.typingBy) ? (data.typingBy as string[]) : [],
            mutedBy: Array.isArray(data.mutedBy) ? (data.mutedBy as string[]) : [],
            archivedBy: Array.isArray(data.archivedBy) ? (data.archivedBy as string[]) : [],
            updatedAt:
              (data.updatedAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
              null,
          };
        })
      );
    },
    () => {
      callback([]);
    }
  );
}

export function subscribeToConversationMessages(
  conversationId: string,
  callback: (messages: ConversationMessage[]) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const firestore = db;

  const messagesQuery = query(
    collection(firestore, "messages"),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "asc"),
    limit(100)
  );

  return onSnapshot(
    messagesQuery,
    async (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      const nextMessages = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          conversationId: String(data.conversationId ?? ""),
          senderId: String(data.senderId ?? ""),
          text: String(data.text ?? ""),
          attachmentUrl: data.attachmentUrl ? String(data.attachmentUrl) : null,
          attachmentType: data.attachmentType ? String(data.attachmentType) : null,
          deleted: Boolean(data.deleted),
          readBy: Array.isArray(data.readBy) ? (data.readBy as string[]) : [],
          createdAt:
            (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
            null,
        };
      });

      callback(nextMessages);

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
    () => {
      callback([]);
    }
  );
}
