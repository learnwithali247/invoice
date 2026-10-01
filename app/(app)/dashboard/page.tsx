import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { listQuerySchema } from "@/lib/validation/schemas";
import { listInvoices, dashboardSummary, requireUser } from "@/lib/invoice/service";
import { schemaProblem } from "@/lib/supabase/guard";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : (v ?? "")]),
  );
  // The app shell already shows the setup screen when the schema is
  // missing; bail out quietly so we do not query tables that do not exist.
  if (await schemaProblem()) return null;

  const query = listQuerySchema.parse(flat);

  const { user } = await requireUser();

  const [invoices, totals] = await Promise.all([
    listInvoices(user.id, query),
    dashboardSummary(user.id),
  ]);

  return (
    <DashboardView
      initial={invoices}
      summary={totals.totalsByCurrency}
      initialQuery={{ ...flat, page: String(query.page) }}
    />
  );
}
