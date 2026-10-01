import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getInvoiceByToken } from "@/lib/invoice/service";
import { publicPayloadToRenderModel } from "@/lib/invoice/mappers";
import { publicLogoUrl } from "@/lib/invoice/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/public/invoices/[token]
 *
 * Anonymous, token-scoped read. Returns only customer-facing fields via the
 * `get_public_invoice` SECURITY DEFINER function — never user ids or internal
 * flags.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;

    const invoice = await getInvoiceByToken(token);
    if (!invoice) return jsonError("This invoice link is not valid.", 404, "not_found");

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    const { data, error } = await supabase.rpc("get_public_invoice", { p_token: token });
    if (error) {
      console.error("[public-invoice] rpc failed", error.code);
      return jsonError("This invoice link could not be opened.", 500, "server_error");
    }
    if (!data) return jsonError("This invoice link is not valid.", 404, "not_found");

    const model = publicPayloadToRenderModel(data as Record<string, unknown>);
    if (!model) return jsonError("This invoice link is not valid.", 404, "not_found");

    const logoUrl = await publicLogoUrl(model.business.logoPath);
    if (logoUrl) model.business.logoUrl = logoUrl;

    const amountDue = Number(invoice.amount_due ?? 0);

    return jsonOk({
      model,
      meta: {
        paymentEnabled: Boolean(invoice.payment_enabled) && amountDue > 0,
        amountDue,
        paymentStatus: invoice.payment_status,
        published: Boolean(invoice.published_at),
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/public/invoices/[token]");
  }
}
