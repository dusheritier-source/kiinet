import { NextResponse } from "next/server";
import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { uploadToR2, generateFileName } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const firebaseUser = await getFirebaseUserFromRequest(request);

    if (!firebaseUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string || "post";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM" },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const fileName = generateFileName(file.name, firebaseUser.uid);
    const folder = type === "avatar" ? "avatars" : type === "reel" ? "reels" : "posts";

    // Upload to R2
    const publicUrl = await uploadToR2(buffer, fileName, file.type, folder);

    return NextResponse.json({
      url: publicUrl,
      fileName,
      type: file.type.startsWith("image/") ? "image" : "video",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}