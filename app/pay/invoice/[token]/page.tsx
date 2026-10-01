import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadPublicInvoice } from "@/lib/invoice/public";
import { availableProviders, paymentMode } from "@/lib/payments";
import { PayInvoiceClient } from "@/components/invoice/pay-invoice-client";
import { Skeleton } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicInvoice(token).catch(() => null);
  if (!data) {
    return { title: "Invoice not found", robots: { index: false, follow: false } };
  }
  return {
    title: `Pay ${data.model.invoiceNumber} · ${data.model.business.businessName || "Invoice"}`,
    robots: { index: false, follow: false },
  };
}

export default async function PayInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Never cached: this page polls payment status and must stay authoritative.
  const data = await loadPublicInvoice(token, { fresh: true }).catch(() => null);
  if (!data) notFound();

  const providers = availableProviders();

  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[900px] space-y-4 px-4 py-6">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      }
    >
      <PayInvoiceClient
        payload={{
          model: data.model,
          amountDue: data.amountDue,
          paymentEnabled: data.paymentEnabled,
          mode: paymentMode().mode,
          providers,
          viewPath: data.viewPath,
        }}
      />
    </Suspense>
  );
}
