import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { ModerationBlockedError, moderateOrThrow } from "@/lib/moderation-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getFirebaseUserFromRequest(request);
    if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = await request.json() as { text?: string; purpose?: string };
    await moderateOrThrow({ text: String(input.text ?? ""), userId: user.uid, purpose: String(input.purpose ?? "text") });
    return NextResponse.json({ status: "allowed" });
  } catch (error) {
    if (error instanceof ModerationBlockedError) return NextResponse.json({ error: error.message, status: "blocked" }, { status: 422 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Moderation failed." }, { status: 500 });
  }
}