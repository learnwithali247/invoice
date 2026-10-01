import { NextResponse } from "next/server";
import { checkSchema, invalidateSchemaCache, REQUIRED_TABLES } from "@/lib/supabase/schema-check";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import { getPaymentEnvironment } from "@/lib/payments/env";
import { emailStatus } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — deployment self-check.
 *
 * Reports whether the environment, the database schema, the payment providers
 * and the email provider are all wired up. Safe to call: it exposes no secrets.
 */
export async function GET() {
  const configured = isSupabaseConfigured();
  const serviceRole = isServiceRoleConfigured();

  let schema: Awaited<ReturnType<typeof checkSchema>> | null = null;
  if (configured) {
    invalidateSchemaCache();
    schema = await checkSchema({ fresh: true }).catch(() => ({
      ok: false,
      missingTables: [],
      errorCode: "UNREACHABLE",
      errorMessage: "Could not reach Supabase.",
    }));
  }

  let payments: { mode: string; providers: Record<string, boolean> } | null = null;
  try {
    const env = getPaymentEnvironment();
    payments = {
      mode: env.mode,
      providers: {
        stripe: Boolean(env.stripe.secretKey),
        paypal: Boolean(env.paypal.clientId && env.paypal.clientSecret),
      },
    };
  } catch {
    payments = null;
  }

  const ready = configured && schema?.ok === true;

  return NextResponse.json(
    {
      ok: ready,
      supabase: { publicKey: configured, secretKey: serviceRole },
      schema: schema
        ? {
            ok: schema.ok,
            required: REQUIRED_TABLES,
            missingTables: schema.missingTables,
            errorCode: schema.errorCode,
            errorMessage: schema.errorMessage,
          }
        : { ok: false, required: REQUIRED_TABLES, missingTables: [], reason: "Supabase is not configured" },
      payments,
      email: (() => {
        try {
          return emailStatus();
        } catch {
          return { provider: "unknown", configured: false, real: false };
        }
      })(),
    },
    { status: ready ? 200 : 503 },
  );
}
