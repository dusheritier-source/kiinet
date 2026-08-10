import "server-only";

import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    const msg = `Supabase Storage is not configured on the server. Missing: ${missing.join(", ")}. See kinet/README_SUPABASE_STORAGE.md for setup.`;
    throw new Error(msg);
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
