import {
  addDoc,
  deleteDoc,
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
  writeBatch,
  where,
} from "firebase/firestore";

import { auth, db, isTransientFirestoreError } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

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
    return {
      preferences: (settings.notificationPreferences as Record<string, unknown> | undefined) ?? {},
      audience: String(settings.notificationAudience ?? "everyone"),
      following: Array.isArray(data.following) ? data.following as string[] : [],
      blockedUsers: Array.isArray(data.blockedUsers) ? data.blockedUsers as string[] : [],
      channels: (settings.notificationChannels as Record<string, unknown> | undefined) ?? { inApp: true, push: true, email: false },
      quietHours: (settings.quietHours as Record<string, unknown> | undefined) ?? { enabled: false, start: "22:00", end: "07:00" },
      preview: String(settings.notificationPreview ?? "full"),
      sound: settings.notificationSound !== false,
      vibration: settings.notificationVibration !== false,
    };
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
  commentId?: string | null;
  conversationId?: string | null;
  storyId?: string | null;
  messageId?: string | null;
  targetUrl?: string | null;
  thumbnailUrl?: string | null;
  readBy?: string[];
  priority?: "low" | "normal" | "high" | "critical";
  deliverAfter?: { seconds?: number; nanoseconds?: number } | null;
  expiresAt?: { seconds?: number; nanoseconds?: number } | null;
  deliveryStatus?: "queued" | "delivered" | "opened" | "failed";
  deliveryAttempts?: number;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface NotificationDigest {
  total: number;
  unread: number;
  important: number;
  summary: string;
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
const recentDeliveries = new Map<string, number[]>();

function notificationPriority(type: string): AppNotification["priority"] {
  if (["security_alert", "account_warning", "password_changed", "email_changed"].includes(type)) return "critical";
  if (["message", "message_reply", "group_message", "mention", "tag", "call", "missed_call", "report_update", "verification_update"].includes(type)) return "high";
  if (["recommendation", "creator_update"].includes(type)) return "low";
  return "normal";
}

function safeNotificationMessage(message: string) {
  return /\b(kill yourself|hate you|idiot|stupid|worthless)\b/i.test(message) ? "You have a new activity update. Sensitive content was hidden." : message.slice(0, 240);
}

function stableNotificationId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `notification_${(hash >>> 0).toString(36)}`;
}

async function retryWrite(operation: () => Promise<void>) {
  let failure: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { await operation(); return; }
    catch (error) { failure = error; if (!isTransientFirestoreError(error)) throw error; }
  }
  throw failure;
}

function quietHourDelivery(quietHours: Record<string, unknown>) {
  if (quietHours.enabled !== true) return null;
  const start = String(quietHours.start ?? "22:00"); const end = String(quietHours.end ?? "07:00");
  const now = new Date(); const current = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = start.split(":").map(Number); const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute; const endTotal = endHour * 60 + endMinute;
  const quiet = startTotal > endTotal ? current >= startTotal || current < endTotal : current >= startTotal && current < endTotal;
  if (!quiet) return null;
  const deliver = new Date(now); deliver.setHours(endHour, endMinute, 0, 0); if (deliver <= now) deliver.setDate(deliver.getDate() + 1);
  return deliver;
}

