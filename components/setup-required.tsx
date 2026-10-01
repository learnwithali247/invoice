import { FileWarning, Terminal } from "lucide-react";

/**
 * Shown instead of a crash when the environment is not configured yet.
 * Keeps `next build` and a fresh clone usable before secrets exist.
 */
export function SetupRequired() {
  return (
    <main
      id="main"
      className="flex min-h-dvh items-center justify-center bg-ink-50 px-5 py-10"
    >
      <div className="w-full max-w-xl rounded-xl border border-ink-200 bg-white p-6 shadow-subtle sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <FileWarning className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink-900">
          One step before you can start
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          The Supabase credentials are missing, so the app cannot talk to the database yet.
        </p>

        <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
            <Terminal className="h-3.5 w-3.5" aria-hidden />
            Do this
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ink-600">
            <li>
              Copy <code className="rounded bg-white px-1 font-mono">.env.example</code> to{" "}
              <code className="rounded bg-white px-1 font-mono">.env.local</code>.
            </li>
            <li>
              Set <code className="rounded bg-white px-1 font-mono">SUPABASE_SECRET_KEY</code> in{" "}
              <code className="rounded bg-white px-1 font-mono">.env.local</code> (Supabase → Project
              Settings → API Keys → Secret key).
            </li>
            <li>
              Run the SQL in{" "}
              <code className="rounded bg-white px-1 font-mono">
                supabase/migrations/001_initial_schema.sql
              </code>{" "}
              in the Supabase SQL editor.
            </li>
            <li>
              Restart the dev server (<code className="rounded bg-white px-1 font-mono">npm run dev</code>).
            </li>
          </ol>
        </div>

        <p className="mt-4 text-2xs leading-relaxed text-ink-500">
          The publishable key is safe to commit. The secret key and every payment key must stay on the
          server and out of version control.
        </p>
      </div>
    </main>
  );
}
