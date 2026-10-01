"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  Printer,
  Share2,
  Trash2,
} from "lucide-react";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ShareDialog } from "@/components/invoice/share-dialog";
import { SendDialog } from "@/components/invoice/send-dialog";
import { useToast } from "@/components/ui/toast";

export type InvoiceRowView = {
  id: string;
  invoiceNumber: string;
  publicToken: string;
  paymentEnabled: boolean;
  customer_name: string;
  customer_email: string | null;
};

export function InvoiceActions({
  invoice,
  onDeleted,
  trigger,
}: {
  invoice: InvoiceRowView;
  onDeleted?: () => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "duplicate" | "pdf" | "delete">(null);

  async function duplicate() {
    setBusy("duplicate");
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/duplicate`, { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not duplicate the invoice.");
      toast.success("Invoice duplicated", "A copy was created with a new invoice number.");
      router.push(`/invoices/${json.data.invoice.id}`);
      router.refresh();
    } catch (error) {
      toast.error("Could not duplicate", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: "POST" });
      if (!response.ok) throw new Error("PDF generation failed.");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="(.+?)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] ?? `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (error) {
      toast.error("Could not generate the PDF", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not delete the invoice.");
      toast.success("Invoice deleted", invoice.invoiceNumber);
      setConfirmOpen(false);
      onDeleted?.();
      router.refresh();
    } catch (error) {
      toast.error("Could not delete", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const items: MenuItem[] = [
    {
      label: "Open & edit",
      icon: <Pencil className="h-4 w-4" />,
      onSelect: () => router.push(`/invoices/${invoice.id}`),
    },
    {
      label: "Public view",
      icon: <Eye className="h-4 w-4" />,
      onSelect: () => window.open(`/i/${invoice.publicToken}`, "_blank", "noopener"),
    },
    {
      label: busy === "duplicate" ? "Duplicating…" : "Duplicate",
      icon: <Copy className="h-4 w-4" />,
      disabled: busy !== null,
      onSelect: duplicate,
    },
    {
      label: busy === "pdf" ? "Generating PDF…" : "Download PDF",
      icon: <Download className="h-4 w-4" />,
      disabled: busy !== null,
      onSelect: downloadPdf,
    },
    {
      label: "Print",
      icon: <Printer className="h-4 w-4" />,
      onSelect: () => window.open(`/invoices/${invoice.id}/print`, "_blank", "noopener"),
    },
    {
      label: "Share",
      icon: <Share2 className="h-4 w-4" />,
      onSelect: () => setShareOpen(true),
    },
    {
      label: "Send by email",
      icon: <Mail className="h-4 w-4" />,
      disabled: !invoice.customer_email,
      onSelect: () => setSendOpen(true),
      separatorBefore: true,
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      danger: true,
      disabled: busy !== null,
      separatorBefore: true,
      onSelect: () => setConfirmOpen(true),
    },
  ];

  return (
    <>
      {trigger ?? <DropdownMenu items={items} label={`Actions for ${invoice.invoiceNumber}`} />}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete ${invoice.invoiceNumber}?`}
        description="The invoice is archived and disappears from your dashboard. This cannot be undone from here."
        confirmLabel="Delete invoice"
        loading={busy === "delete"}
        onConfirm={remove}
      />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentEnabled: invoice.paymentEnabled,
          customerName: invoice.customer_name,
        }}
      />

      <SendDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        invoice={invoice}
        defaultEmail={invoice.customer_email ?? ""}
      />
    </>
  );
}

export function MobileInvoiceActions({ invoice, onDeleted }: { invoice: InvoiceRowView; onDeleted?: () => void }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => router.push(`/invoices/${invoice.id}`)}
        aria-label={`Edit ${invoice.invoiceNumber}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <InvoiceActions invoice={invoice} onDeleted={onDeleted} />
      <span className="sr-only">
        <MoreHorizontal aria-hidden />
      </span>
    </div>
  );
}