export async function createNotification(input: {
  type: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  message: string;
  postId?: string;
  commentId?: string;
  conversationId?: string;
  storyId?: string;
  messageId?: string;
  targetUrl?: string;
  thumbnailUrl?: string;
}) {
  if (!db || (input.recipientId === input.actorId && !["security_alert", "account_warning", "report", "report_update"].includes(input.type))) {
    return;
  }

  const recipientSettings = await getRecipientNotificationPreferences(input.recipientId);
  const preferences = recipientSettings?.preferences;
  if (recipientSettings?.blockedUsers.includes(input.actorId)) return;
  if (input.postId && ["recommendation", "creator_update"].includes(input.type)) {
    const viewed = await getDoc(doc(db, "viewHistory", `${input.recipientId}__${input.postId}`));
    if (viewed.exists()) return;
  }
  const preferenceKeyMap: Record<string, string> = {
    like: "likes",
    comment: "comments",
    comment_reply: "replies",
    comment_reaction: "comments",
    follow: "follows",
    message: "messages",
    message_reply: "messages",
    message_reaction: "messages",
    group_message: "groupMessages",
    call: "messages",
    missed_call: "messages",
    booking: "messages",
    repost: "reposts",
    report: "reports",
    report_update: "reports",
    mention: "mentions",
    tag: "tags",
    story_reply: "storyActivity",
    story_reaction: "storyActivity",
    story_mention: "storyActivity",
    live: "live",
    creator_update: "creatorUpdates",
    collaboration_invite: "mentions",
    recommendation: "recommendations",
    admin_announcement: "recommendations",
    verification_update: "reports",
    follow_request: "followRequests",
    follow_request_accepted: "followRequests",
    poll_vote: "comments",
  };
  const preferenceKey = preferenceKeyMap[input.type];
  if (preferenceKey && preferences?.[preferenceKey] === false) {
    return;
  }
  const audienceExemptTypes = ["message", "message_reply", "group_message", "call", "missed_call", "report", "report_update", "verification_update", "security_alert", "account_warning", "admin_announcement", "follow", "follow_request", "follow_request_accepted"];
  if (recipientSettings?.audience === "no_one" && !audienceExemptTypes.includes(input.type)) return;
  if (recipientSettings?.audience === "following" && !recipientSettings.following.includes(input.actorId) && !audienceExemptTypes.includes(input.type)) return;

  const deliveryKey = `${input.recipientId}:${input.actorId}:${input.type}:${input.postId ?? input.conversationId ?? input.storyId ?? "general"}`;
  const now = Date.now(); const recent = (recentDeliveries.get(deliveryKey) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 3 || (recent.length && now - recent[recent.length - 1] < 5_000)) return;
  recentDeliveries.set(deliveryKey, [...recent, now]);
  const priority = notificationPriority(input.type);
  const deliverAfter = priority === "critical" ? null : quietHourDelivery(recipientSettings?.quietHours ?? {});

  const eventIdentity = `${input.recipientId}:${input.actorId}:${input.type}:${input.messageId ?? input.commentId ?? input.postId ?? input.storyId ?? input.conversationId ?? input.targetUrl ?? input.message}:${Math.floor(Date.now() / 60_000)}`;
  const notificationId = stableNotificationId(eventIdentity);
  await retryWrite(() => setDoc(doc(db!, "notifications", notificationId), {
    ...input,
    message: safeNotificationMessage(input.message),
    priority,
    deliverAfter,
    expiresAt: new Date(Date.now() + (priority === "critical" ? 365 : priority === "low" ? 30 : 90) * 86_400_000),
    postId: input.postId ?? null,
    commentId: input.commentId ?? null,
    conversationId: input.conversationId ?? null,
    storyId: input.storyId ?? null,
    messageId: input.messageId ?? null,
    targetUrl: input.targetUrl ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    deliveryPreferences: recipientSettings ? {
      channels: recipientSettings.channels,
      quietHours: recipientSettings.quietHours,
      preview: recipientSettings.preview,
      sound: recipientSettings.sound,
      vibration: recipientSettings.vibration,
    } : null,
    readBy: [],
    deliveryStatus: "queued",
    deliveryAttempts: 0,
    idempotencyKey: eventIdentity,
    createdAt: serverTimestamp(),
  }, { merge: true }));
  await recordNotificationEvent(notificationId, "sent");
}

async function recordNotificationEvent(notificationId: string, event: "sent" | "delivered" | "opened" | "dismissed") {
  if (!auth.currentUser || !db) return;
  await addDoc(collection(db, "notificationEvents"), { notificationId, userId: auth.currentUser.uid, event, createdAt: serverTimestamp() }).catch(() => undefined);
}

export async function markNotificationDelivered(notificationId: string) {
  if (!auth.currentUser || !db) return;
  const snapshot = await getDoc(doc(db, "notifications", notificationId));
  if (!snapshot.exists() || snapshot.data().deliveryStatus === "opened") return;
  await setDoc(doc(db, "notifications", notificationId), { deliveryStatus: "delivered", deliveredAt: serverTimestamp() }, { merge: true });
  await recordNotificationEvent(notificationId, "delivered");
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
      deliveryStatus: "opened",
      openedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await recordNotificationEvent(notificationId, "opened");
}

export async function markAllNotificationsRead(notifications: AppNotification[]) {
  if (!auth?.currentUser || !db) return;
  const unread = notifications.filter((item) => item.recipientId === auth.currentUser!.uid && !item.readBy?.includes(auth.currentUser!.uid));
  for (let offset = 0; offset < unread.length; offset += 450) {
    const batch = writeBatch(db);
    unread.slice(offset, offset + 450).forEach((item) => batch.set(doc(db!, "notifications", item.id), { readBy: [...(item.readBy ?? []), auth.currentUser!.uid] }, { merge: true }));
    await batch.commit();
  }
}

