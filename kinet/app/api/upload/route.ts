import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { ModerationBlockedError, isModerationDisabled, moderateOrThrow } from "@/lib/moderation-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { limitForUser } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const allowedTypes = /^(image|video|audio)\//;
const allowedDocuments = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/vtt",
]);
const maxFileSize = 50 * 1024 * 1024;
const allowedExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mp3", "wav", "ogg", "pdf", "doc", "docx", "txt", "vtt"]);

function hasPrefix(bytes: Uint8Array, prefix: number[], offset = 0) {
  return prefix.every((value, index) => bytes[offset + index] === value);
}

function hasExpectedSignature(file: File, bytes: Uint8Array) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!allowedExtensions.has(extension)) return false;
  const ascii = new TextDecoder("ascii").decode(bytes.slice(0, 16));
  const signatures: Record<string, boolean> = {
    "image/jpeg": hasPrefix(bytes, [0xff, 0xd8, 0xff]),
    "image/png": hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    "image/gif": ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a"),
    "image/webp": ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP",
    "video/mp4": ascii.slice(4, 8) === "ftyp",
    "video/webm": hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3]),
    "audio/mpeg": ascii.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
    "audio/wav": ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE",
    "audio/ogg": ascii.startsWith("OggS"),
    "application/pdf": ascii.startsWith("%PDF-"),
    "application/msword": hasPrefix(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]),
    "text/plain": !bytes.includes(0),
    "text/vtt": !bytes.includes(0) && new TextDecoder().decode(bytes.slice(0, 64)).trimStart().startsWith("WEBVTT"),
  };
  return signatures[file.type] === true;
}

function getStorageBucket() {
  const configured = process.env.SUPABASE_STORAGE_BUCKET
    ?.trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!configured) return "kinet-media";
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(configured)) {
    throw new Error("Supabase storage bucket is invalid. Set SUPABASE_STORAGE_BUCKET to a bucket name such as kinet-media.");
  }
  return configured;
}

function buildStoragePath(folder: FormDataEntryValue | null, uid: string, fileName: string) {
  const safeUid = uid.replace(/[^a-z0-9._-]/gi, "-");
  const folderSegments = String(folder ?? "posts")
    .replace(/^Kinet\//i, "")
    .split("/")
    .map((segment) => segment.trim().replace(/[^a-z0-9_-]/gi, "-"))
    .filter((segment) => segment && segment !== "." && segment !== ".." && segment !== safeUid);
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "") || "upload";
  return [...(folderSegments.length ? folderSegments : ["posts"]), safeUid, `${Date.now()}-${crypto.randomUUID()}-${safeName}`].join("/");
}

export async function POST(request: Request) {
  try {
    const user = await getFirebaseUserFromRequest(request);
    if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const limited = limitForUser(request, user.uid, "upload", 12, 60_000);
    if (limited) return limited;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    const contentType = file.type;
    if (!allowedTypes.test(contentType) && !allowedDocuments.has(contentType)) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    if (!file.size || file.size > maxFileSize) return NextResponse.json({ error: "Files must be smaller than 50 MB." }, { status: 400 });
    const signatureBytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
    if (!hasExpectedSignature(file, signatureBytes)) return NextResponse.json({ error: "The file contents do not match an allowed file type." }, { status: 400 });
    const path = buildStoragePath(formData.get("folder"), String(user.uid), file.name);

    // Validate path for Supabase storage: no leading slashes, no consecutive slashes, no traversal, reasonable length
    if (path.includes("//") || path.includes("..")) return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
    if (path.length > 1024) return NextResponse.json({ error: "Upload path is too long." }, { status: 400 });
    const bucket = getStorageBucket();
    const admin = getSupabaseAdmin();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!isModerationDisabled() && (contentType.startsWith("image/") || contentType.startsWith("video/"))) {
      await moderateOrThrow({
        buffer: fileBuffer,
        contentType,
        userId: user.uid,
        purpose: String(formData.get("purpose") ?? path.split("/")[0]),
      });
    }
    try {
      const { error } = await admin.storage.from(bucket).upload(path, fileBuffer, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        return NextResponse.json({ error: "The file could not be stored." }, { status: 502 });
      }
    } catch {
      return NextResponse.json({ error: "The file could not be stored." }, { status: 502 });
    }

    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ bucket, path, publicUrl: publicData.publicUrl, status: "allowed" });
  } catch (error) {
    if (error instanceof ModerationBlockedError) return NextResponse.json({ error: error.message, status: "blocked" }, { status: 422 });
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getFirebaseUserFromRequest(request);
    if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const limited = limitForUser(request, user.uid, "upload-delete", 20, 60_000);
    if (limited) return limited;
    const input = await request.json() as { path?: string };
    const uploadPath = String(input.path ?? "");
    if (!uploadPath || uploadPath.includes("..") || !uploadPath.split("/").includes(user.uid)) {
      return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
    }
    const bucket = getStorageBucket();
    const { error } = await getSupabaseAdmin().storage.from(bucket).remove([uploadPath]);
    if (error) return NextResponse.json({ error: "The file could not be removed." }, { status: 502 });
    return NextResponse.json({ status: "deleted" });
  } catch {
    return NextResponse.json({ error: "Could not remove the upload." }, { status: 500 });
  }
}
