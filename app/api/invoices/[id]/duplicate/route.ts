import { requireUser, getInvoice } from "@/lib/invoice/service";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { invoiceToDraft } from "@/lib/invoice/mappers";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invoices/[id]/duplicate
 *
 * Duplicates the invoice with a freshly reserved invoice number. The original
 * is never modified.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { supabase, user } = await requireUser();
    const { id } = await params;

    const source = await getInvoice(id);
    if (!source) return jsonError("Invoice not found.", 404, "not_found");

    const draft = invoiceToDraft(source.invoice, source.items);
    draft.id = null;
    draft.invoiceNumber = "";
    draft.status = "draft";
    draft.paymentStatus = "unpaid";
    draft.publicToken = "";
    draft.invoiceDate = new Date().toISOString().slice(0, 10);
    const due = new Date(draft.invoiceDate);
    due.setDate(due.getDate() + 14);
    draft.dueDate = due.toISOString().slice(0, 10);

    const { saveInvoice } = await import("@/lib/invoice/service");
    const { invoicePayloadSchema } = await import("@/lib/validation/schemas");

    const payload = invoicePayloadSchema.parse({
      id: null,
      invoiceNumber: "",
      invoiceType: draft.invoiceType,
      status: "draft",
      customer: draft.customer,
      invoiceDate: draft.invoiceDate,
      dueDate: draft.dueDate,
      poNumber: draft.poNumber,
      reference: draft.reference,
      currency: draft.currency,
      paymentTerms: draft.paymentTerms,
      items: draft.items.map((item) => ({
        id: "",
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        tax: item.tax,
      })),
      discountType: draft.discountType,
      discountValue: draft.discountValue,
      shipping: draft.shipping,
      fees: draft.fees,
      adjustment: draft.adjustment,
      amountPaid: "0",
      template: draft.template,
      design: draft.design,
      notes: draft.notes,
      terms: draft.terms,
      footerText: draft.footerText,
      paymentInstructions: draft.paymentInstructions,
      paymentEnabled: draft.paymentEnabled,
      paymentProvider: draft.paymentProvider,
    });

    const created = await saveInvoice(user.id, payload);
    void supabase;
    return jsonOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/invoices/[id]/duplicate");
  }
}
