import type { RenderModel } from "@/lib/invoice/types";
import { INVOICE_TYPE_META, PAYMENT_STATUS_LABELS } from "@/lib/invoice/types";
import { calculateTotals, formatMoney } from "@/lib/invoice/calculate";
import { formatDate } from "@/lib/invoice/date";

export function buildInvoiceEmail(model: RenderModel, options: {
  publicUrl: string | null;
  payUrl: string | null;
  customMessage?: string | null;
  includeLink: boolean;
}) {
  const totals = calculateTotals({
    items: model.items,
    discountType: model.discountType,
    discountValue: model.discountValue,
    shipping: model.shipping,
    fees: model.fees,
    adjustment: model.adjustment,
    amountPaid: model.amountPaid,
  });

  const typeLabel = INVOICE_TYPE_META[model.invoiceType]?.label ?? "Invoice";
  const decimals = model.currency === "JPY" ? 0 : 2;
  const money = (v: Parameters<typeof formatMoney>[0]) =>
    formatMoney(v, model.currencySymbol, decimals);

  const business = model.business.businessName || "The sender";
  const subject = `${typeLabel} ${model.invoiceNumber} from ${business} — ${money(totals.total)}`;
  const due = money(totals.amountDue);

  const intro =
    options.customMessage?.trim() ||
    `Hi ${model.customer.name || model.customer.company || "there"},` +
      `\n\nPlease find attached your ${typeLabel.toLowerCase()} ${model.invoiceNumber} from ${business}.` +
      `\n\nAmount due: ${due}` +
      (model.dueDate ? `\nDue date: ${formatDate(model.dueDate)}` : "");

  const text = [
    intro,
    "",
    `Invoice number: ${model.invoiceNumber}`,
    `Invoice date: ${formatDate(model.invoiceDate)}`,
    model.dueDate ? `Due date: ${formatDate(model.dueDate)}` : "",
    `Total: ${money(totals.total)}`,
    totals.amountPaid.gt(0) ? `Amount paid: ${money(totals.amountPaid)}` : "",
    `Amount due: ${due}`,
    `Status: ${PAYMENT_STATUS_LABELS[model.paymentStatus] ?? model.paymentStatus}`,
    "",
    ...(options.payUrl && options.includeLink ? [`Pay online: ${options.payUrl}`] : []),
    ...(options.publicUrl && options.includeLink ? [`View invoice: ${options.publicUrl}`] : []),
    "",
    model.notes ? `Notes:\n${model.notes}` : "",
    model.terms ? `\nTerms & conditions:\n${model.terms}` : "",
    "",
    "—",
    business,
    [model.business.email, model.business.phone, model.business.website].filter(Boolean).join("  ·  "),
  ]
    .filter((line) => line !== "")
    .join("\n");

  const rows: [string, string][] = [
    ["Invoice number", model.invoiceNumber],
    ["Invoice date", formatDate(model.invoiceDate)],
  ];
  if (model.dueDate) rows.push(["Due date", formatDate(model.dueDate)]);
  rows.push(["Total", money(totals.total)]);
  if (totals.amountPaid.gt(0)) rows.push(["Amount paid", money(totals.amountPaid)]);
  rows.push(["Amount due", due]);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#12151c">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
        <div style="font-size:15px;font-weight:600">${escapeHtml(business)}</div>
        ${model.business.email ? `<div style="font-size:13px;color:#66758e;margin-top:2px">${escapeHtml(model.business.email)}</div>` : ""}
      </div>
      <div style="padding:24px">
        <div style="font-size:15px;margin-bottom:16px;white-space:pre-line">${escapeHtml(intro)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
          ${rows
            .map(
              ([k, v]) =>
                `<tr>
                   <td style="padding:7px 0;color:#66758e;border-bottom:1px solid #f1f2f4">${escapeHtml(k)}</td>
                   <td style="padding:7px 0;text-align:right;font-weight:600;border-bottom:1px solid #f1f2f4">${escapeHtml(v)}</td>
                 </tr>`,
            )
            .join("")}
        </table>
        ${
          options.payUrl && options.includeLink && totals.amountDue.gt(0)
            ? `<div style="margin-top:24px"><a href="${escapeHtml(options.payUrl)}" style="display:inline-block;background:#12151c;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:600">Pay ${escapeHtml(due)}</a></div>`
            : ""
        }
        ${
          options.publicUrl && options.includeLink
            ? `<div style="margin-top:16px;font-size:13px"><a href="${escapeHtml(options.publicUrl)}" style="color:#1f4be8">View the full invoice online</a></div>`
            : ""
        }
        ${model.notes ? `<div style="margin-top:24px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#66758e;font-weight:600">Notes</div><div style="font-size:13px;margin-top:4px;white-space:pre-line">${escapeHtml(model.notes)}</div></div>` : ""}
        ${model.terms ? `<div style="margin-top:16px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#66758e;font-weight:600">Terms &amp; conditions</div><div style="font-size:13px;margin-top:4px;white-space:pre-line">${escapeHtml(model.terms)}</div></div>` : ""}
      </div>
      <div style="padding:16px 24px;background:#fafbfc;border-top:1px solid #e5e7eb;font-size:12px;color:#66758e">
        ${escapeHtml([model.business.email, model.business.phone, model.business.website].filter(Boolean).join("  ·  "))}
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
