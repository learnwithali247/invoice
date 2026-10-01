import "server-only";
import { cache } from "react";
import { headers as nextHeaders } from "next/headers";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { invoiceTag } from "./public";
import { dec } from "@/lib/invoice/calculate";
import { uuid } from "@/lib/utils";
import { normaliseDesign } from "@/lib/invoice/design";
import { getCurrency } from "@/lib/invoice/currencies";
import type { InvoicePayload } from "@/lib/validation/schemas";
import type {
  BusinessSettingsRow,
  CustomerRow,
  Database,
  InvoiceItemRow,
  InvoiceRow,
  Json,
} from "@/types/database";

/**
 * Deduplicated per render pass.
 *
 * `auth.getUser()` is a network round trip to Supabase Auth, and middleware
 * has *already* validated (and refreshed) the session on this request and passed
 * the identity down in `x-user-id`. Reading that costs nothing, so a signed-in
 * page normally needs zero auth calls. The header is only ever set by
 * middleware after a successful token check, and is overwritten rather than
 * appended, so it cannot be forged. Anything without it — API routes, webhooks,
 * the print page opened in a new tab — falls back to the real check.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();

  try {
    const requestHeaders = await nextHeaders();
    const id = requestHeaders.get("x-user-id");
    if (id) {
      return {
        user: { id, email: requestHeaders.get("x-user-email") ?? "" },
        supabase,
      };
    }
  } catch {
    /* fall through to the network check */
  }

  const { data } = await supabase.auth.getUser();
  return { user: data.user, supabase };
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

export class ServiceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** PostgREST / Postgres codes that mean "you have not run the migration". */
const MISSING_SCHEMA_CODES = new Set(["PGRST205", "42P01", "PGRST200", "42883", "42703"]);

/**
 * Turns a Supabase error into a ServiceError.
 *
 * Logs the technical detail server-side (so it is diagnosable) and returns a
 * short, safe message. An un-migrated database gets its own clear message
 * instead of a generic 500.
 */
export function dbError(context: string, error: { code?: string; message?: string }): ServiceError {
  const code = error.code ?? "unknown";
  console.error(`[db] ${context} failed (${code}):`, error.message);

  if (MISSING_SCHEMA_CODES.has(code)) {
    return new ServiceError(
      "The database is not set up yet. Run supabase/migrations/001_initial_schema.sql in the Supabase SQL editor, then reload.",
      503,
      "schema_missing",
    );
  }
  if (code === "42501") {
    return new ServiceError("You do not have permission to do that.", 403, "forbidden");
  }
  if (code === "23505") {
    return new ServiceError("That record already exists.", 409, "conflict");
  }
  return new ServiceError("Could not reach the database. Please try again.", 503, "db_unavailable");
}

export async function requireUser() {
  const supabase = await createClient();
  const { user } = await getAuthUser();
  if (!user) throw new ServiceError("Your session has expired. Please sign in again.", 401, "unauthorised");
  return { supabase, user };
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getBusinessSettings(userId: string): Promise<BusinessSettingsRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw dbError("getBusinessSettings", error);
  return data as BusinessSettingsRow | null;
}

export async function getInvoice(id: string): Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] } | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw dbError("getInvoice", error);
  if (!data) return null;
  const { invoice_items: items, ...invoice } = data as unknown as InvoiceRow & {
    invoice_items: InvoiceItemRow[];
  };
  return { invoice: invoice as InvoiceRow, items: (items ?? []) as InvoiceItemRow[] };
}

export async function getInvoiceByToken(token: string): Promise<InvoiceRow | null> {
  if (!token || token.length < 16) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw dbError("getInvoice", error);
  return data as InvoiceRow | null;
}

