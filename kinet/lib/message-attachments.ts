"use client";

import imageCompression from "browser-image-compression";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { auth, storage } from "@/lib/firebase";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav",
  "application/pdf", "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export interface UploadedMessageAttachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

export function validateMessageAttachment(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Unsupported file. Choose an image, video, audio, PDF, Word document, or text file.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("The attachment is larger than 50 MB.");
  }
}

export async function uploadMessageAttachment(
  conversationId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedMessageAttachment> {
  if (!storage || !auth.currentUser) throw new Error("You must be signed in to upload files.");
  validateMessageAttachment(file);

  let uploadFile: File | Blob = file;
  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    uploadFile = await imageCompression(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: file.type,
    });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `messages/${auth.currentUser.uid}/${conversationId}/${crypto.randomUUID()}-${safeName}`;
  const uploadTask = uploadBytesResumable(ref(storage, objectPath), uploadFile, {
    contentType: file.type,
    customMetadata: { originalName: file.name, conversationId },
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      resolve
    );
  });

  return {
    url: await getDownloadURL(uploadTask.snapshot.ref),
    type: file.type,
    name: file.name,
    size: file.size,
  };
}
