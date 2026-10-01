import type { Metadata } from "next";
import { SettingsView } from "@/components/dashboard/settings-view";
import { getBusinessSettings, requireUser, signedLogoUrl } from "@/lib/invoice/service";
import { availableProviders, paymentMode } from "@/lib/payments";
import { emailStatus } from "@/lib/email";
import { absoluteUrl } from "@/lib/utils";
import { schemaProblem } from "@/lib/supabase/guard";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // The app shell already shows the setup screen when the schema is
  // missing; bail out quietly so we do not query tables that do not exist.
  if (await schemaProblem()) return null;

  const { user } = await requireUser();
  const settings = await getBusinessSettings(user.id);
  const logoUrl = await signedLogoUrl(settings?.logo_path ?? null);
  const origin = absoluteUrl("");

  return (
    <SettingsView
      initial={settings}
      logoUrl={logoUrl}
      userEmail={user.email ?? ""}
      payments={{
        mode: paymentMode().mode,
        appUrl: origin,
        providers: availableProviders(),
        email: emailStatus(),
        webhookUrls: [
          `${origin}/api/payments/webhook/stripe`,
          `${origin}/api/payments/webhook/paypal`,
        ],
      }}
    />
  );
}
