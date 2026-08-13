import { createHmac, timingSafeEqual } from "crypto";

const SESSION_TTL_SECONDS = 60 * 60;

function secret() {
  const value = process.env.KINET_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("KINET_SESSION_SECRET is required in production.");
  return value || "kinet-development-session-secret";
}

export function createSessionMarker(uid: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${uid}.${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { value: `${payload}.${signature}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifySessionMarker(value: string) {
  const [uid, expiresRaw, signature] = value.split(".");
  if (!uid || !expiresRaw || !signature || Number(expiresRaw) <= Date.now() / 1000) return false;
  const expected = createHmac("sha256", secret()).update(`${uid}.${expiresRaw}`).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
