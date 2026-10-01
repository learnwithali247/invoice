import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBusinessSettings,
  getInvoice,
  requireUser,
  signedLogoUrl,
} from "@/lib/invoice/service";
import { businessRowToInfo, invoiceToDraft, toRenderModel } from "@/lib/invoice/mappers";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintAutoRun } from "@/components/invoice/print-auto-run";
import { schemaProblem } from "@/lib/supabase/guard";

export const metadata: Metadata = { title: "Print invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  if (await schemaProblem()) return null;

  const { id } = await params;
  const { user } = await requireUser();

  // Parallel: the invoice and the business profile are independent reads.
  const [found, settings] = await Promise.all([
    getInvoice(id),
    getBusinessSettings(user.id),
  ]);
  if (!found) notFound();

  const logoUrl = await signedLogoUrl(settings?.logo_path ?? null);
  const business = businessRowToInfo(settings);
  business.logoUrl = logoUrl;

  const draft = invoiceToDraft(found.invoice, found.items);
  const model = toRenderModel(draft, business, found.invoice.currency_symbol);

  return (
    <div className="min-h-dvh bg-white">
      <PrintAutoRun pageSize={model.design.pageSize} />
      <div className="print-root flex justify-center overflow-x-auto py-6">
        <div className="print-sheet invoice-sheet">
          <InvoiceDocument model={model} showPayButton={false} />
        </div>
      </div>
      <div className="no-print fixed inset-x-0 bottom-0 border-t border-ink-200 bg-white/95 px-4 py-3 text-center backdrop-blur">
        <p className="text-xs text-ink-500">
          Choose “Save as PDF” in the print dialog, or cancel to go back.
        </p>
      </div>
    </div>
  );
}
