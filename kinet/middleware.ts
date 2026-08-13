import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = [
  "/admin", "/ai-coach", "/analytics", "/billing", "/bookings", "/business",
  "/challenges", "/chatbox", "/community", "/compliance", "/drafts", "/edit-profile",
  "/events", "/feed", "/groups", "/growth", "/history", "/intelligence", "/live",
  "/marketplace", "/media-center", "/media-lab", "/messages", "/moderation", "/notifications",
  "/onboarding", "/operations", "/org", "/pathways", "/podcasts", "/profile", "/reels",
  "/safety-ops", "/saved", "/search", "/security", "/settings", "/stories", "/strategy",
  "/studio", "/topics", "/upload", "/vchat", "/wellness",
];

function base64Url(bytes: ArrayBuffer) {
  let binary = "";
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function validSession(value: string | undefined) {
  if (!value) return false;
  const [uid, expiresRaw, signature] = value.split(".");
  if (!uid || !expiresRaw || !signature || Number(expiresRaw) <= Date.now() / 1000) return false;
  const secret = process.env.KINET_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${uid}.${expiresRaw}`)));
  return expected === signature;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.NODE_ENV === "production" && (path.startsWith("/test-env") || path.startsWith("/test-realtime"))) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (!protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return NextResponse.next();
  if (await validSession(request.cookies.get("kinet_session")?.value)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
