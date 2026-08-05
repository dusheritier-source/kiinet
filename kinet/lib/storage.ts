"use client";

import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function generateFileName(originalName: string, userId: string) {
  const extension = originalName.split(".").pop() || "bin";
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

export async function uploadToFirebaseStorage(file: File, folder: string, onProgress?: (progress: number) => void, signal?: AbortSignal) {
  if (!storage) throw new Error("Firebase Storage is not configured.");
  if (signal?.aborted) throw new Error("Upload canceled.");
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const reference = ref(storage, path);
  const metadata = { contentType: file.type || "application/octet-stream" };
  if (onProgress || signal) {
    onProgress?.(1);
    const resumableCompleted = await new Promise<boolean>((resolve, reject) => {
      const task = uploadBytesResumable(reference, file, metadata);
      let stalled = false;
      let stallTimer = setTimeout(() => { stalled = true; task.cancel(); }, 12_000);
      const resetStallTimer = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => { stalled = true; task.cancel(); }, 12_000);
      };
      const cancel = () => { clearTimeout(stallTimer); task.cancel(); };
      signal?.addEventListener("abort", cancel, { once: true });
      task.on("state_changed", (snapshot) => {
        resetStallTimer();
        const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 1;
        onProgress?.(Math.max(1, Math.min(99, percent)));
      }, (error) => {
        clearTimeout(stallTimer);
        signal?.removeEventListener("abort", cancel);
        if (signal?.aborted) reject(new Error("Upload canceled."));
        else if (stalled) resolve(false);
        else if (String((error as { code?: string }).code ?? "").includes("unauthorized")) reject(new Error("Firebase Storage rejected this upload. Deploy the latest storage rules and try again."));
        else reject(error);
      }, () => {
        clearTimeout(stallTimer);
        signal?.removeEventListener("abort", cancel);
        resolve(true);
      });
    });

    if (!resumableCompleted) {
      onProgress?.(5);
      if (signal?.aborted) throw new Error("Upload canceled.");
      let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        const fallbackTimeout = new Promise<never>((_, reject) => {
          fallbackTimer = setTimeout(() => reject(new Error("The upload connection timed out. Check your internet connection and try again.")), 45_000);
        });
        await Promise.race([uploadBytes(reference, file, metadata), fallbackTimeout]);
      } finally {
        if (fallbackTimer) clearTimeout(fallbackTimer);
      }
      if (signal?.aborted) throw new Error("Upload canceled.");
    }
    onProgress?.(100);
  } else {
    await uploadBytes(reference, file, metadata);
  }
  try {
    return { url: await getDownloadURL(reference), path };
  } catch (error) {
    const code = String((error as { code?: string })?.code ?? "");
    if (code.includes("unauthorized")) throw new Error("Firebase Storage rejected this upload. Deploy the latest storage rules and try again.");
    throw error;
  }
}

export async function uploadToR2(file: File, folder: string) {
  return uploadToFirebaseStorage(file, folder);
}

export const writeAuditLog = async (action: string, userId: string, details: Record<string, unknown>) => {
  console.log(`Audit: ${action} by ${userId}`, details);
};
