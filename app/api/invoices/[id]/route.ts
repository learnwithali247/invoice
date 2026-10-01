import { requireUser, getInvoice, softDeleteInvoice } from "@/lib/invoice/service";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const result = await getInvoice(id);
    if (!result) return jsonError("Invoice not found.", 404, "not_found");
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error, "GET /api/invoices/[id]");
  }
}

/** Soft delete — the row is retained so audit trails and payments stay intact. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { supabase, user } = await requireUser();
    const { id } = await params;
    const existing = await getInvoice(id);
    if (!existing) return jsonError("Invoice not found.", 404, "not_found");
    await softDeleteInvoice(user.id, id);
    return jsonOk({ id, deleted: true, supabase: Boolean(supabase) });
  } catch (error) {
    return handleApiError(error, "DELETE /api/invoices/[id]");
  }
}
