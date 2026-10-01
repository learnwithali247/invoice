"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  invoice: { id: string; invoiceNumber: string; paymentEnabled: boolean; customerName: string };
};

export function ShareDialog({ open, onClose, invoice }: Props) {
  const toast = useToast();
  const [links, setLinks] = React.useState<{ viewUrl: string; payUrl: string; paymentEnabled: boolean } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLinks(null);

    // Ensure the invoice is saved/published before handing out a link.
    fetch(`/api/invoices/${invoice.id}/share`, { method: "POST" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.ok) throw new Error(json?.error?.message ?? "Could not create the link.");
        setLinks(json.data);
      })
      .catch((error) => {
        if (!cancelled) toast.error("Could not create the share link", error.message);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [open, invoice.id, toast]);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Clipboard unavailable", "Copy the link manually from the field.");
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Share ${invoice.invoiceNumber}`}
      description="Anyone with these links can view the invoice. No login required."
      footer={
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-14 w-full" />
        </div>
      ) : links ? (
        <div className="space-y-3">
          <LinkRow
            label="View invoice"
            hint="Read-only page with the full invoice"
            value={links.viewUrl}
            copied={copied === "view"}
            onCopy={() => copy(links.viewUrl, "view")}
          />
          <LinkRow
            label="Pay this invoice"
            hint={
              links.paymentEnabled
                ? "Payment page with the Pay now button"
                : "Online payment is not enabled for this invoice yet"
            }
            value={links.payUrl}
            copied={copied === "pay"}
            onCopy={() => copy(links.payUrl, "pay")}
          />
          <p className="flex items-start gap-1.5 pt-1 text-2xs leading-relaxed text-ink-500">
            <Link2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Both links use a 48-character random token — they never reveal database IDs.
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-500">Could not create the link.</p>
      )}
    </Dialog>
  );
}

function LinkRow({
  label,
  hint,
  value,
  copied,
  onCopy,
}: {
  label: string;
  hint: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-ink-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{label}</p>
          <p className="mt-0.5 text-2xs text-ink-500">{hint}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" onClick={onCopy} aria-label={`Copy ${label} link`}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => window.open(value, "_blank", "noopener")}
            aria-label={`Open ${label} link`}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-2 truncate rounded bg-ink-50 px-2 py-1 font-mono text-2xs text-ink-600">
        {value}
      </p>
    </div>
  );
}

