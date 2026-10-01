"use client";

import * as React from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/input";
import type { CustomerDraft, InvoiceDraft } from "@/lib/invoice/types";
import type { CustomerRow } from "@/types/database";
import { safeErrorMessage } from "@/lib/utils";

export function CustomerPanel({
  draft,
  onCustomerChange,
  onSaved,
}: {
  draft: InvoiceDraft;
  onCustomerChange: (patch: Partial<CustomerDraft>) => void;
  onSaved: (customer: CustomerRow) => void;
}) {
  const [saveToLibrary, setSaveToLibrary] = React.useState(false);
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [loadingLibrary, setLoadingLibrary] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const c = draft.customer;

  React.useEffect(() => {
    let cancelled = false;
    setLoadingLibrary(true);
    fetch("/api/customers")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.ok) setCustomers(json.data as CustomerRow[]);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadingLibrary(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const hasDetails = Boolean(c.name || c.company || c.email || c.phone || c.address);

  async function saveCustomer() {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: c.id,
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone,
          address: c.address,
          shippingAddress: c.shippingAddress,
          taxId: c.taxId,
          notes: c.notes,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not save the customer.");
      if (!json.data) {
        setNotice("Enter a customer name first.");
        return;
      }
      setCustomers((prev) =>
        prev.some((p) => p.id === json.data.id)
          ? prev.map((p) => (p.id === json.data.id ? json.data : p))
          : [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      onCustomerChange({ id: json.data.id });
      onSaved(json.data as CustomerRow);
      setNotice("Customer saved to your library.");
    } catch (error) {
      setNotice(safeErrorMessage(error, "Could not save the customer."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold tracking-wider text-ink-500 uppercase">Customer</h3>
          {customers.length > 0 ? (
            <div className="min-w-0">
              <label htmlFor="customer-picker" className="sr-only">
                Saved customers
              </label>
              <select
                id="customer-picker"
                value=""
                disabled={loadingLibrary}
                onChange={(event) => {
                  const found = customers.find((item) => item.id === event.target.value);
                  if (!found) return;
                  onCustomerChange({
                    id: found.id,
                    name: found.name ?? "",
                    company: found.company ?? "",
                    email: found.email ?? "",
                    phone: found.phone ?? "",
                    address: found.billing_address ?? "",
                    shippingAddress: found.shipping_address ?? "",
                    taxId: found.tax_id ?? "",
                    notes: found.notes ?? "",
                  });
                  setNotice(null);
                }}
                className="h-8 max-w-52 rounded-md border border-ink-300 bg-white px-2 text-xs text-ink-700 shadow-subtle"
              >
                <option value="">
                  {loadingLibrary ? "Loading…" : "Select a saved customer…"}
                </option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.company ? `${item.name} · ${item.company}` : item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" htmlFor="customerName">
            <Input
              id="customerName"
              value={c.name}
              onChange={(e) => onCustomerChange({ name: e.target.value })}
              placeholder="John Smith"
              autoComplete="off"
            />
          </Field>

          <Field label="Company" htmlFor="customerCompany">
            <Input
              id="customerCompany"
              value={c.company}
              onChange={(e) => onCustomerChange({ company: e.target.value })}
              placeholder="Acme Technologies"
              autoComplete="off"
            />
          </Field>

          <Field label="Email" htmlFor="customerEmail">
            <Input
              id="customerEmail"
              type="email"
              inputMode="email"
              value={c.email}
              onChange={(e) => onCustomerChange({ email: e.target.value })}
              placeholder="billing@acme.com"
              autoComplete="off"
            />
          </Field>

          <Field label="Phone" htmlFor="customerPhone">
            <Input
              id="customerPhone"
              type="tel"
              value={c.phone}
              onChange={(e) => onCustomerChange({ phone: e.target.value })}
              placeholder="+1 555 0134"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Billing address" htmlFor="customerAddress">
          <Textarea
            id="customerAddress"
            rows={3}
            value={c.address}
            onChange={(e) => onCustomerChange({ address: e.target.value })}
            placeholder={"221B Baker Street\nLondon, NW1 6XE\nUnited Kingdom"}
          />
        </Field>

        <Field
          label="Shipping address"
          htmlFor="customerShipping"
          hint="Optional — shown on the invoice only when enabled in the Design tab."
        >
          <Textarea
            id="customerShipping"
            rows={2}
            value={c.shippingAddress}
            onChange={(e) => onCustomerChange({ shippingAddress: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax ID / VAT number" htmlFor="customerTaxId">
            <Input
              id="customerTaxId"
              value={c.taxId}
              onChange={(e) => onCustomerChange({ taxId: e.target.value })}
              placeholder="GB123456789"
            />
          </Field>

          <Field label="Internal notes" htmlFor="customerNotes" hint="Never printed on the invoice.">
            <Input
              id="customerNotes"
              value={c.notes}
              onChange={(e) => onCustomerChange({ notes: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 border-t border-ink-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
            <Checkbox
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
            />
            Save this customer for reuse
          </label>
          <div className="flex items-center gap-2">
            {c.id ? (
              <span className="text-2xs text-ink-500">Linked to a saved customer</span>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={saveCustomer}
              loading={saving}
              disabled={!hasDetails}
              loadingText="Saving…"
            >
              {!saving ? <UserPlus className="h-3.5 w-3.5" aria-hidden /> : null}
              Save customer
            </Button>
          </div>
        </div>
        {saveToLibrary ? (
          <p className="text-2xs leading-relaxed text-ink-500">
            The customer will also be saved automatically every time this invoice saves.
          </p>
        ) : null}
        {notice ? <p className="text-2xs font-medium text-ink-600">{notice}</p> : null}
        {customers.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              onCustomerChange({
                id: null,
                name: "",
                company: "",
                email: "",
                phone: "",
                address: "",
                shippingAddress: "",
                taxId: "",
                notes: "",
              });
              setNotice(null);
            }}
            className="inline-flex items-center gap-1.5 text-2xs font-medium text-ink-500 hover:text-ink-800"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            Clear customer
          </button>
        ) : null}
      </section>
    </div>
  );
}
