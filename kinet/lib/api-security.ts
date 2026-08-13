import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export async function requireApiUser(request: Request) {
  const user = await getFirebaseUserFromRequest(request);
  if (!user?.uid) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

export function enforceRateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (bucket.count >= limit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)) } }
    );
  }
  bucket.count += 1;
  return null;
}

export function limitForUser(request: Request, uid: string, scope: string, limit?: number, windowMs?: number) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return enforceRateLimit(`${scope}:${uid}:${forwarded}`, limit, windowMs);
}