/** Mint a short-lived signed URL for the private logo bucket. */
export async function signedLogoUrl(path: string | null | undefined, expires = 60 * 60 * 6): Promise<string | null> {
  if (!path) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("logos").createSignedUrl(path, expires);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Public-safe logo URL: works for anonymous visitors of a shared invoice. */
export async function publicLogoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from("logos").createSignedUrl(path, 60 * 60 * 24);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Upserts an invoice and syncs its line items.
 *
 * IMPORTANT: totals from the payload are never trusted — they are recomputed by
 * the `recalculate_invoice_totals` trigger inside Postgres, then read back.
 */
export async function saveInvoice(userId: string, payload: InvoicePayload) {
  const supabase = await createClient();

  let invoiceId: string | null = isUuid(payload.id) ? payload.id : null;

  const currency = getCurrency(payload.currency, payload.currencySymbol ?? null);
  const design = normaliseDesign({ ...payload.design, template: payload.template });

  const core = {
    invoice_number: payload.invoiceNumber,
    invoice_type: payload.invoiceType,
    customer_name: payload.customer.name || "—",
    customer_company: payload.customer.company || null,
    customer_email: payload.customer.email || null,
    customer_phone: payload.customer.phone || null,
    customer_address: payload.customer.address || null,
    customer_shipping: payload.customer.shippingAddress || null,
    customer_tax_id: payload.customer.taxId || null,
    invoice_date: payload.invoiceDate,
    due_date: payload.dueDate || null,
    po_number: payload.poNumber || null,
    reference: payload.reference || null,
    currency: currency.code,
    currency_symbol: currency.symbol,
    payment_terms: payload.paymentTerms || null,
    status: payload.status,
    discount_type: payload.discountType,
    discount_value: dec(payload.discountValue || "0").toDecimalPlaces(4).toNumber(),
    shipping: dec(payload.shipping).toDecimalPlaces(2).toNumber(),
    fees: dec(payload.fees).toDecimalPlaces(2).toNumber(),
    adjustment: dec(payload.adjustment).toDecimalPlaces(2).toNumber(),
    amount_paid: dec(payload.amountPaid).toDecimalPlaces(2).toNumber(),
    template: payload.template,
    design_settings: design as unknown as Json,
    notes: payload.notes || null,
    terms: payload.terms || null,
    footer_text: payload.footerText || null,
    payment_instructions: payload.paymentInstructions || null,
    payment_enabled: payload.paymentEnabled,
    payment_provider: payload.paymentProvider,
    customer_id: isUuid(payload.customer.id) ? payload.customer.id : null,
  };

  const isUpdate = Boolean(invoiceId);
  let publicToken: string | null = null;

  if (invoiceId) {
    // ownership check is enforced again by RLS on the UPDATE.
    // Ask for the token back in the same round trip — it is needed to
    // revalidate the public page and would otherwise cost another query.
    const { data, error } = await supabase
      .from("invoices")
      .update(core)
      .eq("id", invoiceId)
      .select("public_token")
      .maybeSingle();
    if (error) throw dbError("saveInvoice:update", error);
    publicToken = (data?.public_token as string | undefined) ?? null;
  } else {
    const { data: reserved, error: numberError } = await supabase.rpc("reserve_invoice_number", {
      p_user_id: userId,
    });
    if (numberError) throw dbError("reserve_invoice_number", numberError);

    const { data, error } = await supabase
      .from("invoices")
      .insert({ ...core, user_id: userId, invoice_number: payload.invoiceNumber || (reserved as string) })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new ServiceError(
          `Invoice number "${payload.invoiceNumber}" is already used. Pick a different one.`,
          409,
          "duplicate_number",
        );
      }
      throw dbError("saveInvoice:insert", error);
    }
    invoiceId = data.id as string;
  }

  const reassigned = await syncItems(userId, invoiceId, payload.items);

  await supabase.rpc("sync_payment_status", { p_invoice_id: invoiceId });

  // On an autosave of an invoice that already exists, the browser already holds
  // the id, the public token and the totals — it computes them locally with the
  // same algorithm the database uses, and the preview updates instantly either
  // way. So skip the read-back: it is a whole round trip for data nobody is
  // waiting on. The only thing that can still need telling back is an id the
  // server had to mint.
  if (isUpdate) {
    revalidatePublicInvoice(publicToken);
    return { invoice: null, items: null, reassigned };
  }

  const saved = await getInvoice(invoiceId);
  if (!saved) throw new ServiceError("The invoice could not be read back after saving.", 500, "db_error");

  revalidatePublicInvoice(saved.invoice.public_token);

  return { invoice: saved.invoice, items: saved.items, reassigned };
}

