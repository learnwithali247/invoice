import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Service-role client. Bypasses RLS — ONLY ever use it in server-side code
 * (webhooks, seeds, signed-URL minting) after you have verified the caller.
 *
 * `SUPABASE_SECRET_KEY` is read from a server-only env var and is never
 * included in any client bundle or API response.
 */
export function createAdminClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Server Supabase credentials are missing. Set SUPABASE_SECRET_KEY in .env.local (Dashboard → Project Settings → API Keys).",
    );
  }

  cached = createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cached;
}
