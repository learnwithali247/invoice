export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/status
 * Lightweight, token-scoped payment status read used by the public payment page
 * while it waits for a provider webhook. Never mutates anything.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token || token.length < 16) {
    return Response.json({ ok: false, error: "Invalid token" }, { status: 400 });
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await createAdminClient()
      .from("invoices")
      .select("payment_status,amount_paid,amount_due,total")
      .eq("public_token", token)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return Response.json(
      {
        ok: true,
        data: {
          paymentStatus: data.payment_status,
          amountPaid: Number(data.amount_paid ?? 0),
          amountDue: Number(data.amount_due ?? 0),
          total: Number(data.total ?? 0),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[payment-status]", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
