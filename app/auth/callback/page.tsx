"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * /auth/callback — the landing point for every link Supabase emails out
 * (address confirmation, magic links, password recovery).
 *
 * This has to be a **client** page, not a route handler. Supabase's default
 * email template returns the tokens in a URL *fragment*:
 *
 *     https://site/auth/callback#access_token=...&refresh_token=...
 *
 * A fragment is never transmitted to the server, so no route handler can read
 * it — a server route would see a bare `/auth/callback` with nothing in it and
 * could never establish the session. Here the browser has the tokens, so the
 * exchange happens client-side and the cookie it writes is picked up by the very
 * next navigation.
 *
 * The PKCE flow (`?code=...`, which is a query parameter and *is* visible to the
 * server) is handled explicitly, so both styles work.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  React.useEffect(() => {
    let cancelled = false;

    async function complete() {
      const supabase = createClient();

      // Where to go next. Only same-origin relative paths, so this can never be
      // used as an open redirect.
      const requested = params.get("next");
      const next =
        requested && requested.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/dashboard";

      try {
        // PKCE: the code is in the query string, exchange it for a session.
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Implicit / token_hash: createBrowserClient has detectSessionInUrl on
        // by default, so it parses the fragment and writes the cookie itself.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          const { error: refreshed } = await supabase.auth.refreshSession();
          if (refreshed) throw refreshed;
        }

        const { data: after } = await supabase.auth.getSession();
        if (!after.session) {
          router.replace("/login?error=invalid_token");
          return;
        }

        // The cookie now exists, so this navigation passes middleware.
        router.replace(next);
        router.refresh();
      } catch (error) {
        console.error("[auth/callback] could not establish a session:", error);
        if (!cancelled) router.replace("/login?error=invalid_token");
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" aria-hidden />
      <p className="text-sm text-ink-600">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" aria-hidden />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}