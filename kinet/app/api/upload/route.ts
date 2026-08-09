import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { ModerationBlockedError, moderateOrThrow } from "@/lib/moderation-server";
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
    const safeFolder = String(formData.get("folder") ?? "posts").replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "") || "posts";
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
    const path = `${safeFolder}/${user.uid}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "kinet-media";
    const admin = getSupabaseAdmin();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
      await moderateOrThrow({
        buffer: fileBuffer,
        contentType,
        userId: user.uid,
        purpose: String(formData.get("purpose") ?? safeFolder),
      });
    }
    const { error } = await admin.storage.from(bucket).upload(path, fileBuffer, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw new Error(error.message || "Could not store the moderated upload.");
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
    if (error) throw new Error(error.message || "Could not remove the upload.");
    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove the upload." }, { status: 500 });
  }
}
