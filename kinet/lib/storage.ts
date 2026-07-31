import AWS from "aws-sdk";

// Cloudflare R2 client configuration (S3-compatible)
const r2Client = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  s3ForcePathStyle: true,
});

const R2_BUCKET = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export function generateFileName(originalName: string, userId: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split(".").pop() || "bin";
  return `${userId}/${timestamp}-${randomString}.${extension}`;
}

export async function uploadToR2(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string = "posts"
): Promise<string> {
  const key = `${folder}/${fileName}`;

  const params = {
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read",
  };

  await r2Client.upload(params).promise();

  return `${R2_PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(fileName: string, folder: string = "posts"): Promise<void> {
  const key = `${folder}/${fileName}`;
  const params = {
    Bucket: R2_BUCKET,
    Key: key,
  };

  await r2Client.deleteObject(params).promise();
}

// Alias for compatibility with code expecting Firebase Storage naming
export const uploadToFirebaseStorage = uploadToR2;
export const writeAuditLog = async (action: string, userId: string, details: Record<string, unknown>) => {
  // Placeholder - implement based on your audit logging needs
  console.log(`Audit: ${action} by ${userId}`, details);
};