export async function deleteNotification(notificationId: string) {
  if (!auth?.currentUser || !db) return;
  await recordNotificationEvent(notificationId, "dismissed");
  await deleteDoc(doc(db, "notifications", notificationId));
}

export async function cleanupExpiredNotifications() {
  if (!auth.currentUser || !db) return 0;
  const snapshot = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"), limit(100)));
  const expired = snapshot.docs.filter((item) => { const expires = item.data().expiresAt as { seconds?: number } | undefined; return Boolean(expires?.seconds && expires.seconds <= Date.now() / 1000); });
  const batch = writeBatch(db); expired.forEach((item) => batch.delete(item.ref)); if (expired.length) await batch.commit();
  return expired.length;
}

export async function restoreNotification(notification: AppNotification) {
  if (!auth?.currentUser || !db || notification.recipientId !== auth.currentUser.uid) return;
  const { id, ...data } = notification;
  await setDoc(doc(db, "notifications", id), data);
}

export function getNotificationTarget(notification: AppNotification) {
  if (notification.targetUrl?.startsWith("/")) return notification.targetUrl;
  if (notification.conversationId) return `/messages?conversation=${encodeURIComponent(notification.conversationId)}`;
  if (notification.postId) return `/post/${encodeURIComponent(notification.postId)}${notification.commentId ? `?comment=${encodeURIComponent(notification.commentId)}` : ""}`;
  if (notification.storyId) return `/stories?story=${encodeURIComponent(notification.storyId)}`;
  return notification.actorId ? `/profile/${encodeURIComponent(notification.actorId)}` : "/notifications";
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
    limit(100)
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
            commentId: data.commentId ? String(data.commentId) : null,
            conversationId: data.conversationId ? String(data.conversationId) : null,
            storyId: data.storyId ? String(data.storyId) : null,
            messageId: data.messageId ? String(data.messageId) : null,
            targetUrl: data.targetUrl ? String(data.targetUrl) : null,
            thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : null,
            readBy: Array.isArray(data.readBy) ? (data.readBy as string[]) : [],
            priority: (data.priority === "critical" || data.priority === "high" || data.priority === "low" ? data.priority : "normal") as AppNotification["priority"],
            deliverAfter: (data.deliverAfter as AppNotification["deliverAfter"]) ?? null,
            expiresAt: (data.expiresAt as AppNotification["expiresAt"]) ?? null,
            deliveryStatus: (data.deliveryStatus === "delivered" || data.deliveryStatus === "opened" || data.deliveryStatus === "failed" ? data.deliveryStatus : "queued") as AppNotification["deliveryStatus"],
            deliveryAttempts: Number(data.deliveryAttempts ?? 0),
            createdAt:
              (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
              null,
          };
        }).filter((notification) => !notification.expiresAt?.seconds || notification.expiresAt.seconds > Date.now() / 1000)
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
    return { total: 0, unread: 0, important: 0, summary: "No new notifications.", byType: [] } satisfies NotificationDigest;
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
  let important = 0;

  snapshot.docs.forEach((docSnapshot: { data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    const type = String(data.type ?? "activity");
    counts.set(type, (counts.get(type) ?? 0) + 1);
    const readBy = Array.isArray(data.readBy) ? (data.readBy as string[]) : [];
    if (!readBy.includes(recipientId)) {
      unread += 1;
      const priority = data.priority ?? notificationPriority(type);
      if (priority === "critical" || priority === "high") important += 1;
    }
  });

  return {
    total: snapshot.docs.length,
    unread,
    important,
    summary: unread ? `${unread} unread notification${unread === 1 ? "" : "s"}, including ${important} important update${important === 1 ? "" : "s"}.` : "You are all caught up.",
    byType: Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([type, count]) => ({ type, count })),
  } satisfies NotificationDigest;
}

export async function registerPushDevice(input: {
  id?: string;
  label: string;
  token: string;
  platform?: string;
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const deviceRef = input.id ? doc(db, "pushDevices", input.id) : doc(collection(db, "pushDevices"));
  await setDoc(deviceRef, {
    userId: auth.currentUser.uid,
    label: input.label.trim(),
    token: input.token.trim(),
    platform: input.platform?.trim() || "web",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return deviceRef.id;
}

export async function removePushDevice(deviceId: string) {
  if (!auth?.currentUser || !db) return;
  await deleteDoc(doc(db, "pushDevices", deviceId));
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
  const response = await authenticatedFetch("/api/notifications/digest", {
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
  const response = await authenticatedFetch("/api/notifications/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Push delivery request failed.");
  }

  return response.json();
}
