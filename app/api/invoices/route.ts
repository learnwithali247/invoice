import { invoicePayloadSchema } from "@/lib/validation/schemas";
import { requireUser, saveInvoice, saveCustomer, listInvoices } from "@/lib/invoice/service";
import { handleApiError, jsonOk, readJson } from "@/lib/api";
import { listQuerySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET /api/invoices — paginated, filtered, sorted list for the dashboard. */
export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const url = new URL(request.url);
    const params = listQuerySchema.parse(Object.fromEntries(url.searchParams));

    const result = await listInvoices(user.id, params);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error, "GET /api/invoices");
  }
}

/**
 * POST /api/invoices — create or update an invoice.
 *
 * Totals supplied by the browser are ignored: the database recalculates them.
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = await readJson(request);
    const payload = invoicePayloadSchema.parse(body);

    if (payload.saveCustomer && payload.customer.name.trim()) {
      const customerId = await saveCustomer(user.id, payload.customer);
      if (customerId) payload.customer.id = customerId;
    }

    const result = await saveInvoice(user.id, payload);

    // On autosave of an existing invoice the server skips the read-back, so it
    // returns nulls plus any ids it had to mint. A first save returns the whole
    // persisted invoice.
    if (!result.invoice) {
      return jsonOk({
        saved: true,
        minimal: true,
        id: payload.id,
        reassigned: result.reassigned ?? [],
      });
    }

    return jsonOk({ invoice: result.invoice, items: result.items ?? [] });
  } catch (error) {
    return handleApiError(error, "POST /api/invoices");
  }
}
