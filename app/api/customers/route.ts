import { requireUser, listCustomers } from "@/lib/invoice/service";
import { handleApiError, jsonOk } from "@/lib/api";
import { customerSchemaInput } from "@/lib/validation/schemas";
import type { CustomerRow } from "@/types/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? "";
    const customers = await listCustomers(user.id, search);
    return jsonOk(customers as CustomerRow[]);
  } catch (error) {
    return handleApiError(error, "GET /api/customers");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const payload = customerSchemaInput.parse(body);

    if (!payload.name.trim()) return jsonOk(null);

    const row = {
      user_id: user.id,
      name: payload.name.trim(),
      company: payload.company || null,
      email: payload.email || null,
      phone: payload.phone || null,
      billing_address: payload.address || null,
      shipping_address: payload.shippingAddress || null,
      tax_id: payload.taxId || null,
      notes: payload.notes || null,
    };

    const query = payload.id
      ? supabase.from("customers").update(row).eq("id", payload.id).select("*").maybeSingle()
      : supabase.from("customers").insert(row).select("*").maybeSingle();

    const { data, error } = await query;
    if (error || !data) return jsonOk(null);

    return jsonOk(data as CustomerRow, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/customers");
  }
}
