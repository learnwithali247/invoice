import type { Metadata } from "next";
import { InvoiceEditor } from "@/components/invoice/invoice-editor";
import {
  getBusinessSettings,
  requireUser,
  signedLogoUrl,
} from "@/lib/invoice/service";
import {
  buildNewInvoice,
  businessRowToInfo,
  localId,
  emptyItem,
} from "@/lib/invoice/mappers";
import { INVOICE_TYPES, INVOICE_TYPE_META, type InvoiceType } from "@/lib/invoice/types";
import { availableProviders, paymentMode } from "@/lib/payments";
import { schemaProblem } from "@/lib/supabase/guard";

export const metadata: Metadata = { title: "New invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  if (await schemaProblem()) return null;

  const { type } = await searchParams;
  const { user } = await requireUser();
  const settings = await getBusinessSettings(user.id);

  const invoiceType: InvoiceType = INVOICE_TYPES.includes(type as InvoiceType)
    ? (type as InvoiceType)
    : "standard";

  const draft = buildNewInvoice({
    business: settings,
    invoiceNumber: "",
    invoiceType,
  });

  // Apply the type's own defaults (proforma disables online payment, etc.)
  const defaults = INVOICE_TYPE_META[invoiceType].defaults;
  Object.assign(draft, defaults);
  draft.invoiceType = invoiceType;
  draft.id = null;
  draft.invoiceNumber = "";
  draft.items = [emptyItem()];
  draft.customer.id = null;
  draft.customer.name = "";
  draft.publicToken = "";

  const logoUrl = await signedLogoUrl(settings?.logo_path ?? null);
  const business = businessRowToInfo(settings);
  business.logoUrl = logoUrl;

  return (
    <InvoiceEditor
      key={`new-${localId()}`}
      initialDraft={draft}
      business={business}
      paymentAvailability={{ mode: paymentMode().mode, providers: availableProviders() }}
      serverUpdatedAt={null}
      isNew
    />
  );
}

