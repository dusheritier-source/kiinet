import {
  addDoc,
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

import { auth, db, isTransientFirestoreError } from "@/lib/firebase";

async function getRecipientNotificationPreferences(recipientId: string) {
  if (!db) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, "users", recipientId));
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as Record<string, unknown>;
    const settings = (data.settings as Record<string, unknown> | undefined) ?? {};
    return (settings.notificationPreferences as Record<string, unknown> | undefined) ?? null;
  } catch (error) {
    if (isTransientFirestoreError(error)) {
      return null;
    }
    throw error;
  }
}

export interface AppNotification {
  id: string;
  type: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  message: string;
  postId?: string | null;
  readBy?: string[];
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface NotificationDigest {
  total: number;
  unread: number;
  byType: Array<{ type: string; count: number }>;
}

export interface PushDeviceRecord {
  id: string;
  userId: string;
  label: string;
  token: string;
  platform: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

type ListenerCleanup = () => void;

export async function createNotification(input: {
  type: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  message: string;
  postId?: string;
}) {
  if (!db || input.recipientId === input.actorId) {
    return;
  }

  const preferences = await getRecipientNotificationPreferences(input.recipientId);
  const preferenceKeyMap: Record<string, string> = {
    like: "likes",
    comment: "comments",
    follow: "follows",
    message: "messages",
    booking: "messages",
    repost: "reposts",
    report: "reports",
    mention: "comments",
    poll_vote: "comments",
  };
  const preferenceKey = preferenceKeyMap[input.type];
  if (preferenceKey && preferences?.[preferenceKey] === false) {
    return;
  }

  await addDoc(collection(db, "notifications"), {
    ...input,
    postId: input.postId ?? null,
    readBy: [],
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationRead(notificationId: string) {
  if (!auth?.currentUser || !db) {
    return;
  }

  const snapshot = await getDoc(doc(db, "notifications", notificationId));
  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data() as Record<string, unknown>;
  const readBy = Array.isArray(data.readBy) ? (data.readBy as string[]) : [];
  if (readBy.includes(auth.currentUser.uid)) {
    return;
  }

  await setDoc(
    doc(db, "notifications", notificationId),
    {
      readBy: [...readBy, auth.currentUser.uid],
    },
    { merge: true }
  );
}

export function subscribeToNotifications(
  recipientId: string,
  callback: (notifications: AppNotification[]) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const notificationsQuery = query(
    collection(db, "notifications"),
    where("recipientId", "==", recipientId),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            type: String(data.type ?? ""),
            recipientId: String(data.recipientId ?? ""),
            actorId: String(data.actorId ?? ""),
            actorName: String(data.actorName ?? "Kinet User"),
            actorAvatar: String(data.actorAvatar ?? ""),
            message: String(data.message ?? ""),
            postId: data.postId ? String(data.postId) : null,
            readBy: Array.isArray(data.readBy) ? (data.readBy as string[]) : [],
            createdAt:
              (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
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

export function getCurrentNotificationRecipient() {
  return auth?.currentUser?.uid ?? null;
}

export async function getNotificationDigest() {
  const recipientId = auth?.currentUser?.uid;
  if (!db || !recipientId) {
    return { total: 0, unread: 0, byType: [] } satisfies NotificationDigest;
  }

  const snapshot = await getDocs(
    query(
      collection(db, "notifications"),
      where("recipientId", "==", recipientId),
      orderBy("createdAt", "desc"),
      limit(50)
    )
  );

  const counts = new Map<string, number>();
  let unread = 0;

  snapshot.docs.forEach((docSnapshot: { data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    const type = String(data.type ?? "activity");
    counts.set(type, (counts.get(type) ?? 0) + 1);
    const readBy = Array.isArray(data.readBy) ? (data.readBy as string[]) : [];
    if (!readBy.includes(recipientId)) {
      unread += 1;
    }
  });

  return {
    total: snapshot.docs.length,
    unread,
    byType: Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([type, count]) => ({ type, count })),
  } satisfies NotificationDigest;
}

export async function registerPushDevice(input: {
  label: string;
  token: string;
  platform?: string;
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "pushDevices"), {
    userId: auth.currentUser.uid,
    label: input.label.trim(),
    token: input.token.trim(),
    platform: input.platform?.trim() || "web",
    createdAt: serverTimestamp(),
  });
}

export async function getPushDevices() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "pushDevices"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      userId: String(data.userId ?? ""),
      label: String(data.label ?? ""),
      token: String(data.token ?? ""),
      platform: String(data.platform ?? "web"),
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies PushDeviceRecord;
  });
}

export async function sendTestEmailDigest(recipientEmail: string, digest: NotificationDigest) {
  const response = await fetch("/api/notifications/digest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipientEmail,
      digest,
    }),
  });

  if (!response.ok) {
    throw new Error("Email digest request failed.");
  }

  return response.json();
}

export async function sendTestPushAlert(input: {
  token: string;
  title: string;
  body: string;
}) {
  const response = await fetch("/api/notifications/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Push delivery request failed.");
  }

  return response.json();
}
