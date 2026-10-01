import { requireUser, getInvoice, getBusinessSettings, signedLogoUrl } from "@/lib/invoice/service";
import { handleApiError, jsonError } from "@/lib/api";
import { invoiceToDraft, toRenderModel, businessRowToInfo } from "@/lib/invoice/mappers";
import { renderInvoicePdf, pdfFileName } from "@/lib/pdf/render";
import { appUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invoices/[id]/pdf
 *
 * Streams a real vector PDF (selectable text, repeating table header,
 * multi-page aware) generated from the same render model as the live preview.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const found = await getInvoice(id);
    if (!found) return jsonError("Invoice not found.", 404, "not_found");

    const settings = await getBusinessSettings(user.id);
    const logoUrl = await signedLogoUrl(settings?.logo_path ?? null, 60 * 15);

    const draft = invoiceToDraft(found.invoice, found.items);
    const model = toRenderModel(draft, businessRowToInfo(settings), found.invoice.currency_symbol);
    model.publicToken = found.invoice.public_token;
    model.business.logoUrl = logoUrl;
    // the payment link printed on the PDF must point at the deployed origin
    const origin = (
      process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
        ? process.env.NEXT_PUBLIC_APP_URL
        : appUrl()
    ).replace(/\/$/, "");
    model.payUrl = `${origin}/pay/invoice/${found.invoice.public_token}`;

    const buffer = await renderInvoicePdf(model, logoUrl ?? undefined);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName(model)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error, "POST /api/invoices/[id]/pdf");
  }
}
