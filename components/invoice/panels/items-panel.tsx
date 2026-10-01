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
        <h3 className="text-xs font-semibold tracking-wider text-ink-500 uppercase">
          Line items ({items.length})
        </h3>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add item
        </Button>
      </div>

      <div className="hidden grid-cols-[22px_minmax(0,1fr)] gap-2 lg:grid">
        {items.map((item, index) => (
          <ItemCard
            key={item.id}
            item={item}
            index={index}
            total={totals.items[index]?.total.toNumber() ?? 0}
            symbol={money.symbol}
            decimals={money.decimals}
            onPatch={(changes) => patch(item.id, changes)}
            onDuplicate={() => duplicate(item.id)}
            onRemove={() => remove(item.id)}
            onDragStart={() => setDragIndex(index)}
            onDragEnter={() => setOverIndex(index)}
            onDragEnd={() => {
              if (dragIndex !== null) move(dragIndex, overIndex ?? dragIndex);
              setDragIndex(null);
              setOverIndex(null);
            }}
            dragging={dragIndex === index}
            dragOver={overIndex === index && dragIndex !== index}
          />
        ))}
      </div>

      {/* compact table for narrow screens */}
      <div className="space-y-3 lg:hidden">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-ink-200 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 w-4 text-2xs text-ink-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <Input
                  value={item.name}
                  onChange={(e) => patch(item.id, { name: e.target.value })}
                  placeholder="Product or service"
                  aria-label={`Item ${index + 1} name`}
                />
              </div>
              <RowActions
                onDuplicate={() => duplicate(item.id)}
                onRemove={() => remove(item.id)}
                index={index}
              />
            </div>
            <Textarea
              rows={2}
              value={item.description}
              onChange={(e) => patch(item.id, { description: e.target.value })}
              placeholder="Description (optional)"
              aria-label={`Item ${index + 1} description`}
              className="mt-2"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MiniField label="Qty">
                <Input
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => patch(item.id, { quantity: e.target.value })}
                />
              </MiniField>
              <MiniField label="Price">
                <Input
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(e) => patch(item.id, { unitPrice: e.target.value })}
                />
              </MiniField>
              <MiniField label="Discount %">
                <Input
                  inputMode="decimal"
                  value={item.discount}
                  onChange={(e) => patch(item.id, { discount: e.target.value })}
                />
              </MiniField>
              <MiniField label="Tax %">
                <Input
                  inputMode="decimal"
                  value={item.tax}
                  onChange={(e) => patch(item.id, { tax: e.target.value })}
                />
              </MiniField>
            </div>
            <p className="mt-2 text-right text-xs font-semibold tabular-nums text-ink-900">
              {formatMoney(totals.items[index]?.total ?? 0, money.symbol, money.decimals)}
            </p>
          </div>
        ))}
        <Button variant="outline" className="w-full" onClick={add}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add item
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 px-4 py-8 text-center text-sm text-ink-500">
          No items yet. Add your first line item.
        </p>
      ) : null}
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-medium text-ink-500">{label}</span>
      {children}
    </label>
  );
}

function RowActions({
  onDuplicate,
  onRemove,
  index,
}: {
  onDuplicate: () => void;
  onRemove: () => void;
  index: number;
}) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <button
        type="button"
        onClick={onDuplicate}
        aria-label={`Duplicate item ${index + 1}`}
        className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Delete item ${index + 1}`}
        className="rounded p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ItemCard({
  item,
  index,
  total,
  symbol,
  decimals,
  onPatch,
  onDuplicate,
  onRemove,
  onDragStart,
  onDragEnter,
  onDragEnd,
  dragging,
  dragOver,
}: {
  item: InvoiceItemDraft;
  index: number;
  total: number;
  symbol: string;
  decimals: number;
  onPatch: (changes: Partial<InvoiceItemDraft>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  dragging: boolean;
  dragOver: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border bg-white p-3 transition-colors",
        dragging ? "opacity-50" : "opacity-100",
        dragOver ? "border-brand-500 ring-1 ring-brand-500" : "border-ink-200",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 cursor-grab text-ink-300 active:cursor-grabbing"
          aria-hidden
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <Input
            value={item.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Product or service"
            aria-label={`Item ${index + 1} name`}
            className="sm:col-span-2"
          />
          <Input
            inputMode="decimal"
            value={item.quantity}
            onChange={(e) => onPatch({ quantity: e.target.value })}
            placeholder="Qty"
            aria-label={`Item ${index + 1} quantity`}
          />
          <Input
            inputMode="decimal"
            value={item.unitPrice}
            onChange={(e) => onPatch({ unitPrice: e.target.value })}
            placeholder="Unit price"
            aria-label={`Item ${index + 1} unit price`}
          />
          <Input
            inputMode="decimal"
            value={item.discount}
            onChange={(e) => onPatch({ discount: e.target.value })}
            placeholder="Discount %"
            aria-label={`Item ${index + 1} discount percent`}
          />
          <Input
            inputMode="decimal"
            value={item.tax}
            onChange={(e) => onPatch({ tax: e.target.value })}
            placeholder="Tax %"
            aria-label={`Item ${index + 1} tax percent`}
          />
          <div className="sm:col-span-2">
            <Textarea
              rows={2}
              value={item.description}
              onChange={(e) => onPatch({ description: e.target.value })}
              placeholder="Description (optional)"
              aria-label={`Item ${index + 1} description`}
              className="text-xs"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <RowActions onDuplicate={onDuplicate} onRemove={onRemove} index={index} />
          <span className="mt-auto text-xs font-semibold tabular-nums text-ink-900">
            {formatMoney(total, symbol, decimals)}
          </span>
        </div>
      </div>
    </div>
  );
}
