import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { ModerationBlockedError, isModerationDisabled, moderateOrThrow } from "@/lib/moderation-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    const contentType = file.type;
    if (!allowedTypes.test(contentType) && !allowedDocuments.has(contentType)) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    if (!file.size || file.size > maxFileSize) return NextResponse.json({ error: "Files must be smaller than 50 MB." }, { status: 400 });
    const path = buildStoragePath(formData.get("folder"), String(user.uid), file.name);

    // Validate path for Supabase storage: no leading slashes, no consecutive slashes, no traversal, reasonable length
    if (path.includes("//") || path.includes("..")) return NextResponse.json({ error: "Invalid upload path", path }, { status: 400 });
    if (path.length > 1024) return NextResponse.json({ error: "Upload path too long", path }, { status: 400 });
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "kinet-media";
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
        return NextResponse.json({ error: error.message || String(error), bucket, path }, { status: 500 });
      }
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err), bucket, path }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ bucket, path, publicUrl: publicData.publicUrl, status: "allowed" });
  } catch (error) {
    if (error instanceof ModerationBlockedError) return NextResponse.json({ error: error.message, status: "blocked" }, { status: 422 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare upload." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getFirebaseUserFromRequest(request);
    if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = await request.json() as { path?: string };
    const uploadPath = String(input.path ?? "");
    if (!uploadPath || uploadPath.includes("..") || !uploadPath.split("/").includes(user.uid)) {
      return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
    }
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "kinet-media";
    const { error } = await getSupabaseAdmin().storage.from(bucket).remove([uploadPath]);
    if (error) return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove the upload." }, { status: 500 });
  }
}
