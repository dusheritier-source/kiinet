"use client";

import { useEffect, useState } from "react";

export default function TestEnvPage() {
  const [envVars, setEnvVars] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    setEnvVars({
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    });
  }, []);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Test</h1>
      <div className="space-y-4">
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold mb-2">Cloudinary Configuration:</h2>
          <p><strong>Cloud Name:</strong> {envVars.cloudName || "❌ NOT SET"}</p>
          <p><strong>Upload Preset:</strong> {envVars.uploadPreset || "❌ NOT SET"}</p>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold mb-2">Status:</h2>
          {envVars.cloudName && envVars.uploadPreset ? (
            <p className="text-green-600">✅ Cloudinary is configured!</p>
          ) : (
            <p className="text-red-600">❌ Cloudinary is NOT configured. Add env vars in Vercel.</p>
          )}
        </div>
      </div>
    </div>
  );
}