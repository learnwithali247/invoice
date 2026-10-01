import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Uses ONLY the publishable (public) key, which is
 * safe to ship to the client. The secret/service key never appears here.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local",
    );
  }

  return createBrowserClient(url, key);
}
