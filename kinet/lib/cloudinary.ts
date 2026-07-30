const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

function assertCloudinaryConfigured() {
  if (!cloudName) {
    throw new Error(
      "Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME."
    );
  }
}

export async function uploadToCloudinary(file: File, folder: string) {
  assertCloudinaryConfigured();

  // Get signature from backend
  const signatureResponse = await fetch("/api/cloudinary/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });

  if (!signatureResponse.ok) {
    const errorData = await signatureResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to get upload signature.");
  }

  const { signature, timestamp, apiKey } = await signatureResponse.json() as {
    signature: string;
    timestamp: number;
    apiKey: string;
    folder: string;
  };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = (await response.json()) as {
    secure_url?: string;
    public_id?: string;
    resource_type?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  }

  return {
    url: data.secure_url,
    publicId: data.public_id ?? "",
    resourceType: data.resource_type ?? "image",
  };
}
