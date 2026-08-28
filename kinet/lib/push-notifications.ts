"use client";

import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import firebaseApp from "@/lib/firebase";
import { registerPushDevice, removePushDevice } from "@/lib/notifications";
import { syncPushNotificationPreference } from "@/lib/settings";

const deviceKey = "kinet:fcm-device-id";

function isIosBrowserOutsideInstalledApp() {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export async function enableFirebasePush(onForegroundMessage?: (payload: MessagePayload) => void) {
  if (!firebaseApp || typeof window === "undefined" || !(await isSupported())) throw new Error("Push notifications are not supported on this browser.");
  if (isIosBrowserOutsideInstalledApp()) throw new Error("On iPhone, install Kinet to your Home Screen, open the installed app, then turn on notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    await syncPushNotificationPreference(false);
    throw new Error(permission === "denied" ? "Notifications are blocked in your browser settings." : "Notification permission was not granted.");
  }
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("NEXT_PUBLIC_FIREBASE_VAPID_KEY is required for Firebase push notifications.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Firebase did not return a device token.");
  const existingId = localStorage.getItem(deviceKey) ?? undefined;
  const installed = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const id = await registerPushDevice({ id: existingId, label: installed ? "Kinet app" : navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Web browser", token, platform: installed ? "pwa-fcm" : "web-fcm" });
  localStorage.setItem(deviceKey, id);
  await syncPushNotificationPreference(true);
  const unsubscribe = onMessage(messaging, (payload) => {
    onForegroundMessage?.(payload);
    window.dispatchEvent(new CustomEvent("kinet:push-message", { detail: payload }));
  });
  return { token, deviceId: id, unsubscribe };
}

export async function disableFirebasePush() {
  if (!firebaseApp || typeof window === "undefined") return;
  if (await isSupported()) await deleteToken(getMessaging(firebaseApp)).catch(() => false);
  const deviceId = localStorage.getItem(deviceKey);
  if (deviceId) await removePushDevice(deviceId);
  localStorage.removeItem(deviceKey);
  await syncPushNotificationPreference(false);
}

export function getPushCapability() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported" as const;
  return Notification.permission;
}
