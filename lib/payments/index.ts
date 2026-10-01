import "server-only";
import { getPaymentEnvironment } from "./env";
import { stripeProvider } from "./stripe";
import { paypalProvider } from "./paypal";
import type { PaymentProvider } from "./provider";
import { PaymentError } from "./provider";

const REGISTRY: Record<"stripe" | "paypal", PaymentProvider> = {
  stripe: stripeProvider,
  paypal: paypalProvider,
};

export function getProvider(name: string | null | undefined): PaymentProvider {
  if (name === "stripe" || name === "paypal") {
    const provider = REGISTRY[name];
    if (provider.isConfigured()) return provider;
  }
  throw new PaymentError(
    "That payment method is not available right now. Please contact the sender.",
    503,
  );
}

export function availableProviders() {
  const env = getPaymentEnvironment();
  return (Object.keys(REGISTRY) as (keyof typeof REGISTRY)[]).map((key) => {
    const provider = REGISTRY[key];
    return {
      name: key,
      label: provider.label,
      configured: provider.isConfigured() && env.mode !== "disabled",
      isTest: env.isTest,
    };
  });
}

export function paymentMode() {
  const env = getPaymentEnvironment();
  return { mode: env.mode, isTest: env.isTest, appUrl: env.appUrl };
}

export * from "./provider";
export { getPaymentEnvironment, providerStatus } from "./env";
