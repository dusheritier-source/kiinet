"use client";

import { auth } from "@/lib/firebase";

export function generateFileName(originalName: string, userId: string) {
  const extension = originalName.split(".").pop() || "bin";
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

export async function uploadToFirebaseStorage(file: File, folder: string, onProgress?: (progress: number) => void, signal?: AbortSignal) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again before uploading.");
  const token = await user.getIdToken(true);
  if (signal?.aborted) throw new Error("Upload canceled.");
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder.replace(/^Kinet\//, ""));
  body.append("purpose", folder);
  onProgress?.(5);
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
    signal,
  });
  let prepared: { path?: string; publicUrl?: string; error?: string } | null = null;
  try {
    prepared = await response.json() as { path?: string; publicUrl?: string; error?: string };
  } catch (err) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${text}`);
  }
  if (!response.ok || !prepared.path || !prepared.publicUrl) throw new Error(prepared.error || "Moderated upload failed.");
  if (signal?.aborted) throw new Error("Upload canceled.");
  onProgress?.(100);
  return { url: prepared.publicUrl, path: prepared.path };
}

export async function deleteModeratedUpload(path: string) {
  const user = auth.currentUser;
  if (!user) return;
  const token = await user.getIdToken();
  await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ path }),
  });
}

export const writeAuditLog = async (action: string, userId: string, details: Record<string, unknown>) => {
  console.log(`Audit: ${action} by ${userId}`, details);
};
