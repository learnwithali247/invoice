import "server-only";

export type PaymentMode = "test" | "live" | "disabled";

export type PaymentEnvironment = {
  mode: PaymentMode;
  isTest: boolean;
  appUrl: string;
  stripe: { secretKey: string | null; publishableKey: string | null; webhookSecret: string | null };
  paypal: {
    clientId: string | null;
    clientSecret: string | null;
    webhookId: string | null;
    apiBase: string;
  };
};

function pick(...values: (string | undefined | null)[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

export function getPaymentEnvironment(): PaymentEnvironment {
  const rawMode = (process.env.PAYMENT_MODE ?? "disabled").toLowerCase();
  const mode: PaymentMode =
    rawMode === "test" || rawMode === "live" ? (rawMode as PaymentMode) : "disabled";
  const isTest = mode === "test";

  const paypalEnv = (process.env.PAYPAL_ENVIRONMENT ?? "sandbox").toLowerCase();
  const useLivePaypal = !isTest && paypalEnv === "live";

  return {
    mode,
    isTest,
    appUrl: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
    stripe: {
      secretKey: isTest
        ? pick(process.env.STRIPE_TEST_SECRET_KEY)
        : pick(process.env.STRIPE_LIVE_SECRET_KEY, process.env.STRIPE_TEST_SECRET_KEY),
      publishableKey: isTest
        ? pick(process.env.STRIPE_TEST_PUBLISHABLE_KEY)
        : pick(process.env.STRIPE_TEST_PUBLISHABLE_KEY),
      webhookSecret: pick(process.env.STRIPE_WEBHOOK_SECRET),
    },
    paypal: {
      clientId: useLivePaypal
        ? pick(process.env.PAYPAL_LIVE_CLIENT_ID)
        : pick(process.env.PAYPAL_TEST_CLIENT_ID, process.env.PAYPAL_LIVE_CLIENT_ID),
      clientSecret: useLivePaypal
        ? pick(process.env.PAYPAL_LIVE_CLIENT_SECRET)
        : pick(process.env.PAYPAL_TEST_CLIENT_SECRET, process.env.PAYPAL_LIVE_CLIENT_SECRET),
      webhookId: pick(process.env.PAYPAL_WEBHOOK_ID),
      apiBase: useLivePaypal ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
    },
  };
}

export type ProviderStatus = {
  provider: "stripe" | "paypal";
  configured: boolean;
  mode: PaymentMode;
  isTest: boolean;
  missing: string[];
};

export function providerStatus(name: "stripe" | "paypal"): ProviderStatus {
  const env = getPaymentEnvironment();
  const missing: string[] = [];
  if (env.mode === "disabled") missing.push("PAYMENT_MODE");

  if (name === "stripe") {
    if (!env.stripe.secretKey) missing.push(isTestKeyName(env, "STRIPE_TEST_SECRET_KEY", "STRIPE_LIVE_SECRET_KEY"));
    if (!env.stripe.webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
  } else {
    if (!env.paypal.clientId)
      missing.push(isTestKeyName(env, "PAYPAL_TEST_CLIENT_ID", "PAYPAL_LIVE_CLIENT_ID"));
    if (!env.paypal.clientSecret)
      missing.push(isTestKeyName(env, "PAYPAL_TEST_CLIENT_SECRET", "PAYPAL_LIVE_CLIENT_SECRET"));
  }

  return {
    provider: name,
    configured: missing.length === 0,
    mode: env.mode,
    isTest: env.isTest,
    missing,
  };
}

function isTestKeyName(env: PaymentEnvironment, testName: string, liveName: string): string {
  return env.isTest ? testName : liveName;
}
