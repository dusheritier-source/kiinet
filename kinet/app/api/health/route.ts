import { NextResponse } from "next/server";
import { getAdminFirestore, getFirebaseAdminApp } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function hasValidServiceAccount() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!value) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return Boolean(parsed && typeof parsed === "object" && "project_id" in parsed && "client_email" in parsed && "private_key" in parsed);
  } catch {
    return false;
  }
}

export async function GET() {
  const configuration = { firebaseAdmin: false };
  let firestore = false;
  if (hasValidServiceAccount()) {
    try {
      getFirebaseAdminApp();
      configuration.firebaseAdmin = true;
      await getAdminFirestore().collection("backgroundJobs").limit(1).get();
      firestore = true;
    } catch {
      // SDK errors are intentionally neither returned nor logged.
    }
  }
  const ok = configuration.firebaseAdmin && firestore;
  const response = NextResponse.json({ status: ok ? "healthy" : "unhealthy", checks: { configuration, firestore } }, { status: ok ? 200 : 503 });
  response.headers.set("cache-control", "no-store");
  return response;
}
