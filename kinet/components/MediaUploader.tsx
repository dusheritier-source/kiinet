"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadFile, getPublicUrl } from "@/lib/supabase-storage";

type UploadItem = {
  file: File;
  status: "idle" | "uploading" | "done" | "error";
  publicUrl?: string | null;
  error?: string | null;
};

export default function MediaUploader({ folder = "uploads" }: { folder?: string }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).map((f) => ({ file: f, status: "idle" as const }));
    setItems((s) => s.concat(list));
  }

  async function handleUploadAll() {
    setIsUploading(true);
    const next = [...items];
    for (let i = 0; i < next.length; i++) {
      const item = next[i];
      if (item.status === "done") continue;
      item.status = "uploading";
      setItems([...next]);
      try {
        const ext = item.file.name.split('.').pop() || '';
        const name = `${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;
        const path = `${folder}/${name}`;
        const res = await uploadFile('kinet-media', path, item.file, { upsert: false });
        if (res.error) {
          item.status = "error";
          item.error = res.error.message ?? String(res.error);
        } else {
          item.status = "done";
          item.publicUrl = res.publicUrl ?? getPublicUrl('kinet-media', path);
        }
      } catch (err: any) {
        item.status = "error";
        item.error = err?.message ?? String(err);
      }
      setItems([...next]);
    }
    setIsUploading(false);
  }

  function removeIndex(idx: number) {
    setItems((s) => s.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium">{it.file.name}</div>
                <div className="text-xs text-muted-foreground">{it.status}</div>
              </div>
              <div className="flex items-center gap-2">
                {it.publicUrl ? (
                  <a href={it.publicUrl} target="_blank" rel="noreferrer" className="text-primary text-xs">
                    View
                  </a>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => removeIndex(idx)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button onClick={handleUploadAll} disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload all"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
