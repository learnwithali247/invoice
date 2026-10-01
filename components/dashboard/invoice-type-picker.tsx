"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Receipt, ScrollText, Ship, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { INVOICE_TYPES, INVOICE_TYPE_META, type InvoiceType } from "@/lib/invoice/types";
import { cn } from "@/lib/utils";

const ICONS: Record<InvoiceType, React.ReactNode> = {
  standard: <Receipt className="h-5 w-5" />,
  tax: <FileText className="h-5 w-5" />,
  proforma: <ScrollText className="h-5 w-5" />,
  commercial: <Ship className="h-5 w-5" />,
  custom: <Sparkles className="h-5 w-5" />,
};

/**
 * The invoice type registry is data-driven — adding a type means adding an
 * entry to `INVOICE_TYPES` / `INVOICE_TYPE_META`, nothing else changes.
 */
export function InvoiceTypePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<InvoiceType>("standard");

  function create() {
    onClose();
    router.push(`/invoices/new?type=${selected}`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="What type of invoice do you want to create?"
      description="Pick a starting point — every field stays editable afterwards."
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="mr-auto text-xs font-medium text-ink-500 hover:text-ink-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-subtle transition-colors hover:bg-brand-700"
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Invoice type" className="grid gap-2.5 sm:grid-cols-2">
        {INVOICE_TYPES.map((type) => {
          const meta = INVOICE_TYPE_META[type];
          const active = selected === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(type)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
                active
                  ? "border-ink-900 bg-ink-900/5 ring-1 ring-ink-900"
                  : "border-ink-200 bg-white hover:border-ink-400 hover:bg-ink-50",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  active ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500",
                )}
                aria-hidden
              >
                {ICONS[type]}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">{meta.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                  {meta.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
