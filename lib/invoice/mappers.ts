import type {
  BusinessInfo,
  CustomerDraft,
  InvoiceDraft,
  InvoiceItemDraft,
  RenderModel,
} from "./types";
import { DEFAULT_DESIGN, normaliseDesign } from "./design";
import { getCurrency } from "./currencies";
import { addDays, todayISO } from "./date";
import { uuid } from "@/lib/utils";

import type {
  BusinessSettingsRow,
  CustomerRow,
  InvoiceItemRow,
  InvoiceRow,
} from "@/types/database";

/**
 * Local id for a brand-new row.
 *
 * These are real v4 UUIDs on purpose: the invoice id column is a uuid primary
 * key with a database default, and a single upsert needs every row to carry an
 * id. Minting them here means the browser's id and the row's id are the same
 * value, so autosave never has to map ids back.
 */
export const localId = (): string => uuid();

export function emptyItem(): InvoiceItemDraft {
  return {
    id: localId(),
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    discount: "0",
    tax: "0",
  };
}


export function emptyCustomer(): CustomerDraft {
  return {
    id: null,
    name: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    shippingAddress: "",
    taxId: "",
    notes: "",
  };
}

type BusinessDefaults = Pick<
  BusinessSettingsRow,
  | "default_currency"
  | "default_template"
  | "default_payment_terms"
  | "default_notes"
  | "default_terms"
  | "default_design"
  | "default_payment_enabled"
  | "default_payment_provider"
>;

/** A brand new invoice. Business settings are optional — everything has a fallback. */
export function buildNewInvoice(options: {
  business?: BusinessDefaults | null;
  invoiceNumber: string;
  invoiceType?: InvoiceDraft["invoiceType"];
  today?: string;
}): InvoiceDraft {
  const b = options.business ?? null;
  const today = options.today ?? todayISO();
  const design = normaliseDesign({
    ...DEFAULT_DESIGN,
    ...(b?.default_design && typeof b.default_design === "object" ? b.default_design : {}),
    template: b?.default_template || DEFAULT_DESIGN.template,
  });

  return {
    id: null,
    invoiceNumber: options.invoiceNumber,
    invoiceType: options.invoiceType ?? "standard",
    status: "draft",
    paymentStatus: "unpaid",

    customer: emptyCustomer(),

    invoiceDate: today,
    dueDate: addDays(today, 14),
    poNumber: "",
    reference: "",
    currency: b?.default_currency || "USD",
    paymentTerms: b?.default_payment_terms || "Payment due within 14 days.",

    items: [emptyItem()],

    discountType: "percent",
    discountValue: "0",
    shipping: "0",
    fees: "0",
    adjustment: "0",
    amountPaid: "0",

    template: design.template,
    design,

    notes: b?.default_notes ?? "Thank you for your business.",
    terms: b?.default_terms ?? "",
    footerText: "",
    paymentInstructions: "",

    paymentEnabled: b?.default_payment_enabled ?? false,
    paymentProvider: (b?.default_payment_provider as InvoiceDraft["paymentProvider"]) ?? "manual",
    publicToken: "",
  };
}


export function invoiceToDraft(invoice: InvoiceRow, items: InvoiceItemRow[]): InvoiceDraft {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    invoiceType: invoice.invoice_type as InvoiceDraft["invoiceType"],
    status: invoice.status as InvoiceDraft["status"],
    paymentStatus: invoice.payment_status as InvoiceDraft["paymentStatus"],

    customer: {
      id: invoice.customer_id,
      name: invoice.customer_name ?? "",
      company: invoice.customer_company ?? "",
      email: invoice.customer_email ?? "",
      phone: invoice.customer_phone ?? "",
      address: invoice.customer_address ?? "",
      shippingAddress: invoice.customer_shipping ?? "",
      taxId: invoice.customer_tax_id ?? "",
      notes: "",
    },

    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date ?? "",
    poNumber: invoice.po_number ?? "",
    reference: invoice.reference ?? "",
    currency: invoice.currency,
    paymentTerms: invoice.payment_terms ?? "",

    items: items.map((it) => ({
      id: it.id,
      name: it.name ?? "",
      description: it.description ?? "",
      quantity: String(it.quantity ?? 1),
      unitPrice: String(it.unit_price ?? 0),
      discount: String(it.discount ?? 0),
      tax: String(it.tax ?? 0),
    })),

    discountType: (invoice.discount_type as "percent" | "fixed") ?? "percent",
    discountValue: String(invoice.discount_value ?? 0),
    shipping: String(invoice.shipping ?? 0),
    fees: String(invoice.fees ?? 0),
    adjustment: String(invoice.adjustment ?? 0),
    amountPaid: String(invoice.amount_paid ?? 0),

    template: invoice.template,
    design: normaliseDesign({
      ...(invoice.design_settings as Record<string, unknown>),
      template: invoice.template,
    }),

    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    footerText: invoice.footer_text ?? "",
    paymentInstructions: invoice.payment_instructions ?? "",

    paymentEnabled: invoice.payment_enabled,
    paymentProvider: (invoice.payment_provider as InvoiceDraft["paymentProvider"]) ?? "manual",
    publicToken: invoice.public_token,
  };
}

export function customerToDraft(customer: CustomerRow): CustomerDraft {
  return {
    id: customer.id,
    name: customer.name ?? "",
    company: customer.company ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: customer.billing_address ?? "",
    shippingAddress: customer.shipping_address ?? "",
    taxId: customer.tax_id ?? "",
    notes: customer.notes ?? "",
  };
}

