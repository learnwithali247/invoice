import "server-only";
import { checkSchema, type SchemaReport } from "./schema-check";

/**
 * Page-level guard.
 *
 * Next.js renders a layout and its page concurrently, so the app shell showing
 * the "database is not set up yet" screen does not stop the page itself from
 * querying a database that has no tables. Pages that read the database call
 * this first and bail out quietly, which avoids a burst of doomed requests and
 * a screenful of stack traces for a problem the user can see is already
 * explained above them.
 *
 * `checkSchema()` is memoised, so this is effectively free.
 */
export async function schemaProblem(): Promise<SchemaReport | null> {
  const report = await checkSchema().catch(() => null);
  if (!report) return null;
  return report.ok ? null : report;
}
