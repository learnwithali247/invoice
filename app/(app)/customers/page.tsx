import type { Metadata } from "next";
import { CustomersView } from "@/components/dashboard/customers-view";
import { listCustomers, requireUser } from "@/lib/invoice/service";
import { schemaProblem } from "@/lib/supabase/guard";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  // The app shell already shows the setup screen when the schema is
  // missing; bail out quietly so we do not query tables that do not exist.
  if (await schemaProblem()) return null;

  const { user } = await requireUser();
  const customers = await listCustomers(user.id);
  return <CustomersView initial={customers} />;
}
