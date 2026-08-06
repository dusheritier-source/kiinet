import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";

type FirestoreValue = Record<string, unknown>;

function getTokenProject(authorization: string) {
  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { aud?: unknown };
    return typeof decoded.aud === "string" && /^[a-z0-9-]+$/i.test(decoded.aud) ? decoded.aud : null;
  } catch {
    return null;
  }
}

function toFirestoreValue(value: unknown, key = ""): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (key === "createdAt" || key === "scheduledFor") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return { timestampValue: date.toISOString() };
  }
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, toFirestoreValue(childValue, childKey)])) } };
  }
  return { stringValue: String(value) };
}

export async function POST(request: Request) {
  const user = await getFirebaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authorization = request.headers.get("authorization") || "";
  const data = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!data || data.userId !== user.uid) return NextResponse.json({ error: "Invalid post data." }, { status: 400 });

  // A Firebase ID token can only access the Firestore project named by its
  // audience. Deriving this after token verification avoids stale/mismatched
  // Vercel project variables producing PERMISSION_DENIED.
  const projectId = getTokenProject(authorization);
  if (!projectId) return NextResponse.json({ error: "Invalid Firebase project token." }, { status: 401 });
  const configuredProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kinet-3a9b6";
  if (configuredProjectId !== projectId) {
    return NextResponse.json(
      {
        error: `Firebase project mismatch: your login uses ${projectId}, but the feed uses ${configuredProjectId}. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID to ${projectId} in Vercel and redeploy.`,
      },
      { status: 409 }
    );
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCBuRIXM36SnhoNaPZi1Wl9dWdXzZjN7CE";
  const id = crypto.randomUUID().replace(/-/g, "");
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value, key)]));
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/posts?documentId=${id}&key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization, "x-goog-api-key": apiKey },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    console.error("Firestore post publish failed:", response.status, error?.error?.message);
    return NextResponse.json({ error: error?.error?.message || "The post could not be published." }, { status: response.status });
  }
  return NextResponse.json({ id });
}
