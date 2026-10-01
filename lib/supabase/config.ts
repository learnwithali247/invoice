/** True when the public Supabase credentials are present in the environment. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Server-only: the secret/service key is required for admin operations. */
export function isServiceRoleConfigured(): boolean {
  return Boolean(isSupabaseConfigured() && process.env.SUPABASE_SECRET_KEY);
}

export const MISSING_ENV_MESSAGE =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local";
