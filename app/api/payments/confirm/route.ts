import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getInvoiceByToken } from "@/lib/invoice/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { paypalProvider } from "@/lib/payments/paypal";
import { paymentMode, safePaymentMessage } from "@/lib/payments";
import { PaymentError } from "@/lib/payments/provider";
import type { Json } from "@/types/database";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  token: z.string().trim().min(20).max(120),
  orderId: z.string().trim().max(64).optional(),
});

/**
 * POST /api/payments/confirm
 *
 * Called when the payer comes back from PayPal. The order is captured
 * server-to-server and the result written through the same `record_payment`
 * path used by the webhook.
 *
 * For Stripe the browser return is NEVER trusted — the signed webhook is the
 * sole authority, so this endpoint only reports the currently stored status.
 */
export async function POST(request: Request) {
  try {
    const payload = bodySchema.parse(await readJson(request));

    const invoice = await getInvoiceByToken(payload.token);
    if (!invoice) return jsonError("This invoice link is not valid.", 404, "not_found");

    if (payload.orderId) {
      try {
        const captured = await paypalProvider.captureOrder(payload.orderId);
        if (captured.status === "COMPLETED") {
          const unit = captured.purchase_units?.[0];
          const admin = createAdminClient();
          await admin.rpc("record_payment", {
            p_invoice_id: invoice.id,
            p_provider: "paypal",
            p_amount: Number(unit?.amount?.value ?? 0),
            p_currency: unit?.amount?.currency_code ?? invoice.currency,
            p_session_id: payload.orderId,
            p_payment_id: unit?.payments?.captures?.[0]?.id ?? null,
            p_status: "succeeded",
            p_is_test: paymentMode().isTest,
            p_raw_event: captured as unknown as Json,
          });
        }
      } catch (error) {
        if (error instanceof PaymentError) {
          return jsonError(safePaymentMessage(error), error.status, "payment_error");
        }
        console.error("[confirm] capture failed", error);
      }
    }

    const { data: fresh } = await createAdminClient()
      .from("invoices")
      .select("payment_status,amount_paid,amount_due,total")
      .eq("id", invoice.id)
      .single();

    return jsonOk({
      paymentStatus: fresh?.payment_status ?? "unpaid",
      amountPaid: Number(fresh?.amount_paid ?? 0),
      amountDue: Number(fresh?.amount_due ?? 0),
      total: Number(fresh?.total ?? 0),
      verifiedByWebhook: true,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/payments/confirm");
  }
}
