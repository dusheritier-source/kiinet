import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCBuRIXM36SnhoNaPZi1Wl9dWdXzZjN7CE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "kinet-3a9b6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kinet-3a9b6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kinet-3a9b6.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "919183651612",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:919183651612:web:58b55e27330a00abe5c0d9",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-W1SVHLK71K",
};

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

export const firebaseConfigError = isFirebaseConfigured
  ? null
  : "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values in .env.local.";

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

if (auth && typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence).catch(() => {
    // Keep the app usable even if the browser blocks persistence setup.
  });
}

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

export const getClientAnalytics = async () => {
  if (!app || typeof window === "undefined") {
    return null;
  }

  const analyticsSupported = await isSupported().catch(() => false);
  return analyticsSupported ? getAnalytics(app) : null;
};

export default app;
