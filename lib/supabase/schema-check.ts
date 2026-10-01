import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Everything the migration is expected to have created. */
export const REQUIRED_TABLES = [
  "profiles",
  "business_settings",
  "customers",
  "invoices",
  "invoice_items",
  "invoice_templates",
  "payment_transactions",
] as const;

export type SchemaReport = {
  ok: boolean;
  missingTables: string[];
  /** PostgREST / Postgres error code, when the check itself failed. */
  errorCode: string | null;
  errorMessage: string | null;
};

const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01", "PGRST200"]);

function isMissingTable(code: string | undefined): boolean {
  return Boolean(code && MISSING_TABLE_CODES.has(code));
}

/**
 * Detects an un-migrated database.
 *
 * PostgREST reports an unknown relation as PGRST205 ("not in the schema cache"),
 * which is the exact symptom you get right after signing up but before running
 * the migration.
 *
 * Performance: this runs on every navigation via the app shell, so
 *   • the probe stops at the FIRST table that answers — one request, not seven;
 *   • a healthy result is cached for 10 minutes, a broken one for only 5 seconds
 *     so applying the migration is picked up almost immediately.
 */
type Cache = { at: number; ttlMs: number; value: SchemaReport } | null;

let cached: Cache = null;

export async function checkSchema(options: { fresh?: boolean } = {}): Promise<SchemaReport> {
  const entry = cached;
  if (!options.fresh && entry && Date.now() - entry.at < entry.ttlMs) return entry.value;

  const value = await probe();
  cached = { at: Date.now(), ttlMs: value.ok ? 10 * 60_000 : 5_000, value };
  return value;
}

/** Forces the next checkSchema() to hit the database again. */
export function invalidateSchemaCache() {
  cached = null;
}

async function probe(): Promise<SchemaReport> {
  const missing: string[] = [];
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();

    for (const table of REQUIRED_TABLES) {
      // NOTE: a plain GET is required here. `head: true` / `count: "exact"`
      // makes supabase-js return `error: null` even when PostgREST answers
      // 404 PGRST205, which would hide an un-migrated database.
      const { error } = await supabase.from(table).select("id").limit(1);
      if (!error) {
        // The migration creates every table together, so the first table that
        // answers proves the schema is there. One round trip on the happy path.
        break;
      }
      if (isMissingTable(error.code)) {
        missing.push(table);
        continue;
      }
      // Some other failure (RLS, network, perms) — remember it for the report.
      errorCode ??= error.code ?? null;
      errorMessage ??= error.message ?? null;
    }

    // The trigger-created profile row is a cheap second signal: if the tables
    // exist but the signup trigger does not, the user is missing settings.
    if (missing.length === 0) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: settings } = await supabase
          .from("business_settings")
          .select("id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (!settings) {
          errorCode = "MISSING_BUSINESS_SETTINGS";
          errorMessage =
            "Your account has no business settings row. The signup trigger may not have run — re-run the migration.";
        }
      }
    }
  } catch (error) {
    errorCode = "UNREACHABLE";
    errorMessage = error instanceof Error ? error.message : "Could not reach Supabase.";
  }

  return {
    ok: missing.length === 0 && errorCode === null,
    missingTables: missing,
    errorCode,
    errorMessage,
  };
}
