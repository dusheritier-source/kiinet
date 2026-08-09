import "server-only";

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

import { getSupabaseAdmin } from "@/lib/supabase-server";

const execFileAsync = promisify(execFile);
const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";
const MAX_VIDEO_FRAMES = 12;

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
  if (!response.ok) throw new Error(`Moderation service failed with status ${response.status}.`);
  const payload = await response.json() as { results?: Array<{ flagged?: boolean }> };
  return Boolean(payload.results?.[0]?.flagged);
}

export async function moderateText(text: string): Promise<ModerationResult> {
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

async function extractVideoFrames(buffer: Buffer, contentType: string) {
  if (!ffmpegPath) throw new Error("Video moderation is not configured because ffmpeg is unavailable.");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kinet-moderation-"));
  const inputPath = path.join(directory, `input.${contentType.split("/")[1] || "mp4"}`);
  const outputPattern = path.join(directory, "frame-%02d.jpg");
  await fs.writeFile(inputPath, buffer);
  try {
    await execFileAsync(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-i", inputPath,
      "-vf", "fps=1/5,scale=768:-2", "-frames:v", String(MAX_VIDEO_FRAMES), outputPattern,
    ], { maxBuffer: 2 * 1024 * 1024 });
    const names = (await fs.readdir(directory)).filter((name) => name.startsWith("frame-") && name.endsWith(".jpg")).sort();
    return await Promise.all(names.map((name) => fs.readFile(path.join(directory, name))));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

export async function moderateMedia(buffer: Buffer, contentType: string): Promise<ModerationResult> {
  let flagged = false;
  if (contentType.startsWith("image/")) {
    flagged = await moderateImage(buffer, contentType);
  } else if (contentType.startsWith("video/")) {
    const frames = await extractVideoFrames(buffer, contentType);
    for (const frame of frames) {
      if (await moderateImage(frame, "image/jpeg")) {
        flagged = true;
        break;
      }
    }
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
  if (result.flagged) throw new ModerationBlockedError();
  return result;
}
