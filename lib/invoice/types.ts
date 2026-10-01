import type { DesignSettings } from "./design";

export const INVOICE_TYPES = ["standard", "tax", "proforma", "commercial", "custom"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "paid",
  "partial",
  "overdue",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["stripe", "paypal", "manual"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export type DiscountType = "percent" | "fixed";

/** A line item as it exists in the editor (client-side, pre-persistence). */
export type InvoiceItemDraft = {
  /** Stable local id — never sent to the database. */
  id: string;
  name: string;
  description: string;
  /** strings while typing so "1." or "" stay valid input */
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
};

export type CustomerDraft = {
  id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  shippingAddress: string;
  taxId: string;
  notes: string;
};

/** The single source of truth for the invoice editor. */
export type InvoiceDraft = {
  id: string | null;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;

  customer: CustomerDraft;

  invoiceDate: string;
  dueDate: string;
  poNumber: string;
  reference: string;
  currency: string;
  paymentTerms: string;

  items: InvoiceItemDraft[];

  discountType: DiscountType;
  discountValue: string;
  shipping: string;
  fees: string;
  adjustment: string;
  amountPaid: string;

  template: string;
  design: DesignSettings;

  notes: string;
  terms: string;
  footerText: string;
  paymentInstructions: string;

  paymentEnabled: boolean;
  paymentProvider: PaymentProviderName;
  publicToken: string;
};

export type BusinessInfo = {
  businessName: string;
  logoUrl: string | null;
  logoPath: string | null;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId: string;
  registrationNumber: string;
  additionalInfo: string;
};

/** Everything the renderer needs — invoice + business + computed totals. */
export type RenderModel = {
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  invoiceDate: string;
  dueDate: string;
  poNumber: string;
  reference: string;
  currency: string;
  currencySymbol: string;
  paymentTerms: string;
  customer: CustomerDraft;
  items: InvoiceItemDraft[];
  discountType: DiscountType;
  discountValue: string;
  shipping: string;
  fees: string;
  adjustment: string;
  amountPaid: string;
  notes: string;
  terms: string;
  footerText: string;
  paymentInstructions: string;
  paymentEnabled: boolean;
  publicToken: string;
  /** Absolute payment URL printed on the document (server-side only). */
  payUrl: string;
  design: DesignSettings;
  business: BusinessInfo;
};

export const INVOICE_TYPE_META: Record<
  InvoiceType,
  { label: string; blurb: string; defaults: Partial<InvoiceDraft> }
> = {
  standard: {
    label: "Standard Invoice",
    blurb: "For normal products and services.",
    defaults: { status: "draft" },
  },
  tax: {
    label: "Tax Invoice",
    blurb: "Includes tax registration details on every invoice.",
    defaults: { status: "draft", terms: "Tax invoice. Prices include applicable taxes." },
  },
  proforma: {
    label: "Proforma Invoice",
    blurb: "Quotation or preliminary billing — not yet a demand for payment.",
    defaults: { status: "draft", paymentEnabled: false, terms: "This proforma invoice is valid for 15 days." },
  },
  commercial: {
    label: "Commercial Invoice",
    blurb: "For business and international transactions.",
    defaults: { status: "draft", notes: "All values are stated in the invoice currency." },
  },
  custom: {
    label: "Custom Invoice",
    blurb: "Fully customisable structure — every field is yours to change.",
    defaults: { status: "draft" },
  },
};

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  paid: "Paid",
  partial: "Partially paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Pending",
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
