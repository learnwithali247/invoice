"use client";

import * as React from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Field, Input, Textarea, Toggle } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { InvoiceDraft } from "@/lib/invoice/types";

export type PaymentAvailability = {
  mode: "test" | "live" | "disabled";
  providers: { name: string; label: string; configured: boolean; isTest: boolean }[];
};

/**
 * Only enables real payment providers that are configured on the server.
 * There is no simulated/"fake" payment path anywhere in this app.
 */
export function PaymentPanel({
  draft,
  availability,
  update,
  amountDue,
  publicPath,
}: {
  draft: InvoiceDraft;
  availability: PaymentAvailability;
  update: (patch: Partial<InvoiceDraft>) => void;
  amountDue: string;
  publicPath: string | null;
}) {
  const configured = availability.providers.filter((p) => p.configured);
  const unavailable = availability.providers.filter((p) => !p.configured);

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-ink-500 uppercase">
            Online payment
          </h3>
          {availability.mode === "test" ? (
            <Badge tone="warning">TEST MODE</Badge>
          ) : availability.mode === "live" ? (
            <Badge tone="success">Live payments</Badge>
          ) : (
            <Badge tone="neutral">Payments disabled</Badge>
          )}
        </div>

        {availability.mode === "test" ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Test mode is active. Payments use sandbox credentials, no real money moves, and every
            transaction is recorded with <code className="font-mono">is_test = true</code>.
          </p>
        ) : null}

        {availability.mode === "disabled" ? (
          <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">
            Online payments are turned off. Set <code className="font-mono">PAYMENT_MODE</code> to{" "}
            <code className="font-mono">test</code> or <code className="font-mono">live</code> in your
            server environment and add provider keys.
          </p>
        ) : null}

        <Toggle
          checked={draft.paymentEnabled}
          onChange={(value) => update({ paymentEnabled: value })}
          disabled={configured.length === 0}
          label="Show a “Pay now” button"
          description={
            configured.length === 0
              ? "Needs at least one configured payment provider."
              : "Adds a Pay now button and a secure payment link on the invoice."
          }
        />

        {draft.paymentEnabled ? (
          <Field label="Payment provider" htmlFor="paymentProvider">
            <div className="space-y-2">
              <select
                id="paymentProvider"
                value={draft.paymentProvider}
                onChange={(e) =>
                  update({ paymentProvider: e.target.value as InvoiceDraft["paymentProvider"] })
                }
                className="h-9 w-full cursor-pointer rounded-md border border-ink-300 bg-white px-3 text-sm shadow-subtle"
              >
                <option value="manual">Manual / bank transfer (no online checkout)</option>
                {configured.map((provider) => (
                  <option key={provider.name} value={provider.name}>
                    {provider.label}
                    {provider.isTest ? " (test)" : ""}
                  </option>
                ))}
              </select>

              {unavailable.length > 0 ? (
                <p className="text-2xs leading-relaxed text-ink-500">
                  Not available yet:{" "}
                  {unavailable.map((p) => p.label).join(", ")} — add the provider keys to your server
                  environment.
                </p>
              ) : null}
            </div>
          </Field>
        ) : null}

        <p className="flex items-start gap-2 text-2xs leading-relaxed text-ink-500">
          <CreditCard className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Card details are entered on the provider&apos;s hosted checkout page. This application never
          sees, stores or transmits card numbers, CVVs or payment credentials.
        </p>
      </section>

      <section className="space-y-4 border-t border-ink-200 pt-5">
        <h3 className="text-xs font-semibold tracking-wider text-ink-500 uppercase">
          Instructions on the invoice
        </h3>

        <Field
          label="Payment instructions"
          htmlFor="paymentInstructions"
          hint="Bank details, PayPal address, or a short note."
        >
          <Textarea
            id="paymentInstructions"
            rows={4}
            value={draft.paymentInstructions}
            onChange={(e) => update({ paymentInstructions: e.target.value })}
            placeholder={"Bank transfer\nIBAN: GB29 NWBK 6016 1331 9268 19\nAccount name: Acme Ltd"}
          />
        </Field>

        <Field label="Amount due right now" htmlFor="amountDueInfo">
          <Input id="amountDueInfo" value={amountDue} readOnly className="bg-ink-50 font-mono" />
        </Field>

        {publicPath ? (
          <Field label="Public payment link" htmlFor="publicLink" hint="Uses a 48-character random token.">
            <Input id="publicLink" readOnly value={publicPath} className="bg-ink-50 font-mono text-xs" />
          </Field>
        ) : null}
      </section>
    </div>
  );
}