/** Invalidates the cached public view for one token. */
function revalidatePublicInvoice(token: string | null | undefined) {
  if (!token) return;
  try {
    revalidateTag(invoiceTag(token));
  } catch (error) {
    console.error("[cache] could not revalidate the public invoice", error);
  }
}

async function syncItems(userId: string, invoiceId: string, items: InvoicePayload["items"]) {
  const supabase = await createClient();
  type ItemInsert = Database["public"]["Tables"]["invoice_items"]["Insert"];

  const rows: ItemInsert[] = [];
  /** For any item whose incoming id was not a UUID, which id it was given. */
  const reassigned: { localId: string; serverId: string }[] = [];

  items.forEach((item, index) => {
    // `id` is a uuid primary key. The editor mints real UUIDs, but never trust
    // the wire: a non-UUID id would be sent as null and violate the constraint.
    const id = isUuid(item.id) ? item.id : uuid();
    if (id !== item.id) reassigned.push({ localId: item.id, serverId: id });

    rows.push({
      id,
      invoice_id: invoiceId,
      user_id: userId,
      name: item.name,
      description: item.description || null,
      quantity: dec(item.quantity || "1").toNumber(),
      unit_price: dec(item.unitPrice).toNumber(),
      discount: dec(item.discount).toNumber(),
      tax: dec(item.tax).toNumber(),
      sort_order: index,
    });
  });

  const keepIds = rows.map((r) => r.id as string);

  // Autosave runs on every pause in typing, so this is the hottest path in the
  // app. An upsert of the incoming rows and a delete of everything else touch
  // completely disjoint id sets, so they are safe to run together — one round
  // trip instead of load + upsert + delete.
  const writes = [] as ReturnType<typeof runWrite>[];

  if (rows.length) {
    writes.push(
      runWrite(supabase.from("invoice_items").upsert(rows, { onConflict: "id" })),
    );
  }

  writes.push(
    runWrite(
      keepIds.length
        ? supabase
            .from("invoice_items")
            .delete()
            .eq("invoice_id", invoiceId)
            .not("id", "in", `(${keepIds.join(",")})`)
        : // every item was removed — clear the rest of the invoice
          supabase.from("invoice_items").delete().eq("invoice_id", invoiceId),
    ),
  );

  const results = await Promise.all(writes);
  const failed = results.find((r) => r.error)?.error;
  if (failed) throw dbError("syncItems", failed);

  return reassigned;
}

/** Normalises a PostgREST builder to a plain `{ error }` promise. */
async function runWrite(
  builder: {
    then: (onOk: (value: { error: { message: string; code?: string } | null }) => unknown) => unknown;
  },
): Promise<{ error: { message: string; code?: string } | null }> {
  const { error } = await builder;
  return { error: error ?? null };
}

export async function saveCustomer(userId: string, payload: InvoicePayload["customer"]): Promise<string | null> {
  if (!payload.name.trim()) return null;
  const supabase = await createClient();
  const row = {
    user_id: userId,
    name: payload.name.trim(),
    company: payload.company || null,
    email: payload.email || null,
    phone: payload.phone || null,
    billing_address: payload.address || null,
    shipping_address: payload.shippingAddress || null,
    tax_id: payload.taxId || null,
    notes: payload.notes || null,
  };
  if (isUuid(payload.id)) {
    const { data } = await supabase
      .from("customers")
      .update(row)
      .eq("id", payload.id)
      .select("id")
      .maybeSingle();
    return (data?.id as string) ?? null;
  }
  const { data, error } = await supabase.from("customers").insert(row).select("id").single();
  if (error) throw dbError("saveCustomer", error);
  return data.id as string;
}

export async function listCustomers(userId: string, search = ""): Promise<CustomerRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true })
    .limit(200);
  if (search) {
    const term = `%${search.replace(/[%,()]/g, "")}%`;
    query = query.or(`name.ilike.${term},company.ilike.${term},email.ilike.${term}`);
  }
  const { data, error } = await query;
  if (error) throw dbError("listCustomers", error);
  return (data ?? []) as CustomerRow[];
}

