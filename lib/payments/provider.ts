import "server-only";

export type CheckoutLineItem = {
  name: string;
  description?: string;
  /** Decimal major-unit amount, e.g. 199.99 */
  amount: number;
  quantity: number;
};

export type CreateCheckoutInput = {
  invoiceId: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  /** decimals of the currency's minor unit (JPY = 0) */
  decimals: number;
  businessName: string;
  customerEmail?: string | null;
  publicToken: string;
  returnPath: string;
  cancelPath: string;
  testMode: boolean;
};

export type CheckoutSession = {
  id: string;
  url: string;
};

export type PaymentEvent = {
  provider: "stripe" | "paypal";
  eventId: string;
  eventType: string;
  sessionId: string | null;
  paymentId: string | null;
  invoiceId: string | null;
  amount: number;
  currency: string;
  status: "succeeded" | "failed" | "pending" | "refunded" | "cancelled";
  testMode: boolean;
  raw: unknown;
};

/**
 * Adding a provider means implementing this interface and registering it in
 * `lib/payments/index.ts`. Nothing in the invoice code needs to change.
 */
export interface PaymentProvider {
  readonly name: "stripe" | "paypal";
  readonly label: string;
  isConfigured(): boolean;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Verify and normalise a provider webhook payload. Throws if the signature is invalid. */
  parseWebhook(request: Request): Promise<PaymentEvent[]>;
  /** Optional: resolve a session server-side (used as a defence-in-depth check on return). */
  verifySession?(sessionId: string): Promise<{ paid: boolean; amount: number; currency: string } | null>;
}

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** Hides provider internals behind one safe, user-facing message. */
export function safePaymentMessage(error: unknown): string {
  if (error instanceof PaymentError) return error.message;
  return "The payment provider could not be reached. Please try again.";
}
