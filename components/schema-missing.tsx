"use client";

import * as React from "react";
import { Database, ExternalLink, FileCode2, RefreshCw, Terminal, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SchemaReport } from "@/lib/supabase/schema-check";

/**
 * Shown when Supabase is reachable but the schema has not been created yet.
 * Explains the fix instead of showing a generic 500.
 */
export function SchemaMissing({ report }: { report: SchemaReport }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = supabaseUrl.replace(/^https?:\/\//, "").split(".")[0];
  const [checking, setChecking] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<string | null>(null);

  /**
   * Hits /api/health first: that endpoint forces a fresh schema probe and
   * refreshes the server's 30 s cache, so the reload below is never served a
   * stale "not set up" answer right after the migration was applied.
   */
  async function recheck() {
    if (checking) return;
    setChecking(true);
    setLastResult(null);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const json = await response.json();
      if (json?.schema?.ok) {
        window.location.reload();
        return;
      }
      setLastResult(
        json?.schema?.missingTables?.length
          ? `Still missing: ${json.schema.missingTables.join(", ")}`
          : "Still not ready. If you just ran the migration, wait a few seconds for the PostgREST schema cache and try again.",
      );
    } catch {
      setLastResult("Could not reach the server. Is it still running?");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main id="main" className="min-h-dvh bg-ink-50 px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-subtle sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <TriangleAlert className="h-5 w-5" aria-hidden />
          </div>

          <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink-900">
            Your database is not set up yet
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Supabase is connected and authentication works — but the invoice tables do not exist
            yet, so there is nothing to read or write.
          </p>

          {report.missingTables.length > 0 ? (
            <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-4">
              <p className="text-xs font-semibold text-ink-800">Missing tables</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {report.missingTables.map((table) => (
                  <Badge key={table} tone="warning">
                    <code className="font-mono">{table}</code>
                  </Badge>
                ))}
              </div>
            </div>
          ) : report.errorCode ? (
            <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-4">
              <p className="text-xs font-semibold text-ink-800">Database check</p>
              <p className="mt-1 font-mono text-2xs break-words text-ink-600">
                {report.errorCode}
                {report.errorMessage ? ` — ${report.errorMessage}` : ""}
              </p>
            </div>
          ) : null}

          <div className="mt-5 rounded-lg border border-ink-200 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
              <Terminal className="h-3.5 w-3.5" aria-hidden />
              Apply the migration
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-ink-600">
              <li>
                Open the SQL editor for your project
                {projectRef ? (
                  <>
                    {" "}
                    (
                    <a
                      className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                      href={`https://supabase.com/dashboard/project/${projectRef}/sql`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {projectRef}
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                    )
                  </>
                ) : null}
                .
              </li>
              <li>
                Paste the whole contents of{" "}
                <code className="rounded bg-ink-100 px-1 font-mono">supabase/migrations/001_initial_schema.sql</code>{" "}
                — you can print it with <code className="rounded bg-ink-100 px-1 font-mono">npm run supabase:migrate</code>.
              </li>
              <li>Click <span className="font-medium">Run</span>. It is safe to run more than once.</li>
              <li>
                Come back here — nothing else is needed, no restart required.
              </li>
            </ol>
          </div>

          <details className="mt-4 rounded-lg border border-ink-200">
            <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-xs font-medium text-ink-700">
              <FileCode2 className="h-3.5 w-3.5" aria-hidden />
              Prefer the Supabase CLI?
            </summary>
            <div className="border-t border-ink-200 px-4 py-3">
              <pre className="overflow-x-auto rounded bg-ink-950 px-3 py-2.5 font-mono text-2xs leading-relaxed text-ink-100">
{`supabase link --project-ref ${projectRef || "<project-ref>"}
supabase db push        # or: supabase db reset`}
              </pre>
            </div>
          </details>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={recheck} loading={checking} loadingText="Checking…">
              {!checking ? <RefreshCw className="h-4 w-4" aria-hidden /> : null}
              Check again
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = "/dashboard"; }}>
              Go to dashboard
            </Button>
          </div>

          {lastResult ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-2xs leading-relaxed font-medium text-amber-800">
              {lastResult}
            </p>
          ) : null}

          <p className="mt-4 flex items-start gap-1.5 text-2xs leading-relaxed text-ink-500">
            <Database className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            The migration creates tables, indexes, foreign keys, row level security, the private
            logo storage bucket and the server-side calculation functions. It never deletes your
            auth users.
          </p>
        </div>
      </div>
    </main>
  );
}
