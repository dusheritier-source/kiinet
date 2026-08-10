import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getFirebaseUserFromRequest(request);
  if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Moderation removed: always allow
  return NextResponse.json({ status: "allowed", disabled: true });
}