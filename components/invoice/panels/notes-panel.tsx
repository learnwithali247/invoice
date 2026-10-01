"use client";

import { Field, Textarea } from "@/components/ui/input";
import type { InvoiceDraft } from "@/lib/invoice/types";

export function NotesPanel({
  draft,
  update,
}: {
  draft: InvoiceDraft;
  update: (patch: Partial<InvoiceDraft>) => void;
}) {
  return (
    <div className="space-y-5">
      <Field
        label="Notes"
        htmlFor="notes"
        hint="Shown near the bottom of the invoice when enabled in Design."
      >
        <Textarea
          id="notes"
          rows={4}
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Thank you for your business."
        />
      </Field>

      <Field
        label="Terms & conditions"
        htmlFor="terms"
        hint="Leave empty to omit. The Tax and Proforma types ship with sensible defaults."
      >
        <Textarea
          id="terms"
          rows={5}
          value={draft.terms}
          onChange={(e) => update({ terms: e.target.value })}
          placeholder="Payment is due within 14 days. Late payments may incur a 2% monthly fee."
        />
      </Field>

      <Field label="Footer text" htmlFor="footerText" hint="Small print at the very bottom of the page.">
        <Textarea
          id="footerText"
          rows={2}
          value={draft.footerText}
          onChange={(e) => update({ footerText: e.target.value })}
          placeholder="Registered in England · Company No. 12345678"
        />
      </Field>
    </div>
  );
}
