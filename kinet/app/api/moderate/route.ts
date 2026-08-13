import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { limitForUser } from "@/lib/api-security";
import { ModerationBlockedError, moderateOrThrow } from "@/lib/moderation-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getFirebaseUserFromRequest(request);
  if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = limitForUser(request, user.uid, "moderate", 30, 60_000);
  if (limited) return limited;
  const body = await request.json().catch(() => null) as { text?: string; purpose?: string } | null;
  if (!body?.text?.trim()) return NextResponse.json({ error: "Text is required." }, { status: 400 });
  if (body.text.length > 20_000) return NextResponse.json({ error: "Text is too long." }, { status: 400 });
  try {
    const result = await moderateOrThrow({ text: body.text, purpose: body.purpose?.trim() || "text", userId: user.uid });
    if (result.status === "blocked") return NextResponse.json({ error: "This content violates Kinet Community Guidelines.", status: "blocked" }, { status: 422 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ModerationBlockedError) return NextResponse.json({ error: error.message, status: "blocked" }, { status: 422 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Moderation is unavailable." }, { status: 503 });
  }
}
