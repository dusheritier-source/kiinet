"use client";

import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function generateFileName(originalName: string, userId: string) {
  const extension = originalName.split(".").pop() || "bin";
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

export async function uploadToFirebaseStorage(file: File, folder: string, onProgress?: (progress: number) => void, signal?: AbortSignal) {
  if (!storage) throw new Error("Firebase Storage is not configured.");
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const reference = ref(storage, path);
  if (onProgress || signal) {
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(reference, file, { contentType: file.type || "application/octet-stream" });
      const cancel = () => task.cancel();
      if (signal?.aborted) { task.cancel(); reject(new Error("Upload canceled.")); return; }
      signal?.addEventListener("abort", cancel, { once: true });
      task.on("state_changed", (snapshot) => {
        onProgress?.(snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0);
      }, (error) => { signal?.removeEventListener("abort", cancel); reject(error); }, () => { signal?.removeEventListener("abort", cancel); resolve(); });
    });
  } else {
    await uploadBytes(reference, file, { contentType: file.type || "application/octet-stream" });
  }
  return { url: await getDownloadURL(reference), path };
}

export async function uploadToR2(file: File, folder: string) {
  return uploadToFirebaseStorage(file, folder);
}

export const writeAuditLog = async (action: string, userId: string, details: Record<string, unknown>) => {
  console.log(`Audit: ${action} by ${userId}`, details);
};
