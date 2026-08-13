import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { limitForUser, requireApiUser } from "@/lib/api-security";
import { getAdminFirestore, getAdminMessaging } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function notificationLink(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://kiinet-diha.vercel.app";
  try { return new URL(path.startsWith("/") ? path : "/notifications", base).toString(); }
  catch { return "https://kiinet-diha.vercel.app/notifications"; }
}

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if (authResult.response) return authResult.response;
  const limited = limitForUser(request, authResult.user.uid, "push-delivery", 40, 60_000);
  if (limited) return limited;

  const input = await request.json().catch(() => null) as { notificationId?: string } | null;
  const notificationId = input?.notificationId?.trim();
  if (!notificationId || !/^[a-zA-Z0-9_-]{1,180}$/.test(notificationId)) return NextResponse.json({ error: "Invalid notification." }, { status: 400 });

  const database = getAdminFirestore();
  const notificationRef = database.collection("notifications").doc(notificationId);
  const notification = await notificationRef.get();
  if (!notification.exists) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  const data = notification.data() ?? {};
  if (String(data.actorId ?? "") !== authResult.user.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (data.pushDeliveredAt) return NextResponse.json({ ok: true, delivered: 0, duplicate: true });
  const channels = data.deliveryPreferences?.channels as Record<string, unknown> | undefined;
  if (channels?.push === false) return NextResponse.json({ ok: true, delivered: 0, disabled: true });

  const recipientId = String(data.recipientId ?? "");
  if (!recipientId) return NextResponse.json({ error: "Invalid notification recipient." }, { status: 400 });
  const devices = await database.collection("pushDevices").where("userId", "==", recipientId).limit(20).get();
  const registered = devices.docs.filter((item) => typeof item.data().token === "string" && item.data().token.trim());
  if (!registered.length) return NextResponse.json({ ok: true, delivered: 0 });

  const preview = String(data.deliveryPreferences?.preview ?? "full");
  const actorName = String(data.actorName ?? "Someone").slice(0, 80);
  const body = preview === "hidden" ? "You have a new message." : preview === "sender_only" ? `${actorName} sent you a message.` : String(data.message ?? "You have a new notification.").slice(0, 180);
  const relativeLink = data.conversationId ? `/messages?conversation=${encodeURIComponent(String(data.conversationId))}` : String(data.targetUrl ?? "/notifications");
  const response = await getAdminMessaging().sendEachForMulticast({
    tokens: registered.map((item) => String(item.data().token)),
    data: {
      title: data.conversationId ? actorName : "Kinet",
      body,
      link: notificationLink(relativeLink),
      icon: "/icon-192.png",
      tag: data.conversationId ? `conversation-${String(data.conversationId)}` : `notification-${notificationId}`,
    },
    webpush: { headers: { Urgency: data.priority === "critical" ? "high" : "normal" } },
  });

  const invalidCodes = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"]);
  const staleRefs = response.responses.flatMap((result, index) => !result.success && invalidCodes.has(result.error?.code || "") ? [registered[index].ref] : []);
  await Promise.all(staleRefs.map((reference) => reference.delete().catch(() => undefined)));
  if (response.successCount) await notificationRef.set({ pushDeliveredAt: FieldValue.serverTimestamp(), pushDeliveryStatus: "delivered" }, { merge: true });
  return NextResponse.json({ ok: true, delivered: response.successCount, failed: response.failureCount });
}
