import "server-only";
import { ConsoleEmailProvider } from "./console";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./provider";

let cached: EmailProvider | null = null;

/**
 * Choose the email provider from env. Add new providers here without touching
 * any calling code.
 */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const provider = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  const from = process.env.EMAIL_FROM || "Invoice Generator <no-reply@example.com>";

  if (provider === "resend") {
    const resend = new ResendEmailProvider(process.env.RESEND_API_KEY ?? null, from);
    cached = resend.isConfigured() ? resend : new ConsoleEmailProvider();
  } else {
    cached = new ConsoleEmailProvider();
  }

  return cached;
}

export function emailStatus() {
  const provider = getEmailProvider();
  return { provider: provider.name, configured: provider.isConfigured(), real: provider.name !== "console" };
}

export * from "./provider";
