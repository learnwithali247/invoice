/**
 * Applies supabase/migrations/001_initial_schema.sql to your Supabase project
 * using the Management API — no copy/paste into the dashboard SQL editor.
 *
 *   1. Create a personal access token:
 *        https://supabase.com/dashboard/account/tokens
 *   2. Put it in .env.local:
 *        SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx
 *   3. Run:
 *        npm run db:push
 *
 * The token is only ever read from your local .env.local and sent to
 * api.supabase.com. It is never bundled, logged or committed.
 *
 * The script prints the real Postgres error if the SQL fails, then verifies the
 * schema through PostgREST so you know it worked.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* -------------------------------------------------------------------------- */

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const MIGRATION = resolve(process.cwd(), "supabase/migrations/001_initial_schema.sql");

const TABLES = [
  "profiles",
  "business_settings",
  "customers",
  "invoices",
  "invoice_items",
  "invoice_templates",
  "payment_transactions",
];

/* -------------------------------------------------------------------------- */

/**
 * Reports a failure and unwinds.
 *
 * Sets `process.exitCode` and throws instead of calling `process.exit()`,
 * which crashes with a libuv assertion on Windows when a socket is still open.
 */
class HandledFailure extends Error {}

function fail(message, extra = "") {
  console.error(`\n✖ ${message}\n`);
  if (extra) console.error(`${extra}\n`);
  process.exitCode = 1;
  throw new HandledFailure(message);
}

/* -------------------------------------------------------------------------- */

function preflight() {
  if (!SUPA_URL || !PUBLISHABLE) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing.",
      "Add them to .env.local.",
    );
  }

  const projectRef = SUPA_URL.replace(/^https?:\/\//, "").split(".")[0];

  if (!TOKEN) {
    fail(
      "SUPABASE_ACCESS_TOKEN is not set.",
      [
        "  This token lets the script run the migration for you. It is used once,",
        "  read only from your local .env.local, and never committed.",
        "",
        "  1. Create one:  https://supabase.com/dashboard/account/tokens",
        "  2. Add to .env.local:",
        "        SUPABASE_ACCESS_TOKEN=sbp_…",
        "",
        "  Alternatively, skip this script and paste",
        "  supabase/migrations/001_initial_schema.sql into the dashboard SQL editor:",
        `        https://supabase.com/dashboard/project/${projectRef}/sql`,
      ].join("\n"),
    );
  }

  if (!/^sbp_/.test(TOKEN)) {
    fail(
      "SUPABASE_ACCESS_TOKEN does not look like a personal access token (expected it to start with `sbp_`).",
      "Create one at https://supabase.com/dashboard/account/tokens",
    );
  }

  if (!existsSync(MIGRATION)) {
    fail(`Migration file not found: ${MIGRATION}`);
  }

  return { projectRef, sql: readFileSync(MIGRATION, "utf8") };
}

/* -------------------------------------------------------------------------- */

async function main() {
  const { projectRef, sql } = preflight();

  console.log(`\nApplying supabase/migrations/001_initial_schema.sql to ${projectRef}…\n`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = [
        parsed.message ?? parsed.error ?? text,
        parsed.hint ? `hint: ${parsed.hint}` : "",
        parsed.details ? `details: ${parsed.details}` : "",
        parsed.code ? `code: ${parsed.code}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch {
      /* keep raw text */
    }
    fail(
      `The migration failed (HTTP ${response.status}).`,
      [
        "  Postgres said:",
        detail
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n"),
        "",
        "  The full SQL is in supabase/migrations/001_initial_schema.sql",
      ].join("\n"),
    );
  }

  console.log("✔ SQL executed.");

  // verify through PostgREST
  const missing = [];
  for (const table of TABLES) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}` },
    });
    if (res.status !== 200) missing.push(table);
  }

  if (missing.length) {
    fail(
      `The SQL ran but these tables are still missing: ${missing.join(", ")}`,
      "Wait a few seconds for the PostgREST schema cache to refresh, then run this again.",
    );
  }

  console.log("✔ All 7 tables are present.\n");
  console.log(
    [
      "Next:",
      "  npm run seed     # optional — creates the demo account and sample invoices",
      "  npm run dev      # then open the URL it prints",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  if (error instanceof HandledFailure) return;
  fail("Could not reach the Supabase Management API.", error?.message ?? String(error));
});
