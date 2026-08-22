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
  const prepared = await new Promise<{ path?: string; publicUrl?: string; error?: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const cancel = () => request.abort();

    request.open("POST", "/api/upload");
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(95, Math.round((event.loaded / event.total) * 95)));
    });
    request.addEventListener("load", () => {
      signal?.removeEventListener("abort", cancel);
      let result: { path?: string; publicUrl?: string; error?: string } = {};
      try {
        result = request.responseText ? JSON.parse(request.responseText) as typeof result : {};
      } catch {
        reject(new Error(`Upload failed (${request.status || "network error"}).`));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(result.error || `Upload failed (${request.status}).`));
        return;
      }
      resolve(result);
    });
    request.addEventListener("error", () => {
      signal?.removeEventListener("abort", cancel);
      reject(new Error("Upload failed because the connection was interrupted."));
    });
    request.addEventListener("abort", () => {
      signal?.removeEventListener("abort", cancel);
      reject(new Error("Upload canceled."));
    });
    signal?.addEventListener("abort", cancel, { once: true });
    onProgress?.(0);
    request.send(body);
  });
  if (!prepared.path || !prepared.publicUrl) throw new Error(prepared.error || "Moderated upload failed.");
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
