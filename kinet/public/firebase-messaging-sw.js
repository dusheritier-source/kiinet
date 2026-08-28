/* global firebase, clients, caches */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCBuRIXM36SnhoNaPZi1Wl9dWdXzZjN7CE",
  authDomain: "kinet-3a9b6.firebaseapp.com",
  projectId: "kinet-3a9b6",
  storageBucket: "kinet-3a9b6.firebasestorage.app",
  messagingSenderId: "919183651612",
  appId: "1:919183651612:web:58b55e27330a00abe5c0d9"
});

firebase.messaging().onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const link = data.link || "/notifications";
  return self.registration.showNotification(notification.title || data.title || "Kinet", {
    body: notification.body || data.body || "You have a new notification.",
    icon: notification.icon || data.icon || "/icon-192.png",
    badge: "/favicon-48.png",
    tag: payload.data?.tag || payload.messageId,
    data: { link },
    renotify: true,
    vibrate: [180, 80, 180],
    actions: [{ action: "open", title: "Open" }]
  }).then(() => {
    if ("setAppBadge" in self.navigator) return self.navigator.setAppBadge(1);
    return undefined;
  });
});

const CACHE_NAME = "kinet-shell-v6";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/_next/") || request.headers.get("RSC") === "1") return;
  event.respondWith(fetch(request).then((response) => {
    if (response && response.status === 200 && response.type === "basic") {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || Response.error())));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if ("clearAppBadge" in self.navigator) void self.navigator.clearAppBadge();
  const link = event.notification.data?.link || "/notifications";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const target = new URL(link, self.location.origin).toString();
    const existing = windows.find((client) => "focus" in client);
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});
