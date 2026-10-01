import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getInvoiceByToken } from "@/lib/invoice/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentCheckoutSchema } from "@/lib/validation/schemas";
import { getProvider, paymentMode, safePaymentMessage } from "@/lib/payments";
import { PaymentError } from "@/lib/payments/provider";
import { getCurrency } from "@/lib/invoice/currencies";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/payments/checkout
 *
 * Creates a provider checkout session for a shared invoice. The amount is read
 * from the database (never from the request) so a tampered client cannot change
 * what is charged.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = paymentCheckoutSchema.parse(body);

    const invoice = await getInvoiceByToken(payload.token);
    if (!invoice) return jsonError("This invoice link is not valid.", 404, "not_found");
    if (!invoice.payment_enabled) {
      return jsonError("Online payment is not enabled for this invoice.", 400, "payment_disabled");
    }

    const amountDue = Number(invoice.amount_due ?? 0);
    if (amountDue <= 0) {
      return jsonError("This invoice has nothing left to pay.", 400, "nothing_due");
    }

    const provider = getProvider(payload.provider);
    const currency = getCurrency(invoice.currency, invoice.currency_symbol);

    // record the attempt before redirecting the payer away
    const session = await provider.createCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amountDue,
      currency: currency.code,
      decimals: currency.decimals,
      businessName: invoice.customer_company || invoice.customer_name || "Invoice",
      customerEmail: null,
      publicToken: invoice.public_token,
      returnPath: `/pay/invoice/${invoice.public_token}`,
      cancelPath: `/pay/invoice/${invoice.public_token}`,
      testMode: paymentMode().isTest,
    });

    // server-side write (service role) — the payer has no session, and RLS must
    // never be bypassed by a public route
    if (invoice.payment_status === "unpaid" || invoice.payment_status === "overdue") {
      try {
        const admin = createAdminClient();
        await admin
          .from("invoices")
          .update({ payment_status: "pending" })
          .eq("id", invoice.id);
      } catch (err) {
        console.error("[checkout] could not mark invoice pending", err);
      }
    }

    return jsonOk({ url: session.url, sessionId: session.id, provider: provider.name });
  } catch (error) {
    if (error instanceof PaymentError) {
      return jsonError(safePaymentMessage(error), error.status, "payment_error");
    }
    return handleApiError(error, "POST /api/payments/checkout");
  }
}
