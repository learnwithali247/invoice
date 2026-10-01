import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/invoice/invoice-editor";
import {
  getBusinessSettings,
  getInvoice,
  requireUser,
  signedLogoUrl,
} from "@/lib/invoice/service";
import { businessRowToInfo, invoiceToDraft } from "@/lib/invoice/mappers";
import { availableProviders, paymentMode } from "@/lib/payments";
import { schemaProblem } from "@/lib/supabase/guard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (await schemaProblem()) return { title: "Invoice" };

  const found = await getInvoice(id).catch(() => null);
  return { title: found ? `Edit ${found.invoice.invoice_number}` : "Invoice" };
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (await schemaProblem()) return null;

  const { id } = await params;
  const { user } = await requireUser();

  // Independent queries — run them together. Every Supabase round trip costs
  // several hundred milliseconds, so serialising them is felt immediately.
  const [found, settings] = await Promise.all([
    getInvoice(id),
    getBusinessSettings(user.id),
  ]);
  if (!found) notFound();

  const logoUrl = await signedLogoUrl(settings?.logo_path ?? null);
  const business = businessRowToInfo(settings);
  business.logoUrl = logoUrl;

  const draft = invoiceToDraft(found.invoice, found.items);

  return (
    <InvoiceEditor
      initialDraft={draft}
      business={business}
      paymentAvailability={{ mode: paymentMode().mode, providers: availableProviders() }}
      serverUpdatedAt={found.invoice.updated_at}
      isNew={false}
    />
  );
}
