import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { createSessionMarker } from "@/lib/session-token";

export async function POST(request: Request) {
  const user = await getFirebaseUserFromRequest(request);
  if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const marker = createSessionMarker(user.uid);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("kinet_session", marker.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: marker.maxAge,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("kinet_session", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
