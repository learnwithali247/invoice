import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeProvider } from "@/lib/payments/stripe";
import { PaymentError, type PaymentEvent } from "@/lib/payments/provider";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/payments/webhook/stripe
 *
 * The ONLY place an invoice is marked paid for Stripe. The `Stripe-Signature`
 * header is verified against the endpoint's webhook secret (HMAC-SHA256 of
 * `timestamp.payload`, with a 5-minute replay window), and the unique index on
 * (provider, provider_session_id, status) makes duplicate deliveries idempotent.
 */
export async function POST(request: Request) {
  let events: PaymentEvent[];
  try {
    events = await stripeProvider.parseWebhook(request);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ received: false }, { status: error.status });
    }
    console.error("[stripe-webhook] verification failed", error);
    return NextResponse.json({ received: false }, { status: 400 });
  }

  if (events.length === 0) {
    return NextResponse.json({ received: true, handled: 0 });
  }

  const admin = createAdminClient();
  let handled = 0;

  for (const event of events) {
    if (event.eventId) {
      const { data: seen } = await admin
        .from("payment_transactions")
        .select("id")
        .eq("provider", event.provider)
        .eq("provider_session_id", event.sessionId ?? `evt:${event.eventId}`)
        .eq("status", mapStatus(event.status))
        .maybeSingle();
      if (seen) {
        console.info("[stripe-webhook] duplicate event ignored", event.eventId);
        continue;
      }
    }

    const invoiceId = event.invoiceId;
    if (!invoiceId) {
      console.warn("[stripe-webhook] event without invoice reference", event.eventType);
      continue;
    }

    const { data: invoice } = await admin
      .from("invoices")
      .select("id,user_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      console.warn("[stripe-webhook] unknown invoice", invoiceId);
      continue;
    }

    const { error } = await admin.rpc("record_payment", {
      p_invoice_id: invoice.id,
      p_provider: "stripe",
      p_amount: event.amount,
      p_currency: event.currency,
      p_session_id: event.sessionId,
      p_payment_id: event.paymentId,
      p_status: mapStatus(event.status),
      p_is_test: event.testMode,
      p_raw_event: event.raw as unknown as Json,
    });

    if (error) {
      console.error("[stripe-webhook] record_payment failed", error.code, error.message);
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
