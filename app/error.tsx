"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SchemaMissing } from "@/components/schema-missing";
import type { SchemaReport } from "@/lib/supabase/schema-check";

/**
 * Global error boundary.
 *
 * Before showing a generic failure it checks whether the database schema is the
 * cause — that is by far the most common misconfiguration, and a generic 500
 * gives the user nothing to act on.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [report, setReport] = React.useState<SchemaReport | null>(null);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    console.error(error);

    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.schema && json.schema.ok === false && Array.isArray(json.schema.missingTables)) {
          setReport({
            ok: false,
            missingTables: json.schema.missingTables,
            errorCode: json.schema.errorCode ?? null,
            errorMessage: json.schema.errorMessage ?? null,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setChecked(true));

    return () => {
      cancelled = true;
    };
  }, [error]);

  if (report) return <SchemaMissing report={report} />;

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-ink-50 px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Something went wrong</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            An unexpected error occurred. Your data is safe — try again, and if it keeps happening
            check the server logs.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-2xs text-ink-400">ref: {error.digest}</p>
          ) : null}
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (checked) {
                  setReport(null);
                  reset();
                } else {
                  window.location.reload();
                }
              }}
            >
              Try again
            </Button>
            <a href="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
