"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculateTotals, formatMoney } from "@/lib/invoice/calculate";
import { formatDate } from "@/lib/invoice/date";
import { PAYMENT_STATUS_LABELS, type PaymentStatus, type RenderModel } from "@/lib/invoice/types";
import { safeErrorMessage } from "@/lib/utils";

export type PayPagePayload = {
  model: RenderModel;
  amountDue: number;
  paymentEnabled: boolean;
  mode: "test" | "live" | "disabled";
  providers: { name: string; label: string; configured: boolean; isTest: boolean }[];
  viewPath: string;
};

type Phase =
  | { kind: "idle" }
  | { kind: "redirecting"; provider: string }
  | { kind: "checking" }
  | { kind: "success"; reference: string | null }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

export function PayInvoiceClient({ payload }: { payload: PayPagePayload }) {
  const router = useRouter();
  const params = useSearchParams();
  const { model, paymentEnabled, mode, providers, viewPath } = payload;

  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [status, setStatus] = React.useState(model.paymentStatus);
  const [pendingProvider, setPendingProvider] = React.useState<string | null>(null);

  const totals = React.useMemo(
    () =>
      calculateTotals({
        items: model.items,
        discountType: model.discountType,
        discountValue: model.discountValue,
        shipping: model.shipping,
        fees: model.fees,
        adjustment: model.adjustment,
        amountPaid: model.amountPaid,
      }),
    [model],
  );

  const decimals = model.currency === "JPY" ? 0 : 2;
  const due = formatMoney(totals.amountDue, model.currencySymbol, decimals);
  const configured = providers.filter((p) => p.configured);

  const returnedFromPayment =
    params.get("paid") === "1" || Boolean(params.get("token")) || Boolean(params.get("PayerID"));

  /* -------- verify on return (never marks paid by itself) --------------- */
  const verifyRef = React.useRef(false);

  React.useEffect(() => {
    if (verifyRef.current) return;
    if (!returnedFromPayment) {
      if (params.get("cancelled") === "1") setPhase({ kind: "cancelled" });
      return;
    }
    verifyRef.current = true;
    setPhase({ kind: "checking" });

    let cancelled = false;

    async function confirm() {
      const orderId = params.get("token") ?? undefined;
      try {
        const response = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: payload.model.publicToken || undefined, orderId }),
        });
        if (cancelled) return;
        if (response.ok) {
          const json = await response.json();
          setStatus(json.data.paymentStatus);
          if (["paid", "partially_paid"].includes(json.data.paymentStatus)) {
            setPhase({ kind: "success", reference: orderId ?? null });
            return;
          }
        }
      } catch {
        /* fall through to polling */
      }
      // Stripe settles asynchronously via webhook — poll a short while.
      await poll();
    }

    async function poll() {
      for (let attempt = 0; attempt < 10; attempt++) {
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 2500));
        try {
          const response = await fetch(
            `/api/payments/status?token=${encodeURIComponent(payload.model.publicToken)}`,
            { cache: "no-store" },
          );
          const json = await response.json();
          if (!json?.ok) continue;
          const next = json.data.paymentStatus as string;
          setStatus(next as PaymentStatus);
          if (["paid", "partially_paid"].includes(next)) {
            setPhase({ kind: "success", reference: null });
            router.refresh();
            return;
          }
        } catch {
          /* keep polling */
        }
      }
      if (!cancelled) {
        setPhase({
          kind: "failed",
          message:
            "We have not received confirmation from the payment provider yet. If you were charged, it will appear on this invoice within a few minutes.",
        });
      }
    }

    void confirm();
    return () => {
      cancelled = true;
    };
  }, [returnedFromPayment, params, payload.model.publicToken, router]);

  async function startCheckout(provider: string) {
    if (pendingProvider || phase.kind === "redirecting") return;
    setPendingProvider(provider);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: payload.model.publicToken, provider }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not start the payment.");

      if (provider === "paypal") {
        sessionStorage.setItem(`paypal_order_${payload.model.publicToken}`, json.data.sessionId);
      }
      setPhase({ kind: "redirecting", provider });
      window.location.href = json.data.url as string;
    } catch (error) {
      setPendingProvider(null);
      setPhase({ kind: "failed", message: safeErrorMessage(error) });
    }
  }

  const paid = status === "paid" || phase.kind === "success";

  return (
    <div className="min-h-dvh bg-ink-100">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => router.push(viewPath)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Full invoice
          </button>
          <div className="ml-auto flex items-center gap-2">
            {mode === "test" ? (
              <Badge tone="warning">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                TEST MODE
              </Badge>
            ) : null}
            <Badge tone={paid ? "success" : "neutral"}>
              {PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status}
            </Badge>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[900px] px-4 py-6">
        {/* payment panel */}
        <section className="mb-5 rounded-lg border border-ink-200 bg-white p-5">
          {phase.kind === "checking" ? (
            <StatusBox
              tone="info"
              title="Confirming your payment"
              message="We are waiting for confirmation from the payment provider. This usually takes a few seconds."
              icon={<Loader2 className="h-5 w-5 animate-spin" />}
            />
          ) : phase.kind === "success" || paid ? (
            <StatusBox
              tone="success"
              title="Payment received"
              message={`Thank you — ${due} has been applied to ${model.invoiceNumber}. A receipt is on its way if the sender enabled email.`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              action={
                <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Refresh invoice
                </Button>
              }
            />
          ) : phase.kind === "cancelled" ? (
            <StatusBox
              tone="neutral"
              title="Payment cancelled"
              message="No charge was made. You can start the payment again whenever you like."
              icon={<XCircle className="h-5 w-5" />}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                    Amount due
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{due}</p>
                  {model.dueDate ? (
                    <p className="mt-1 text-xs text-ink-500">Due {formatDate(model.dueDate)}</p>
                  ) : null}
                </div>
                <p className="flex items-center gap-1.5 text-2xs text-ink-500">
                  <Lock className="h-3 w-3" aria-hidden />
                  Card details are entered on the provider&apos;s secure page.
                </p>
              </div>

              {paymentEnabled && configured.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {configured.map((provider) => (
                    <Button
                      key={provider.name}
                      variant={provider.name === "paypal" ? "secondary" : "primary"}
                      size="lg"
                      onClick={() => startCheckout(provider.name)}
                      loading={pendingProvider === provider.name}
                      loadingText="Opening checkout…"
                    >
                      {pendingProvider === provider.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <CreditCard className="h-4 w-4" aria-hidden />
                      )}
                      Pay with {provider.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">
                  {paymentEnabled
                    ? "Online payment is temporarily unavailable. Please contact the sender."
                    : "This invoice is not set up for online payment. Please use the payment instructions on the invoice."}
                </p>
              )}

              {mode === "test" ? (
                <p className="mt-3 text-2xs leading-relaxed text-amber-700">
                  This is a test environment. Use Stripe&apos;s test card 4242 4242 4242 4242 with any
                  future date and CVC — no real money moves.
                </p>
              ) : null}

              {phase.kind === "failed" ? (
                <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {phase.message}
                </p>
              ) : null}
            </>
          )}
        </section>

        <div className="overflow-x-auto rounded-lg bg-white shadow-panel">
          <InvoiceDocument model={model} showPayButton={false} />
        </div>

        <p className="mt-6 text-center text-2xs text-ink-500">
          This link uses a 48-character random token. Your card details are handled entirely by{" "}
          {model.business.businessName || "the sender"}&apos;s payment provider.
        </p>
      </main>
    </div>
  );
}

function StatusBox({
  tone,
  title,
  message,
  icon,
  action,
}: {
  tone: "success" | "info" | "neutral";
  title: string;
  message: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-brand-200 bg-brand-50 text-brand-700",
    neutral: "border-ink-200 bg-ink-50 text-ink-700",
  };
  return (
    <div className={`rounded-lg border p-5 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">{title}</h1>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