export function businessRowToInfo(row: BusinessSettingsRow | null | undefined): BusinessInfo {
  return {
    businessName: row?.business_name ?? "",
    logoUrl: row?.logo_url ?? null,
    logoPath: row?.logo_path ?? null,
    email: row?.email ?? "",
    phone: row?.phone ?? "",
    website: row?.website ?? "",
    addressLine1: row?.address_line1 ?? "",
    addressLine2: row?.address_line2 ?? "",
    city: row?.city ?? "",
    state: row?.state ?? "",
    postalCode: row?.postal_code ?? "",
    country: row?.country ?? "",
    taxId: row?.tax_id ?? "",
    registrationNumber: row?.registration_number ?? "",
    additionalInfo: row?.additional_info ?? "",
  };
}

export function toRenderModel(
  draft: InvoiceDraft,
  business: BusinessInfo,
  currencySymbolOverride?: string | null,
): RenderModel {
  const currency = getCurrency(draft.currency, currencySymbolOverride);
  return {
    invoiceNumber: draft.invoiceNumber,
    invoiceType: draft.invoiceType,
    status: draft.status,
    paymentStatus: draft.paymentStatus,
    invoiceDate: draft.invoiceDate,
    dueDate: draft.dueDate,
    poNumber: draft.poNumber,
    reference: draft.reference,
    currency: currency.code,
    currencySymbol: currency.symbol,
    paymentTerms: draft.paymentTerms,
    customer: draft.customer,
    items: draft.items,
    discountType: draft.discountType,
    discountValue: draft.discountValue,
    shipping: draft.shipping,
    fees: draft.fees,
    adjustment: draft.adjustment,
    amountPaid: draft.amountPaid,
    notes: draft.notes,
    terms: draft.terms,
    footerText: draft.footerText,
    paymentInstructions: draft.paymentInstructions,
    paymentEnabled: draft.paymentEnabled,
    publicToken: draft.publicToken,
    payUrl: "",

    design: draft.design,
    business,
  };
}


/** Map the public RPC payload (camelCase JSON) onto a RenderModel. */
export function publicPayloadToRenderModel(payload: Record<string, unknown>): RenderModel | null {
  if (!payload || typeof payload !== "object") return null;
  const totals = (payload.totals ?? {}) as Record<string, unknown>;
  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  const business = (payload.business ?? {}) as Record<string, unknown>;
  const currencyCode = String(payload.currency ?? "USD");
  const currency = getCurrency(
    currencyCode,
    typeof payload.currencySymbol === "string" && payload.currencySymbol ? payload.currencySymbol : null,
  );

  const items: InvoiceItemDraft[] = ((payload.items ?? []) as Record<string, unknown>[]).map((it, index) => ({
    id: `pub_${index}`,
    name: String(it.name ?? ""),
    description: String(it.description ?? ""),
    quantity: String(it.quantity ?? 1),
    unitPrice: String(it.unitPrice ?? 0),
    discount: String(it.discount ?? 0),
    tax: String(it.tax ?? 0),
  }));

  return {
    invoiceNumber: String(payload.invoiceNumber ?? ""),
    invoiceType: (payload.type as InvoiceDraft["invoiceType"]) ?? "standard",
    status: (payload.status as InvoiceDraft["status"]) ?? "draft",
    paymentStatus: (payload.paymentStatus as InvoiceDraft["paymentStatus"]) ?? "unpaid",
    invoiceDate: String(payload.invoiceDate ?? ""),
    dueDate: String(payload.dueDate ?? ""),
    poNumber: String(payload.poNumber ?? ""),
    reference: String(payload.reference ?? ""),
    currency: currency.code,
    currencySymbol: currency.symbol,
    paymentTerms: String(payload.paymentTerms ?? ""),
    customer: {
      id: null,
      name: String(customer.name ?? ""),
      company: String(customer.company ?? ""),
      email: String(customer.email ?? ""),
      phone: String(customer.phone ?? ""),
      address: String(customer.address ?? ""),
      shippingAddress: String(customer.shipping ?? ""),
      taxId: String(customer.taxId ?? ""),
      notes: "",
    },
    items,
    discountType: (payload.discountType as "percent" | "fixed") ?? "percent",
    discountValue: String(payload.discountValue ?? 0),
    shipping: String(totals.shipping ?? 0),
    fees: String(totals.fees ?? 0),
    adjustment: String(totals.adjustment ?? 0),
    amountPaid: String(totals.amountPaid ?? 0),
    notes: String(payload.notes ?? ""),
    terms: String(payload.terms ?? ""),
    footerText: String(payload.footerText ?? ""),
    paymentInstructions: String(payload.paymentInstructions ?? ""),
    paymentEnabled: Boolean(payload.paymentEnabled),
    publicToken: "",
    payUrl: "",

    design: normaliseDesign({ ...(payload.design as object), template: payload.template }),
    business: {
      businessName: String(business.businessName ?? ""),
      logoUrl: (business.logoUrl as string | null) ?? null,
      logoPath: (business.logoPath as string | null) ?? null,
      email: String(business.email ?? ""),
      phone: String(business.phone ?? ""),
      website: String(business.website ?? ""),
      addressLine1: String(business.addressLine1 ?? ""),
      addressLine2: String(business.addressLine2 ?? ""),
      city: String(business.city ?? ""),
      state: String(business.state ?? ""),
      postalCode: String(business.postalCode ?? ""),
      country: String(business.country ?? ""),
      taxId: String(business.taxId ?? ""),
      registrationNumber: String(business.registrationNumber ?? ""),
      additionalInfo: String(business.additionalInfo ?? ""),
    },
  };
}
