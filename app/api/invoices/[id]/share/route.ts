import { requireUser, getBusinessSettings } from "@/lib/invoice/service";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invoices/[id]/share
 * Returns the public view / payment links for a saved invoice.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { user, supabase } = await requireUser();
    const { id } = await params;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id,public_token,payment_enabled,amount_due,deleted_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return jsonError("Could not load the invoice.", 500, "db_error");
    if (!invoice) return jsonError("Invoice not found.", 404, "not_found");

    // save first so links always resolve
    await supabase
      .from("invoices")
      .update({ published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    const settings = await getBusinessSettings(user.id);
    void readJson;

    return jsonOk({
      viewUrl: absoluteUrl(`/i/${invoice.public_token}`),
      payUrl: absoluteUrl(`/pay/invoice/${invoice.public_token}`),
      paymentEnabled: invoice.payment_enabled && Number(invoice.amount_due ?? 0) > 0,
      businessName: settings?.business_name ?? "",
    });
  } catch (error) {
    return handleApiError(error, "POST /api/invoices/[id]/share");
  }
}
