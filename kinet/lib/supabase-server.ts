import "server-only";

import { createClient } from "@supabase/supabase-js";

function cleanEnvironmentValue(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "").trim();
}

function getSupabaseProjectUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Supabase Storage URL is invalid. Use https://<project-ref>.supabase.co.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("Supabase Storage URL must be the project URL: https://<project-ref>.supabase.co.");
  }
  // createClient expects the project origin and adds /storage/v1 itself.
  return parsed.origin;
}

export function getSupabaseAdmin() {
  const configuredUrl = cleanEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const serviceRoleKey = cleanEnvironmentValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const missing: string[] = [];
  if (!configuredUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    const msg = `Supabase Storage is not configured on the server. Missing: ${missing.join(", ")}. See kinet/README_SUPABASE_STORAGE.md for setup.`;
    throw new Error(msg);
  }

  const url = getSupabaseProjectUrl(configuredUrl!);
  return createClient(url, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}
