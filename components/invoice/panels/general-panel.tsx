"use client";

import * as React from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CURRENCIES, getCurrency } from "@/lib/invoice/currencies";
import { addDays } from "@/lib/invoice/date";
import { calculateTotals } from "@/lib/invoice/calculate";
import type { InvoiceDraft } from "@/lib/invoice/types";
import { INVOICE_STATUSES, STATUS_LABELS } from "@/lib/invoice/types";

export function GeneralPanel({
  draft,
  update,
  totals,
  onReserveNumber,
}: {
  draft: InvoiceDraft;
  update: (patch: Partial<InvoiceDraft>) => void;
  totals: ReturnType<typeof calculateTotals>;
  onReserveNumber: () => void;
}) {
  const currency = getCurrency(draft.currency);

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <h3 className="text-xs font-semibold tracking-wider text-ink-500 uppercase">Invoice</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice number"
            htmlFor="invoiceNumber"
            required
            hint="Must be unique across your invoices. Leave empty to use the next number automatically."
            action={
              !draft.invoiceNumber ? (
                <Button size="sm" variant="ghost" onClick={onReserveNumber}>
                  Use next number
                </Button>
              ) : undefined
            }
          >
            <Input
              id="invoiceNumber"
              value={draft.invoiceNumber}
              onChange={(e) => update({ invoiceNumber: e.target.value })}
              placeholder="INV-000001"
              className="font-mono text-sm"
            />
          </Field>

          <Field label="Invoice type" htmlFor="invoiceType">
            <Select
              id="invoiceType"
              value={draft.invoiceType}
              onChange={(e) => update({ invoiceType: e.target.value as InvoiceDraft["invoiceType"] })}
            >
              <option value="standard">Standard Invoice</option>
              <option value="tax">Tax Invoice</option>
              <option value="proforma">Proforma Invoice</option>
              <option value="commercial">Commercial Invoice</option>
              <option value="custom">Custom Invoice</option>
            </Select>
          </Field>

          <Field label="Invoice date" htmlFor="invoiceDate" required>
            <Input
              id="invoiceDate"
              type="date"
              value={draft.invoiceDate}
              onChange={(e) => update({ invoiceDate: e.target.value })}
            />
          </Field>

          <Field
            label="Due date"
            htmlFor="dueDate"
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update({ dueDate: addDays(draft.invoiceDate, 14) })}
              >
                +14 days
              </Button>
            }
          >
            <Input
              id="dueDate"
              type="date"
              value={draft.dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
            />
          </Field>

          <Field label="PO / order number" htmlFor="poNumber">
            <Input
              id="poNumber"
              value={draft.poNumber}
              onChange={(e) => update({ poNumber: e.target.value })}
              placeholder="PO-2291"
            />
          </Field>

          <Field label="Reference" htmlFor="reference">
            <Input
              id="reference"
              value={draft.reference}
              onChange={(e) => update({ reference: e.target.value })}
              placeholder="Contract #14"
            />
          </Field>

          <Field label="Currency" htmlFor="currency" hint={`Symbol: ${currency.symbol}`}>
            <Select
              id="currency"
              value={draft.currency}
              onChange={(e) => update({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              value={draft.status}
              onChange={(e) => update({ status: e.target.value as InvoiceDraft["status"] })}
            >
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Payment terms" htmlFor="paymentTerms">
          <Textarea
            id="paymentTerms"
            rows={2}
            value={draft.paymentTerms}
            onChange={(e) => update({ paymentTerms: e.target.value })}
            placeholder="Payment due within 14 days of the invoice date."
          />
        </Field>
      </section>

      <section className="space-y-4 border-t border-ink-200 pt-5">
        <h3 className="text-xs font-semibold tracking-wider text-ink-500 uppercase">
          Adjustments
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discount" htmlFor="discount" className="sm:col-span-2">
            <div className="flex gap-2">
              <div className="w-24 shrink-0">
                <Select
                  aria-label="Discount type"
                  value={draft.discountType}
                  onChange={(e) =>
                    update({ discountType: e.target.value as InvoiceDraft["discountType"] })
                  }
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Amount</option>
                </Select>
              </div>
              <Input
                id="discount"
                inputMode="decimal"
                value={draft.discountValue}
                onChange={(e) => update({ discountValue: e.target.value })}
                placeholder="0"
              />
            </div>
          </Field>

          <Field label="Shipping" htmlFor="shipping">
            <Input
              id="shipping"
              inputMode="decimal"
              value={draft.shipping}
              onChange={(e) => update({ shipping: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Fees" htmlFor="fees">
            <Input
              id="fees"
              inputMode="decimal"
              value={draft.fees}
              onChange={(e) => update({ fees: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Adjustment" htmlFor="adjustment" hint="Use a negative value to reduce the total.">
            <Input
              id="adjustment"
              inputMode="decimal"
              value={draft.adjustment}
              onChange={(e) => update({ adjustment: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Amount paid" htmlFor="amountPaid" hint="Recorded payments reduce the amount due.">
            <Input
              id="amountPaid"
              inputMode="decimal"
              value={draft.amountPaid}
              onChange={(e) => update({ amountPaid: e.target.value })}
              placeholder="0.00"
            />
          </Field>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-ink-50 px-3.5 py-3 text-xs sm:grid-cols-3">
          <Total label="Subtotal" value={totals.subtotal.toFixed(2)} />
          <Total label="Discount" value={`-${totals.discountTotal.toFixed(2)}`} muted />
          <Total label="Tax" value={totals.taxTotal.toFixed(2)} muted />
          <Total label="Shipping" value={totals.shipping.toFixed(2)} muted />
          <Total label="Total" value={totals.total.toFixed(2)} strong />
          <Total label="Due" value={totals.amountDue.toFixed(2)} strong />
        </dl>
      </section>
    </div>
  );
}

function Total({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className={strong ? "font-semibold text-ink-900" : muted ? "text-ink-600" : "text-ink-800"}>
        {value}
      </dd>
    </div>
  );
}