export async function deleteCustomer(userId: string, id: string) {
  if (!isUuid(id)) throw new ServiceError("Invalid customer.", 400);
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id).eq("user_id", userId);
  if (error) throw dbError("deleteCustomer", error);
}

export async function softDeleteInvoice(userId: string, id: string) {
  if (!isUuid(id)) throw new ServiceError("Invalid invoice.", 400);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("public_token")
    .maybeSingle();
  if (error) throw dbError("softDeleteInvoice", error);
  revalidatePublicInvoice(data?.public_token);
}

export async function updateBusinessSettings(
  userId: string,
  values: Record<string, unknown>,
): Promise<BusinessSettingsRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_settings")
    .upsert({ ...values, user_id: userId })
    .select("*")
    .single();
  if (error) throw dbError("updateBusinessSettings", error);
  return data as BusinessSettingsRow;
}

export async function updateProfile(userId: string, fullName: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
  if (error) throw dbError("updateProfile", error);
}

/** Dashboard query — server-side filtering, sorting and pagination. */
export async function listInvoices(userId: string, params: {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  paymentStatus: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select(
      "id,invoice_number,invoice_type,customer_name,customer_company,status,payment_status,currency,currency_symbol,invoice_date,due_date,total,amount_due,amount_paid,template,public_token,payment_enabled,created_at,updated_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (params.search) {
    const term = `%${params.search.replace(/[%,()]/g, "")}%`;
    query = query.or(
      `invoice_number.ilike.${term},customer_name.ilike.${term},customer_company.ilike.${term},customer_email.ilike.${term}`,
    );
  }
  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.paymentStatus && params.paymentStatus !== "all")
    query = query.eq("payment_status", params.paymentStatus);
  if (params.currency && params.currency !== "all") query = query.eq("currency", params.currency);
  if (params.dateFrom) query = query.gte("invoice_date", params.dateFrom);
  if (params.dateTo) query = query.lte("invoice_date", params.dateTo);

  switch (params.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("total", { ascending: false }).order("created_at", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("total", { ascending: true }).order("created_at", { ascending: false });
      break;
    case "number_asc":
      query = query.order("invoice_number", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const from = (params.page - 1) * params.pageSize;
  const { data, error, count } = await query.range(from, from + params.pageSize - 1);
  if (error) throw dbError("listInvoices", error);

  const rows = (data ?? []) as unknown as InvoiceRow[];

  return {
    invoices: rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      invoiceNumber: row.invoice_number,
      invoice_type: row.invoice_type,
      publicToken: row.public_token,
      paymentEnabled: Boolean(row.payment_enabled),
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      customer_company: row.customer_company,
      customer_email: row.customer_email,
      status: row.status,
      payment_status: row.payment_status,
      currency: row.currency,
      currency_symbol: row.currency_symbol,
      invoice_date: row.invoice_date,
      due_date: row.due_date,
      total: Number(row.total ?? 0),
      amount_due: Number(row.amount_due ?? 0),
      amount_paid: Number(row.amount_paid ?? 0),
      template: row.template,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / params.pageSize)),
  };
}

export async function dashboardSummary(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("total,currency,currency_symbol,amount_due,payment_status,status,created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw dbError("dashboardSummary", error);

  const rows = (data ?? []) as unknown as InvoiceRow[];
  const now = Date.now();
  const totalsByCurrency = new Map<string, { billed: number; outstanding: number; overdue: number; count: number }>();

  for (const row of rows) {
    const key = row.currency || "USD";
    const entry = totalsByCurrency.get(key) ?? { billed: 0, outstanding: 0, overdue: 0, count: 0 };
    entry.billed += Number(row.total ?? 0);
    entry.count += 1;
    if (row.payment_status === "paid") continue;
    entry.outstanding += Number(row.amount_due ?? 0);
    if (row.due_date && new Date(row.due_date).getTime() < now && Number(row.amount_due) > 0) {
      entry.overdue += Number(row.amount_due ?? 0);
    }
    totalsByCurrency.set(key, entry);
  }

  return { totalsByCurrency: Object.fromEntries(totalsByCurrency), invoiceCount: rows.length };
}
