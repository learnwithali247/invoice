import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Lock } from "lucide-react";
import { loadPublicInvoice } from "@/lib/invoice/public";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { formatMoney } from "@/lib/invoice/calculate";
import { formatDate } from "@/lib/invoice/date";
import { calculateTotals } from "@/lib/invoice/calculate";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/invoice/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicInvoice(token).catch(() => null);
  if (!data) return { title: "Invoice not found", robots: { index: false, follow: false } };
  return {
    title: `${data.model.invoiceNumber} · ${data.model.business.businessName || "Invoice"}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadPublicInvoice(token).catch(() => null);
  if (!data) notFound();

  const { model } = data;
  const totals = calculateTotals({
    items: model.items,
    discountType: model.discountType,
    discountValue: model.discountValue,
    shipping: model.shipping,
    fees: model.fees,
    adjustment: model.adjustment,
    amountPaid: model.amountPaid,
  });

  return (
    <div className="min-h-dvh bg-ink-100 py-6">
      <header className="mx-auto mb-4 flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
            <Lock className="h-3 w-3" aria-hidden />
            Secure invoice link
          </p>
          <h1 className="mt-1 truncate text-sm font-semibold text-ink-900">
            {model.business.businessName || "Invoice"} · {model.invoiceNumber}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={model.paymentStatus === "paid" ? "success" : "neutral"}>
            {PAYMENT_STATUS_LABELS[model.paymentStatus as PaymentStatus] ?? model.paymentStatus}
          </Badge>
          <Link
            href={data.payPath}
            className="inline-flex h-9 items-center rounded-md bg-ink-900 px-4 text-sm font-medium text-white shadow-subtle transition-colors hover:bg-ink-800"
          >
            {data.paymentEnabled ? "Pay this invoice" : "Payment options"}
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[900px] px-4">
        <div className="overflow-x-auto rounded-lg bg-white shadow-panel">
          <div className="origin-top-left scale-[0.98] sm:scale-100">
            <InvoiceDocument model={model} showPayButton={false} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryItem label="Invoice date" value={formatDate(model.invoiceDate)} />
          <SummaryItem label="Due date" value={formatDate(model.dueDate)} />
          <SummaryItem
            label="Amount due"
            value={formatMoney(totals.amountDue, model.currencySymbol, model.currency === "JPY" ? 0 : 2)}
          />
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-2xs text-ink-500">
          <FileText className="h-3 w-3" aria-hidden />
          This page is a read-only copy. For a PDF, use your browser&apos;s print action.
        </p>
      </main>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className="text-2xs font-semibold tracking-wider text-ink-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}
