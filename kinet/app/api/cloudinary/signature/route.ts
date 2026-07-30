import { NextRequest, NextResponse } from "next/server";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

function assertCloudinaryConfigured() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Cloudinary is not configured on the server. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to .env.local"
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCloudinaryConfigured();

    const body = await request.json();
    const { folder } = body;

    if (!folder || typeof folder !== "string") {
      return NextResponse.json(
        { error: "Folder is required" },
        { status: 400 }
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    
    // Create signature for unsigned upload with folder
    const params = new URLSearchParams();
    params.append("folder", folder);
    params.append("timestamp", timestamp.toString());
    
    const stringToSign = Array.from(params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("&") + CLOUDINARY_API_SECRET;

    const signature = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(stringToSign)
    );

    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureHex = signatureArray
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return NextResponse.json({
      signature: signatureHex,
      timestamp,
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      folder,
    });
  } catch (error) {
    console.error("Error generating Cloudinary signature:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate signature" },
      { status: 500 }
    );
  }
}