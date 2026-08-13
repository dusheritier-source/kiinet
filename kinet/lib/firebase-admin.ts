import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function credentials() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (encoded) return cert(JSON.parse(encoded));
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return cert({ projectId, clientEmail, privateKey });
  return applicationDefault();
}

export function getFirebaseAdminApp() {
  return getApps()[0] || initializeApp({ credential: credentials(), projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

export const getAdminFirestore = () => getFirestore(getFirebaseAdminApp());
export const getAdminMessaging = () => getMessaging(getFirebaseAdminApp());
