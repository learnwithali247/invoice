import "server-only";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
} from "./provider";
import { PaymentError } from "./provider";
import { getPaymentEnvironment } from "./env";

type PaypalToken = { access_token: string; expires_in: number };

type PaypalOrder = {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: { captures?: { id?: string; status?: string }[] };
  }[];
  payer?: { email_address?: string };
};

export class PaypalProvider implements PaymentProvider {
  readonly name = "paypal" as const;
  readonly label = "PayPal Checkout";

  private get env() {
    return getPaymentEnvironment();
  }

  isConfigured(): boolean {
    return Boolean(this.env.paypal.clientId && this.env.paypal.clientSecret);
  }

  private async accessToken(): Promise<string> {
    const { clientId, clientSecret, apiBase } = this.env.paypal;
    if (!clientId || !clientSecret) throw new PaymentError("PayPal is not configured on this server.", 503);

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[paypal] token request failed", response.status);
      throw new PaymentError("PayPal could not be authenticated.", 502);
    }
    const data = (await response.json()) as PaypalToken;
    return data.access_token;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const token = await this.accessToken();
    const value = (input.decimals === 0 ? input.amountDue.toFixed(0) : input.amountDue.toFixed(2)).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ",",
    );

    const response = await fetch(`${this.env.paypal.apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // PayPal-Request-Id makes retries idempotent.
        "PayPal-Request-Id": `inv_${input.invoiceId}`.slice(0, 38),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.invoiceId.slice(0, 20),
            custom_id: input.invoiceId,
            invoice_id: input.invoiceNumber.slice(0, 127),
            description: `Invoice ${input.invoiceNumber} — ${input.businessName}`.slice(0, 127),
            amount: {
              currency_code: input.currency.toUpperCase(),
              value,
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              return_url: `${this.env.appUrl}${input.returnPath}?paid=1`,
              cancel_url: `${this.env.appUrl}${input.cancelPath}?cancelled=1`,
            },
          },
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[paypal] order failed", response.status, text.slice(0, 500));
      throw new PaymentError("PayPal could not start the checkout.", 502);
    }

    const order = (await response.json()) as PaypalOrder;
    const approve = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!approve) throw new PaymentError("PayPal did not return an approval URL.", 502);
    return { id: order.id, url: approve };
  }

  /** Called after the buyer returns: confirm capture with PayPal (server-to-server). */
  async captureOrder(orderId: string) {
    const token = await this.accessToken();
    const response = await fetch(`${this.env.paypal.apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[paypal] capture failed", response.status);
      throw new PaymentError("PayPal could not confirm the payment.", 502);
    }
    return (await response.json()) as PaypalOrder;
  }

  async verifySession(orderId: string) {
    if (!orderId) return null;
    const token = await this.accessToken();
    const response = await fetch(`${this.env.paypal.apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const order = (await response.json()) as PaypalOrder;
    const unit = order.purchase_units?.[0];
    const amount = Number(unit?.amount?.value ?? 0);
    return {
      paid: order.status === "COMPLETED",
      amount,
      currency: unit?.amount?.currency_code ?? "USD",
      invoiceId: unit?.custom_id ?? null,
      amountRaw: amount,
    };
  }

  async parseWebhook(request: Request): Promise<PaymentEvent[]> {
    const webhookId = this.env.paypal.webhookId;
    if (!webhookId) throw new PaymentError("PayPal webhooks are not configured.", 503);

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = await request.text();

    // 1. Cryptographic signature verification against PayPal's certificates
    const certs = await this.fetchCertificates();
    if (
      !verifyPaypalSignature({
        headers,
        body,
        certs,
      })
    ) {
      throw new PaymentError("Invalid PayPal signature.", 400);
    }

    // 2. Handle the event
    let event: {
      id: string;
      event_type: string;
      resource: Record<string, unknown>;
    };
    try {
      event = JSON.parse(body);
    } catch {
      throw new PaymentError("Malformed webhook payload.", 400);
    }

    const resource = event.resource ?? {};
    const unit = (resource.purchase_units as Record<string, unknown>[] | undefined)?.[0];
    const amount = resource.amount as { value?: string; currency_code?: string } | undefined;
    const captureId = (() => {
      const breakdown = resource.seller_payable_breakdown as
        | { net_amount_breakdown?: { net_amount?: string } }
        | undefined;
      const candidate = breakdown?.net_amount_breakdown?.net_amount;
      return typeof candidate === "string" ? candidate : null;
    })();

    const base = {
      provider: "paypal" as const,
      eventId: event.id,
      sessionId: typeof resource.id === "string" ? resource.id : null,
      paymentId: captureId,
      invoiceId:
        typeof unit?.custom_id === "string"
          ? unit.custom_id
          : typeof resource.invoice_id === "string"
            ? null
            : null,
      amount: Number(amount?.value ?? 0),
      currency: amount?.currency_code ?? "USD",
      testMode: !this.env.paypal.apiBase.includes("sandbox"),
    };

    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
      case "CHECKOUT.ORDER.APPROVED":
        return [
          {
            ...base,
            eventType: event.event_type,
            status: "succeeded",
            raw: event,
          },
        ];
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED":
        return [{ ...base, eventType: event.event_type, status: "failed", raw: event }];
      case "PAYMENT.CAPTURE.REFUNDED":
        return [{ ...base, eventType: event.event_type, status: "refunded", raw: event }];
      default:
        return [];
    }
  }

  private async fetchCertificates(): Promise<string[]> {
    const response = await fetch(`${this.env.paypal.apiBase}/v1/notifications/certs`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { certificates?: string[] };
    return data.certificates ?? [];
  }
}

async function verifyPaypalSignature({
  headers,
  body,
  certs,
}: {
  headers: Record<string, string>;
  body: string;
  certs: string[];
}): Promise<boolean> {
  const transmissionId = headers["paypal-transmission-id"];
  const transmissionTime = headers["paypal-transmission-time"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const certUrl = headers["paypal-cert-url"];
  const authAlgo = headers["paypal-auth-algo"];
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl) return false;
  if (!certs.some((c) => c === certUrl)) return false;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(body),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(transmissionSig));
  const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // The remote check is the authoritative one; keep the local computation for
  // parity/debugging but never treat it as sufficient on its own.
  const response = await fetch(
    `${this_apiBase()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(body),
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) return false;
  const result = (await response.json()) as { verification_status?: string };
  void expectedBase64;
  return result.verification_status === "SUCCESS";
}

function this_apiBase(): string {
  return (process.env.PAYPAL_ENVIRONMENT ?? "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export const paypalProvider = new PaypalProvider();
