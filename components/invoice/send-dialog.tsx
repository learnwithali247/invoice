"use client";

import * as React from "react";
import { Paperclip, Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Toggle } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  invoice: { id: string; invoiceNumber: string };
  defaultEmail: string;
};

export function SendDialog({ open, onClose, invoice, defaultEmail }: Props) {
  const toast = useToast();
  const [to, setTo] = React.useState(defaultEmail);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [includePdf, setIncludePdf] = React.useState(true);
  const [includeLink, setIncludeLink] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTo(defaultEmail);
      setSubject("");
      setMessage("");
      setError(null);
    }
  }, [open, defaultEmail]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSending(true);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
          includePdf,
          includeLink,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The email could not be sent.");

      if (json.data?.note) toast.info("Sent to the console provider", json.data.note);
      else toast.success("Invoice sent", `Delivered to ${to.trim()}.`);
      onClose();
    } catch (err) {
      const failure = err instanceof Error ? err.message : "Please try again.";
      setError(failure);
      toast.error("Could not send the invoice", failure);
    } finally {

      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Send ${invoice.invoiceNumber}`}
      description="The email includes a secure invoice link and, optionally, the PDF."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={submit}
            loading={sending}
            loadingText="Sending…"
            type="submit"
            form="send-invoice-form"
          >
            <Send className="h-4 w-4" aria-hidden />
            Send invoice
          </Button>
        </>
      }
    >
      <form id="send-invoice-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Recipient email" htmlFor="send-to" required error={error}>
          <Input
            id="send-to"
            type="email"
            required
            inputMode="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="customer@company.com"
          />
        </Field>

        <Field label="Subject" htmlFor="send-subject" hint="Leave empty to use the default subject.">
          <Input
            id="send-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`Invoice ${invoice.invoiceNumber}`}
          />
        </Field>

        <Field label="Message" htmlFor="send-message" hint="Optional note added above the invoice summary.">
          <Textarea
            id="send-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi there, here's the invoice for last month's work."
          />
        </Field>

        <div className="space-y-1 rounded-lg border border-ink-200 p-3">
          <Toggle
            checked={includePdf}
            onChange={setIncludePdf}
            label="Attach the PDF"
            description="Generated server-side with selectable text."
          />
          <Toggle
            checked={includeLink}
            onChange={setIncludeLink}
            label="Include the secure invoice link"
            description="Lets the customer view the live invoice and pay online."
          />
        </div>

        <p className="flex items-center gap-1.5 text-2xs leading-relaxed text-ink-500">
          <Paperclip className="h-3 w-3" aria-hidden />
          Card details are never collected or stored here — payment happens on the provider&apos;s hosted page.
        </p>
      </form>
    </Dialog>
  );
}

