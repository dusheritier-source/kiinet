/* global firebase, clients */
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
  self.registration.showNotification(notification.title || data.title || "Kinet", {
    body: notification.body || data.body || "You have a new notification.",
    icon: notification.icon || data.icon || "/icon-192.png",
    badge: "/favicon-48.png",
    tag: payload.data?.tag || payload.messageId,
    data: { link },
    renotify: true,
    vibrate: [180, 80, 180],
    actions: [{ action: "open", title: "Open" }]
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/notifications";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const target = new URL(link, self.location.origin).toString();
    const existing = windows.find((client) => "focus" in client);
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});
