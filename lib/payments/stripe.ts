import "server-only";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
} from "./provider";
import { PaymentError } from "./provider";
import { getPaymentEnvironment } from "./env";

const API = "https://api.stripe.com/v1";

type StripeSession = {
  id: string;
  url: string;
  payment_status: string;
  status: string;
  amount_total?: number;
  currency?: string;
};

async function stripeRequest<T>(
  path: string,
  init: { method: string; body?: URLSearchParams; secret: string },
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${init.secret}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.body?.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    // Log server-side; never surface provider internals to the browser.
    console.error("[stripe] request failed", response.status, text.slice(0, 500));
    throw new PaymentError(
      response.status === 429
        ? "The payment provider is busy. Please try again in a moment."
        : "Stripe could not start the checkout.",
      502,
    );
  }
  return (await response.json()) as T;
}

/** Convert a major-unit amount into Stripe's minor units. */
function toMinorUnits(amount: number, decimals: number): number {
  const value = decimals === 0 ? Math.round(amount) : Math.round(amount * 100);
  return Math.max(0, value);
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly label = "Stripe Checkout";

  private get env() {
    return getPaymentEnvironment();
  }

  isConfigured(): boolean {
    return Boolean(this.env.stripe.secretKey);
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const secret = this.env.stripe.secretKey;
    if (!secret) throw new PaymentError("Stripe is not configured on this server.", 503);

    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("client_reference_id", input.invoiceId);
    body.set("success_url", `${this.env.appUrl}${input.returnPath}?paid=1&session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", `${this.env.appUrl}${input.cancelPath}?cancelled=1`);
    body.set("currency", input.currency.toLowerCase());

    body.set("line_items[0][quantity]", "1");
    body.set(
      "line_items[0][price_data][currency]",
      input.currency.toLowerCase(),
    );
    body.set(
      "line_items[0][price_data][unit_amount]",
      String(toMinorUnits(input.amountDue, input.decimals)),
    );
    body.set(
      "line_items[0][price_data][product_data][name]",
      `Invoice ${input.invoiceNumber}`,
    );
    body.set(
      "line_items[0][price_data][product_data][description]",
      `${input.businessName} — amount due`.slice(0, 500),
    );

    if (input.customerEmail) body.set("customer_email", input.customerEmail);

    body.set("metadata[invoice_id]", input.invoiceId);
    body.set("metadata[invoice_number]", input.invoiceNumber);
    body.set("metadata[public_token]", input.publicToken);
    body.set("metadata[test_mode]", String(input.testMode));

    const session = await stripeRequest<StripeSession>("/checkout/sessions", {
      method: "POST",
      body,
      secret,
    });

    if (!session.url) throw new PaymentError("Stripe did not return a checkout URL.", 502);
    return { id: session.id, url: session.url };
  }

  async verifySession(sessionId: string) {
    const secret = this.env.stripe.secretKey;
    if (!secret || !sessionId.startsWith("cs_")) return null;
    const session = await stripeRequest<StripeSession>(
      `/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { method: "GET", secret },
    );
    return {
      paid: session.payment_status === "paid" || session.status === "complete",
      amount: (session.amount_total ?? 0) / 100,
      currency: (session.currency ?? "usd").toUpperCase(),
    };
  }

  /**
   * Verifies the `Stripe-Signature` header (HMAC-SHA256 of `t.payload`, signed
   * with the endpoint's webhook secret) before trusting any event.
   */
  async parseWebhook(request: Request): Promise<PaymentEvent[]> {
    const secret = this.env.stripe.webhookSecret;
    if (!secret) throw new PaymentError("Stripe webhooks are not configured.", 503);

    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new PaymentError("Missing Stripe signature.", 400);

    const payload = await request.text();
    const ok = await verifyStripeSignature(payload, signature, secret);
    if (!ok) throw new PaymentError("Invalid Stripe signature.", 400);

    const event = JSON.parse(payload) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
      created?: number;
      livemode?: boolean;
    };

    const obj = event.data.object ?? {};

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      return [
        {
          provider: "stripe",
          eventId: event.id,
          eventType: event.type,
          sessionId: typeof obj.id === "string" ? obj.id : null,
          paymentId: typeof obj.payment_intent === "string" ? obj.payment_intent : null,
          invoiceId:
            typeof obj.client_reference_id === "string"
              ? obj.client_reference_id
              : typeof obj.metadata === "object" && obj.metadata
                ? String((obj.metadata as Record<string, unknown>).invoice_id ?? "")
                : null,
          amount: typeof obj.amount_total === "number" ? obj.amount_total / 100 : 0,
          currency:
            typeof obj.currency === "string" ? obj.currency.toUpperCase() : "USD",
          status: "succeeded",
          testMode: event.livemode === false,
          raw: event,
        },
      ];
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      return [
        {
          provider: "stripe",
          eventId: event.id,
          eventType: event.type,
          sessionId: typeof obj.id === "string" ? obj.id : null,
          paymentId: null,
          invoiceId:
            typeof obj.client_reference_id === "string" ? obj.client_reference_id : null,
          amount: 0,
          currency: typeof obj.currency === "string" ? obj.currency.toUpperCase() : "USD",
          status: event.type.includes("expired") ? "cancelled" : "failed",
          testMode: event.livemode === false,
          raw: event,
        },
      ];
    }

    // Acknowledge unrelated events with a success code so Stripe stops retrying.
    return [];
  }
}

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = header.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  // replay protection
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => timingSafeEqualHex(sig, expected));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const stripeProvider = new StripeProvider();
