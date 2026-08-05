import { NextResponse } from "next/server";

import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const allowedTypes = /^(image|video|audio)\//;

export async function POST(request: Request) {
  try {
    const user = await getFirebaseUserFromRequest(request);
    if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = await request.json() as { name?: string; contentType?: string; folder?: string; size?: number };
    const contentType = String(input.contentType ?? "");
    const size = Number(input.size ?? 0);
    if (!allowedTypes.test(contentType)) return NextResponse.json({ error: "Unsupported media type." }, { status: 400 });
    if (!size || size > 50 * 1024 * 1024) return NextResponse.json({ error: "Files must be smaller than 50 MB." }, { status: 400 });
    const safeFolder = String(input.folder ?? "posts").replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "") || "posts";
    const safeName = String(input.name ?? "upload.bin").replace(/[^a-z0-9._-]/gi, "-");
    const path = `${safeFolder}/${user.uid}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "kinet-media";
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data?.token) throw new Error(error?.message || "Could not create a Supabase upload token.");
    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ bucket, path, token: data.token, publicUrl: publicData.publicUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare upload." }, { status: 500 });
  }
}
