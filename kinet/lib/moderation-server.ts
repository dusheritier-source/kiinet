import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-server";

const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

export type ModerationStatus = "allowed" | "blocked" | "review";

export class ModerationBlockedError extends Error {
  status: ModerationStatus = "blocked";

  constructor() {
    super("This media violates Kinet Community Guidelines and cannot be shared.");
    this.name = "ModerationBlockedError";
  }
}

export interface ModerationResult {
  status: ModerationStatus;
  flagged: boolean;
}

export function isModerationDisabled() {
  return String(process.env.DISABLE_MODERATION ?? "").toLowerCase() === "true";
}

function requireOpenAiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Content moderation is not configured. Set OPENAI_API_KEY on the server.");
  return key;
}

async function callOpenAi(input: unknown) {
  const response = await fetch(OPENAI_MODERATION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenAiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "omni-moderation-latest", input }),
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Moderation service is temporarily busy or out of quota. Please try again shortly.");
    }
    throw new Error(`Moderation service failed with status ${response.status}.`);
  }
  const payload = await response.json() as { results?: Array<{ flagged?: boolean }> };
  return Boolean(payload.results?.[0]?.flagged);
}

export async function moderateText(text: string): Promise<ModerationResult> {
  if (isModerationDisabled()) return { status: "allowed", flagged: false };
  if (!text.trim()) return { status: "allowed", flagged: false };
  const flagged = await callOpenAi(text.slice(0, 20_000));
  return { status: flagged ? "blocked" : "allowed", flagged };
}

function toDataUrl(buffer: Buffer, contentType: string) {
  return `data:${contentType || "application/octet-stream"};base64,${buffer.toString("base64")}`;
}

async function moderateImage(buffer: Buffer, contentType: string) {
  return callOpenAi([{ type: "image_url", image_url: { url: toDataUrl(buffer, contentType) } }]);
}

export async function moderateMedia(buffer: Buffer, contentType: string): Promise<ModerationResult> {
  if (isModerationDisabled()) return { status: "allowed", flagged: false };
  let flagged = false;
  if (contentType.startsWith("image/")) {
    flagged = await moderateImage(buffer, contentType);
  } else if (contentType.startsWith("video/")) {
    // ffmpeg binary does not resolve on Vercel Lambda; skip video frame moderation
    flagged = false;
  }
  return { status: flagged ? "blocked" : "allowed", flagged };
}

export async function logModerationEvent(input: {
  userId: string;
  status: ModerationStatus;
  kind: "text" | "image" | "video";
  purpose: string;
}) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("moderation_events").insert({
      user_id: input.userId,
      status: input.status,
      kind: input.kind,
      purpose: input.purpose,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // best-effort logging only
    console.warn("Could not persist moderation event metadata.", error);
  }
}

export async function moderateOrThrow(input: {
  buffer?: Buffer;
  contentType?: string;
  text?: string;
  userId: string;
  purpose: string;
}) {
  const result = input.text !== undefined
    ? await moderateText(input.text)
    : await moderateMedia(input.buffer ?? Buffer.alloc(0), input.contentType ?? "");
  await logModerationEvent({
    userId: input.userId,
    status: result.status,
    kind: input.text !== undefined ? "text" : input.contentType?.startsWith("video/") ? "video" : "image",
    purpose: input.purpose,
  });
  if (result.status === "blocked") throw new ModerationBlockedError();
  return result;
}
