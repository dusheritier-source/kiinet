"use client";

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";

export interface NotificationTemplate { id: string; name: string; title: string; body: string; targetUrl: string; createdAt?: { seconds?: number } | null }
export interface NotificationBroadcast { id: string; title: string; body: string; targetUrl: string; segment: "all" | "verified" | "active"; status: "scheduled" | "sending" | "sent"; scheduledFor?: { seconds?: number } | null; sentCount: number }
export interface NotificationAnalytics { sent: number; delivered: number; opened: number; dismissed: number; openRate: number }

function requireAdminContext() {
  if (!db || !auth.currentUser) throw new Error("You must be signed in as an administrator.");
  return { firestore: db, user: auth.currentUser };
}

async function auditNotificationOperation(action: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const { firestore, user } = requireAdminContext();
  await addDoc(collection(firestore, "auditLogs"), { action, targetType: "notification", targetId, actorId: user.uid, metadata, createdAt: serverTimestamp() });
}

export async function getNotificationTemplates() {
  const { firestore } = requireAdminContext();
  const snapshot = await getDocs(query(collection(firestore, "notificationTemplates"), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as NotificationTemplate));
}

export async function saveNotificationTemplate(input: Omit<NotificationTemplate, "id" | "createdAt">) {
  const { firestore } = requireAdminContext();
  const reference = await addDoc(collection(firestore, "notificationTemplates"), { ...input, createdAt: serverTimestamp() });
  await auditNotificationOperation("notification_template_created", reference.id);
}

export async function deleteNotificationTemplate(id: string) {
  const { firestore } = requireAdminContext(); await deleteDoc(doc(firestore, "notificationTemplates", id)); await auditNotificationOperation("notification_template_deleted", id);
}

export async function scheduleNotificationBroadcast(input: { title: string; body: string; targetUrl: string; segment: NotificationBroadcast["segment"]; scheduledFor?: Date | null }) {
  const { firestore, user } = requireAdminContext();
  const reference = await addDoc(collection(firestore, "notificationBroadcasts"), { ...input, createdBy: user.uid, scheduledFor: input.scheduledFor ?? new Date(), status: "scheduled", sentCount: 0, createdAt: serverTimestamp() });
  await auditNotificationOperation("notification_broadcast_scheduled", reference.id, { segment: input.segment });
  if (!input.scheduledFor || input.scheduledFor <= new Date()) await dispatchNotificationBroadcast(reference.id);
  return reference.id;
}

export async function dispatchNotificationBroadcast(id: string) {
  const { firestore, user } = requireAdminContext(); const reference = doc(firestore, "notificationBroadcasts", id); const snapshot = await getDoc(reference);
  if (!snapshot.exists() || snapshot.data().status === "sent") return 0;
  const broadcast = snapshot.data() as Omit<NotificationBroadcast, "id">;
  await setDoc(reference, { status: "sending", startedAt: serverTimestamp() }, { merge: true });
  const users = await getDocs(query(collection(firestore, "users"), limit(200)));
  const recipients = users.docs.filter((item) => broadcast.segment === "all" || (broadcast.segment === "verified" && item.data().verified === true) || (broadcast.segment === "active" && item.data().presence?.isOnline === true));
  await Promise.all(recipients.map((recipient) => createNotification({ type: "admin_announcement", recipientId: recipient.id, actorId: user.uid, actorName: "Kinet", actorAvatar: "", message: `${broadcast.title}: ${broadcast.body}`, targetUrl: broadcast.targetUrl || "/notifications" }).catch(() => undefined)));
  await setDoc(reference, { status: "sent", sentCount: recipients.length, sentAt: serverTimestamp() }, { merge: true });
  await auditNotificationOperation("notification_broadcast_sent", id, { sentCount: recipients.length, segment: broadcast.segment });
  return recipients.length;
}

export async function dispatchDueNotificationBroadcasts() {
  const { firestore } = requireAdminContext(); const snapshot = await getDocs(query(collection(firestore, "notificationBroadcasts"), orderBy("scheduledFor", "asc"), limit(50)));
  const due = snapshot.docs.filter((item) => item.data().status === "scheduled" && (item.data().scheduledFor?.seconds ?? 0) * 1000 <= Date.now());
  return Promise.all(due.map((item) => dispatchNotificationBroadcast(item.id)));
}

export async function getNotificationAnalytics(): Promise<NotificationAnalytics> {
  const { firestore } = requireAdminContext(); const snapshot = await getDocs(query(collection(firestore, "notificationEvents"), orderBy("createdAt", "desc"), limit(1000)));
  const sent = snapshot.docs.filter((item) => item.data().event === "sent").length; const delivered = snapshot.docs.filter((item) => item.data().event === "delivered").length; const opened = snapshot.docs.filter((item) => item.data().event === "opened").length; const dismissed = snapshot.docs.filter((item) => item.data().event === "dismissed").length;
  return { sent, delivered, opened, dismissed, openRate: sent ? Math.round(opened / sent * 1000) / 10 : 0 };
}
