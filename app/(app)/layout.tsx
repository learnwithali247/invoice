import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SchemaMissing } from "@/components/schema-missing";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkSchema } from "@/lib/supabase/schema-check";
import { schemaProblem } from "@/lib/supabase/guard";
import { getAuthUser } from "@/lib/invoice/service";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupRequired />;

  // Shared with the page below via React cache() — one auth round trip, not two.
  const { user } = await getAuthUser();

  if (!user) redirect("/login");

  // Fail loudly and helpfully if the migration has not been applied yet,
  // instead of letting every query 500 with an opaque message.
  const report = await checkSchema();
  if (!report.ok) return <SchemaMissing report={report} />;

  // Belt and braces: the page guards itself too, because Next renders the
  // layout and the page concurrently.
  if (await schemaProblem()) return null;

  const { data: profile } = await (await createClient())
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<Pick<ProfileRow, "full_name">>();

  return (
    <AppShell
      user={{
        email: user.email ?? "",
        name: profile?.full_name ?? user.email?.split("@")[0] ?? "",
      }}
    >
      {children}
    </AppShell>
  );
}
