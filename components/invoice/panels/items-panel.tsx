"use client";

import * as React from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { InvoiceItemDraft } from "@/lib/invoice/types";
import { emptyItem, localId } from "@/lib/invoice/mappers";
import { calculateTotals, formatMoney } from "@/lib/invoice/calculate";
import { getCurrency } from "@/lib/invoice/currencies";
import { cn } from "@/lib/utils";

export function ItemsPanel({
  items,
  currency,
  onChange,
}: {
  items: InvoiceItemDraft[];
  currency: string;
  onChange: (items: InvoiceItemDraft[]) => void;
}) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const money = getCurrency(currency);

  const totals = React.useMemo(
    () =>
      calculateTotals({
        items,
        discountType: "percent",
        discountValue: "0",
        shipping: "0",
        fees: "0",
        adjustment: "0",
        amountPaid: "0",
      }),
    [items],
  );

  function patch(id: string, changes: Partial<InvoiceItemDraft>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function add() {
    onChange([...items, emptyItem()]);
  }

  function duplicate(id: string) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const source = items[index];
    const copy: InvoiceItemDraft = { ...source, id: localId() };
    const next = [...items];
    next.splice(index + 1, 0, copy);
    onChange(next);
  }

  function remove(id: string) {
    const next = items.filter((item) => item.id !== id);
    onChange(next.length ? next : [emptyItem()]);
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-ink-500 uppercase">
            Line items
          </h3>
          <p className="mt-0.5 text-2xs text-ink-500">
            {items.length === 1 && !items[0].name
              ? "Fill in your first item, or add more with the button below."
              : `${items.length} ${items.length === 1 ? "item" : "items"}`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add item
        </Button>
      </div>

      <ul className="space-y-3">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnter={() => setOverIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => {
              if (dragIndex !== null) move(dragIndex, overIndex ?? dragIndex);
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cn(
              "rounded-lg border bg-white transition-colors",
              dragIndex === index && "opacity-50",
              overIndex === index && dragIndex !== index
                ? "border-brand-500 ring-1 ring-brand-500"
                : "border-ink-200",
            )}
          >
            {/* row 1 — item name */}
            <div className="flex items-start gap-2 border-b border-ink-100 p-3">
              <span
                className="mt-6 cursor-grab text-ink-300 active:cursor-grabbing"
                aria-hidden
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <span
                className="mt-6 w-5 shrink-0 text-center text-2xs font-medium tabular-nums text-ink-400"
                aria-hidden
              >
                {index + 1}
              </span>
              <Field label="Item or service" htmlFor={`${item.id}-name`} className="min-w-0 flex-1">
                <Input
                  id={`${item.id}-name`}
                  value={item.name}
                  onChange={(e) => patch(item.id, { name: e.target.value })}
                  placeholder="e.g. Website Development"
                />
              </Field>
              <div className="mt-5 flex shrink-0 gap-0.5">
                <IconAction
                  label={`Duplicate item ${index + 1}`}
                  onClick={() => duplicate(item.id)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction
                  label={`Delete item ${index + 1}`}
                  onClick={() => remove(item.id)}
                  danger
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconAction>
              </div>
            </div>

            {/* row 2 — the numbers, one aligned grid */}
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Quantity" htmlFor={`${item.id}-qty`}>
                <Input
                  id={`${item.id}-qty`}
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => patch(item.id, { quantity: e.target.value })}
                  placeholder="1"
                  className="tabular-nums"
                />
              </Field>

              <Field label="Unit price" htmlFor={`${item.id}-price`}>
                <AdornedInput
                  id={`${item.id}-price`}
                  adornment={money.symbol}
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(e) => patch(item.id, { unitPrice: e.target.value })}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Discount %" htmlFor={`${item.id}-discount`}>
                <Input
                  id={`${item.id}-discount`}
                  inputMode="decimal"
                  value={item.discount}
                  onChange={(e) => patch(item.id, { discount: e.target.value })}
                  placeholder="0"
                  className="tabular-nums"
                />
              </Field>

              <Field label="Tax %" htmlFor={`${item.id}-tax`}>
                <Input
                  id={`${item.id}-tax`}
                  inputMode="decimal"
                  value={item.tax}
                  onChange={(e) => patch(item.id, { tax: e.target.value })}
                  placeholder="0"
                  className="tabular-nums"
                />
              </Field>
            </div>

            {/* row 3 — description + computed line total */}
            <div className="flex flex-col gap-3 border-t border-ink-100 p-3 sm:flex-row sm:items-end">
              <Field
                label="Description"
                htmlFor={`${item.id}-description`}
                hint="Optional — printed under the item name."
                className="min-w-0 flex-1"
              >
                <Textarea
                  id={`${item.id}-description`}
                  rows={2}
                  value={item.description}
                  onChange={(e) => patch(item.id, { description: e.target.value })}
                  placeholder="Scope, notes or a breakdown of this line"
                  className="text-xs"
                />
              </Field>

              <div className="shrink-0 sm:w-40">
                <span className="mb-1.5 block text-xs font-medium text-ink-700">Line total</span>
                <div
                  aria-label={`Line total for item ${index + 1}`}
                  className="flex h-9 items-center justify-end rounded-md border border-ink-200 bg-ink-50 px-3 text-sm font-semibold tabular-nums text-ink-900"
                >
                  {formatMoney(
                    totals.items[index]?.total.toNumber() ?? 0,
                    money.symbol,
                    money.decimals,
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-300 px-4 py-8 text-center">
          <p className="text-sm text-ink-600">No line items yet.</p>
          <Button variant="outline" className="mt-3" onClick={add}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add the first item
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-2xs leading-snug text-ink-500">{hint}</p> : null}
    </div>
  );
}

/** Input with a fixed prefix/suffix so the unit is never ambiguous. */
function AdornedInput({
  adornment,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { adornment: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-ink-400 select-none">
        {adornment}
      </span>
      <Input className={cn("pl-8 tabular-nums", className)} {...props} />
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        danger
          ? "text-ink-400 hover:bg-red-50 hover:text-red-600"
          : "text-ink-400 hover:bg-ink-100 hover:text-ink-800",
      )}
    >
      {children}
    </button>
  );
}
