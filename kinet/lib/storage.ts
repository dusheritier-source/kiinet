"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function generateFileName(originalName: string, userId: string) {
  const extension = originalName.split(".").pop() || "bin";
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

export async function uploadToFirebaseStorage(file: File, folder: string) {
  if (!storage) throw new Error("Firebase Storage is not configured.");
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const reference = ref(storage, path);
  await uploadBytes(reference, file, { contentType: file.type || "application/octet-stream" });
  return { url: await getDownloadURL(reference), path };
}

export async function uploadToR2(file: File, folder: string) {
  return uploadToFirebaseStorage(file, folder);
}

export const writeAuditLog = async (action: string, userId: string, details: Record<string, unknown>) => {
  console.log(`Audit: ${action} by ${userId}`, details);
};
