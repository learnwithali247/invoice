import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paypalProvider } from "@/lib/payments/paypal";
import { PaymentError, type PaymentEvent } from "@/lib/payments/provider";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/payments/webhook/paypal
 *
 * Signature-verified (via PayPal's `/v1/notifications/verify-webhook-signature`),
 * then the same idempotent `record_payment` path used for Stripe.
 */
export async function POST(request: Request) {
  let events: PaymentEvent[];
  try {
    events = await paypalProvider.parseWebhook(request);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ received: false }, { status: error.status });
    }
    console.error("[paypal-webhook] verification failed", error);
    return NextResponse.json({ received: false }, { status: 400 });
  }

  if (events.length === 0) {
    return NextResponse.json({ received: true, handled: 0 });
  }

  const admin = createAdminClient();
  let handled = 0;

  for (const event of events) {
    const { data: seen } = await admin
      .from("payment_transactions")
      .select("id")
      .eq("provider", "paypal")
      .eq("provider_session_id", event.sessionId ?? `evt:${event.eventId}`)
      .eq("status", mapStatus(event.status))
      .maybeSingle();
    if (seen) continue;

    let invoiceId = event.invoiceId;

    // PayPal's CHECKOUT.ORDER.APPROVED may not carry custom_id — resolve it
    // server-side from the order itself rather than trusting the payload.
    if (!invoiceId && event.sessionId) {
      const order = await paypalProvider.verifySession(event.sessionId);
      invoiceId = (order as { invoiceId?: string | null } | null)?.invoiceId ?? null;
    }

    if (!invoiceId) {
      console.warn("[paypal-webhook] could not resolve invoice for", event.sessionId);
      continue;
    }

    const { data: invoice } = await admin.from("invoices").select("id").eq("id", invoiceId).maybeSingle();
    if (!invoice) continue;

    const { error } = await admin.rpc("record_payment", {
      p_invoice_id: invoice.id,
      p_provider: "paypal",
      p_amount: event.amount,
      p_currency: event.currency,
      p_session_id: event.sessionId,
      p_payment_id: event.paymentId,
      p_status: mapStatus(event.status),
      p_is_test: event.testMode,
      p_raw_event: event.raw as unknown as Json,
    });

    if (error) {
      console.error("[paypal-webhook] record_payment failed", error.code);
      continue;
    }
    handled += 1;
  }

  return NextResponse.json({ received: true, handled });
}

function mapStatus(status: PaymentEvent["status"]) {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "refunded":
      return "refunded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}
