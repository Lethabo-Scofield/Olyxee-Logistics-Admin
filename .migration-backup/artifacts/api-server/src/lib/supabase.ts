import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

let cachedAdmin: SupabaseClient | null = null;

/**
 * Returns a Supabase client used to validate user JWTs and (optionally)
 * perform admin operations. Uses the service role key when available so RLS
 * is bypassed for trusted server-side calls; falls back to the anon key for
 * local/dev setups where only the public key is configured.
 *
 * Throws if no Supabase URL or key is configured — this surfaces missing env
 * vars early instead of silently returning 401s.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  if (!supabaseUrl) {
    throw new Error(
      "Supabase URL is not configured. Set VITE_SUPABASE_URL (or SUPABASE_URL).",
    );
  }

  const key = serviceRoleKey ?? anonKey;
  if (!key) {
    throw new Error(
      "Supabase key is not configured. Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY.",
    );
  }

  cachedAdmin = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}

/**
 * True when a Supabase service-role key is configured. The server will
 * still function with only the anon key, but admin-only operations will
 * fail.
 */
export function hasServiceRole(): boolean {
  return Boolean(serviceRoleKey);
}
