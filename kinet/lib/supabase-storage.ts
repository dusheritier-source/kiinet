import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.warn('Missing SUPABASE URL. Set NEXT_PUBLIC_SUPABASE_URL in your env.');
}

function createSafeClient(isServer = typeof window === 'undefined'): SupabaseClient {
  const url = SUPABASE_URL || '';

  if (isServer && SUPABASE_SERVICE_ROLE_KEY) {
    // Server-side client with elevated permissions (keep key secret)
    return createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }

  // Client-side / anonymous usage
  const anon = SUPABASE_ANON_KEY || '';
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

const client = createSafeClient();

export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob | Buffer | string,
  options?: { cacheControl?: string; upsert?: boolean }
) {
  const storage = client.storage.from(bucket);

  // For Node Buffer or base64 string, normalize
  let body: any = file as any;
  if (typeof window === 'undefined' && (file as any) instanceof Buffer) {
    body = file as Buffer;
  }

  // Default cache control heuristics: long cache for images/videos, shorter otherwise
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov', 'mkv'];
  let defaultCache = '3600';
  if (imageExts.includes(ext)) defaultCache = 'public, max-age=31536000, immutable';
  if (videoExts.includes(ext)) defaultCache = 'public, max-age=86400';

  const result = await storage.upload(path, body, {
    cacheControl: options?.cacheControl ?? defaultCache,
    upsert: options?.upsert ?? false,
    contentType: undefined,
  });

  if (result.error) {
    return { error: result.error, publicUrl: null };
  }

  const publicUrl = getPublicUrl(bucket, path);
  return { error: null, publicUrl };
}

export async function deleteFile(bucket: string, path: string) {
  const storage = client.storage.from(bucket);
  const result = await storage.remove([path]);
  return result;
}

export function getPublicUrl(bucket: string, path: string) {
  const url = SUPABASE_URL || '';
  // Use Supabase storage public URL pattern
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(
    path
  )}`;
}

export default client;
