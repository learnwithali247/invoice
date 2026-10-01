import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  getBusinessSettings,
  getInvoice,
  requireUser,
  signedLogoUrl,
} from "@/lib/invoice/service";
import { invoiceToDraft, toRenderModel, businessRowToInfo } from "@/lib/invoice/mappers";
import { buildInvoiceEmail } from "@/lib/email/invoice-email";
import { getEmailProvider } from "@/lib/email";
import { renderInvoicePdf, pdfFileName } from "@/lib/pdf/render";
import { sendInvoiceSchema } from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invoices/[id]/send
 * Sends the invoice email with an optional PDF attachment and secure links.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const payload = sendInvoiceSchema.parse(await readJson(request));

    const found = await getInvoice(id);
    if (!found) return jsonError("Invoice not found.", 404, "not_found");

    const settings = await getBusinessSettings(user.id);
    const logoUrl = await signedLogoUrl(settings?.logo_path ?? null, 60 * 15);

    const draft = invoiceToDraft(found.invoice, found.items);
    const model = toRenderModel(draft, businessRowToInfo(settings), found.invoice.currency_symbol);
    model.publicToken = found.invoice.public_token;
    model.business.logoUrl = logoUrl;

    const publicUrl = absoluteUrl(`/i/${found.invoice.public_token}`);
    const payUrl = absoluteUrl(`/pay/invoice/${found.invoice.public_token}`);
    const amountDue = Number(found.invoice.amount_due ?? 0);

    const message = buildInvoiceEmail(model, {
      publicUrl,
      payUrl: found.invoice.payment_enabled && amountDue > 0 ? payUrl : null,
      customMessage: payload.message ?? null,
      includeLink: payload.includeLink,
    });

    const attachments = [];
    if (payload.includePdf) {
      const buffer = await renderInvoicePdf(model, logoUrl ?? undefined);
      attachments.push({
        filename: pdfFileName(model),
        contentType: "application/pdf",
        content: buffer,
      });
    }

    const provider = getEmailProvider();
    const result = await provider.send({
      to: payload.to,
      subject: payload.subject?.trim() || message.subject,
      text: message.text,
      html: message.html,
      attachments,
      replyTo: settings?.email || undefined,
    });

    const supabase = await createClient();
    await supabase
      .from("invoices")
      .update({
        published_at: new Date().toISOString(),
        ...(found.invoice.status === "draft" ? { status: "sent" } : {}),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return jsonOk({
      sent: true,
      provider: provider.name,
      messageId: result.id,
      includedPdf: payload.includePdf,
      note:
        provider.name === "console"
          ? "Email provider is set to console — nothing was actually sent."
          : undefined,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/invoices/[id]/send");
  }
}
