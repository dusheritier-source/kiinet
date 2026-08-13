import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getFirebaseClientConfig } from "@/lib/env";

const firebaseConfig = getFirebaseClientConfig();

const requiredFirebaseConfigValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

export const isFirebaseConfigured = requiredFirebaseConfigValues.every(
  (value) => value.trim().length > 0 && !value.startsWith("your-")
);

export const firebaseConfigError = isFirebaseConfigured ? null : "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values in .env.local.";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// The checked-in fallback config guarantees an app; environment values override it.
export const auth = getAuth(app);
function initializeClientFirestore() {
  if (!app) return null;
  try {
    return initializeFirestore(app, {
      // Avoid Safari serving an old profile/inbox indefinitely from IndexedDB
      // when its Firestore connection cannot refresh the persistent cache.
      localCache: memoryLocalCache(),
      // Forced long polling is more reliable than WebChannel streaming on
      // mobile Safari and networks/proxies that leave Firestore listeners open
      // without ever delivering their first snapshot.
      experimentalForceLongPolling: true,
    });
  }
  catch { return getFirestore(app); }
}
export const db = initializeClientFirestore();
export const storage = app ? getStorage(app) : null;
export const rtdb = app ? getDatabase(app) : null;

export function isTransientFirestoreError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = typeof (error as { code?: string }).code === "string"
      ? (error as { code?: string }).code!.toLowerCase()
      : "";

    return (
      code === "unavailable" ||
      code === "offline" ||
      code === "network-request-failed" ||
      message.includes("offline") ||
      message.includes("network") ||
      message.includes("client is offline") ||
      message.includes("timed out")
    );
  }

  return false;
}

export function isPermissionDeniedFirestoreError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = typeof (error as { code?: string }).code === "string"
      ? (error as { code?: string }).code!.toLowerCase()
      : "";

    return (
      code === "permission-denied" ||
      code === "firebase-permission-denied" ||
      message.includes("insufficient permissions") ||
      message.includes("missing or insufficient permissions") ||
      message.includes("permission denied")
    );
  }

  return false;
}

export const getClientAnalytics = async () => {
  if (!app || typeof window === "undefined") {
    return null;
  }

  const analyticsSupported = await isSupported().catch(() => false);
  return analyticsSupported ? getAnalytics(app) : null;
};

export default app;
