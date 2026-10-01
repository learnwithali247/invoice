import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessRowToInfo, invoiceToDraft, toRenderModel } from "@/lib/invoice/mappers";
import { publicLogoUrl } from "./service";
import type { RenderModel } from "@/lib/invoice/types";
import type { InvoiceItemRow, InvoiceRow } from "@/types/database";

export type PublicInvoice = {
  model: RenderModel;
  amountDue: number;
  paymentEnabled: boolean;
  published: boolean;
  viewPath: string;
  payPath: string;
};

/** Cache tag for a single shared invoice — used to revalidate on write. */
export const invoiceTag = (token: string) => `public-invoice:${token}`;

async function load(token: string): Promise<PublicInvoice | null> {
  if (!token || token.length < 16) return null;
  const admin = createAdminClient();

  const { data: invoice, error } = await admin
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !invoice) return null;

  const row = invoice as InvoiceRow;

  // Items, business settings and the signed logo URL are independent of each
  // other, so run them together instead of one after another.
  const [itemsResult, settingsResult] = await Promise.all([
    admin
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", row.id)
      .order("sort_order", { ascending: true }),
    admin.from("business_settings").select("*").eq("user_id", row.user_id).maybeSingle(),
  ]);

  const settings = settingsResult.data;
  const business = businessRowToInfo(settings);
  business.logoUrl = await publicLogoUrl(settings?.logo_path ?? null);

  const draft = invoiceToDraft(row, (itemsResult.data ?? []) as InvoiceItemRow[]);
  const model = toRenderModel(draft, business, row.currency_symbol);
  model.payUrl = "";

  const amountDue = Number(row.amount_due ?? 0);

  return {
    model,
    amountDue,
    paymentEnabled: Boolean(row.payment_enabled) && amountDue > 0,
    published: Boolean(row.published_at),
    viewPath: `/i/${token}`,
    payPath: `/pay/invoice/${token}`,
  };
}

/**
 * Loads a shared invoice for an anonymous visitor.
 *
 * The server has full read access, so it selects exactly the customer-facing
 * fields and builds the same render model the owner sees. Nothing internal
 * (user id, storage paths, transaction history) is exposed to the caller.
 *
 * Cached for a minute and revalidated on every write, because a share link is
 * hit repeatedly (by the customer, by the owner previewing it) and each
 * Supabase round trip costs a few hundred milliseconds. The payment page passes
 * `fresh: true` so status polling is never served from cache.
 */
export async function loadPublicInvoice(
  token: string,
  options: { fresh?: boolean } = {},
): Promise<PublicInvoice | null> {
  if (options.fresh) return load(token);

  const cached = unstable_cache(() => load(token), ["public-invoice", token], {
    tags: [invoiceTag(token)],
    revalidate: 60,
  });

  try {
    return await cached();
  } catch (error) {
    // A cache write failure must never take the page down.
    console.error("[public-invoice] cache read failed, falling back to a live read", error);
    return load(token);
  }
}
