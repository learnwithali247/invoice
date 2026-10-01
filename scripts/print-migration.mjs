/**
 * Prints the initial schema migration so it can be piped straight into
 * psql / the Supabase SQL editor.
 *
 *   npm run supabase:migrate
 *   npm run supabase:migrate | psql "$DATABASE_URL"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), "supabase/migrations/001_initial_schema.sql");
process.stdout.write(readFileSync(file, "utf8"));
