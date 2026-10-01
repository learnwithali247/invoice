import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

export const moneyString = z
  .string()
  .trim()
  .max(24)
  .refine((v) => v === "" || /^-?\d*\.?\d*$/.test(v.replace(/,/g, "")), "Not a valid amount");

export const percentString = z
  .string()
  .trim()
  .max(8)
  .refine((v) => v === "" || /^\d*\.?\d*$/.test(v), "Not a valid percentage")
  .refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 100), "Must be between 0 and 100");

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

const optionalDate = z.union([isoDate, z.literal("")]).optional();

export const customerSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: trimmed(160).default(""),
  company: trimmed(160).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(254)]).default(""),
  phone: trimmed(60).default(""),
  address: trimmed(600).default(""),
  shippingAddress: trimmed(600).default(""),
  taxId: trimmed(80).default(""),
  notes: trimmed(1000).default(""),
});

export const itemSchema = z.object({
  id: z.string().max(64).default(""),
  name: trimmed(200).default(""),
  description: trimmed(1000).default(""),
  quantity: moneyString.default("1"),
  unitPrice: moneyString.default("0"),
  discount: percentString.default("0"),
  tax: percentString.default("0"),
});

export const designSchema = z
  .object({
    template: z.string().max(40),
    primaryColor: z.string().max(20),
    secondaryColor: z.string().max(20),
    textColor: z.string().max(20),
    mutedColor: z.string().max(20),
    borderColor: z.string().max(20),
    backgroundColor: z.string().max(20),
    tableHeaderBackground: z.string().max(20),
    tableHeaderTextColor: z.string().max(20),
    fontFamily: z.string().max(40),
    baseFontSize: z.number().min(6).max(16),
    headingScale: z.number().min(1).max(3),
    tableFontSize: z.number().min(6).max(16),
    headerAlignment: z.enum(["left", "center", "right"]),
    logoPosition: z.enum(["left", "right", "hidden"]),
    businessPosition: z.enum(["left", "right"]),
    titlePosition: z.enum(["left", "right"]),
    accentStyle: z.enum(["none", "bar", "block", "hairline"]),
    tableStyle: z.enum(["lined", "striped", "borderless"]),
    density: z.enum(["compact", "regular", "airy"]),
    divider: z.enum(["none", "hairline", "thin", "soft", "solid"]),
    borderRadius: z.number().min(0).max(24),
    rowSpacing: z.number().min(0).max(24),
    showTableBorders: z.boolean(),
    logoWidth: z.number().min(24).max(240),
    showTaxId: z.boolean(),
    showCustomerPhone: z.boolean(),
    showCustomerEmail: z.boolean(),
    showShippingAddress: z.boolean(),
    showPaymentTerms: z.boolean(),
    showDueDate: z.boolean(),
    showNotes: z.boolean(),
    showDiscount: z.boolean(),
    showTax: z.boolean(),
    showFees: z.boolean(),
    showAdjustment: z.boolean(),
    showShipping: z.boolean(),
    showFooter: z.boolean(),
    showPaymentButton: z.boolean(),
    showAmountPaid: z.boolean(),
    showBankDetails: z.boolean(),
    showItemDescriptions: z.boolean(),
    showZeroValueColumns: z.boolean(),
    pageSize: z.enum(["A4", "Letter"]),
    footerNote: z.string().max(400),
    showPageNumbers: z.boolean(),
  })
  .partial();

export const invoicePayloadSchema = z.object({
  id: z.string().uuid().nullish(),
  invoiceNumber: trimmed(60).default(""),
  invoiceType: z.enum(["standard", "tax", "proforma", "commercial", "custom"]).default("standard"),
  status: z.enum(["draft", "sent", "viewed", "paid", "partial", "overdue", "cancelled"]).default("draft"),
  customer: customerSchema,
  invoiceDate: isoDate,
  dueDate: optionalDate,
  poNumber: trimmed(80).default(""),
  reference: trimmed(80).default(""),
  currency: z.string().trim().max(8).default("USD"),
  currencySymbol: trimmed(8).nullish(),
  paymentTerms: trimmed(400).default(""),
  items: z.array(itemSchema).max(500, "An invoice can hold up to 500 items"),
  discountType: z.enum(["percent", "fixed"]).default("percent"),
  discountValue: z.string().trim().max(24).default("0"),
  shipping: moneyString.default("0"),
  fees: moneyString.default("0"),
  adjustment: moneyString.default("0"),
  amountPaid: moneyString.default("0"),
  template: z.string().max(40).default("modern"),
  design: designSchema.default({}),
  notes: trimmed(4000).default(""),
  terms: trimmed(4000).default(""),
  footerText: trimmed(1000).default(""),
  paymentInstructions: trimmed(2000).default(""),
  paymentEnabled: z.boolean().default(false),
  paymentProvider: z.enum(["stripe", "paypal", "manual"]).default("manual"),
  /** persist a saved customer row alongside the invoice */
  saveCustomer: z.boolean().optional(),
});

export const businessSettingsSchema = z.object({
  businessName: trimmed(160).default(""),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).default(""),
  phone: trimmed(60).default(""),
  website: z.union([z.literal(""), z.string().trim().url().max(300)]).default(""),
  addressLine1: trimmed(200).default(""),
  addressLine2: trimmed(200).default(""),
  city: trimmed(100).default(""),
  state: trimmed(100).default(""),
  postalCode: trimmed(40).default(""),
  country: trimmed(100).default(""),
  taxId: trimmed(80).default(""),
  registrationNumber: trimmed(80).default(""),
  additionalInfo: trimmed(600).default(""),
  defaultCurrency: z.string().trim().max(8).default("USD"),
  defaultTemplate: z.string().max(40).default("modern"),
  invoicePrefix: z.string().max(20).default("INV-"),
  nextInvoiceNumber: z.coerce.number().int().min(0).max(9_999_999).default(1),
  numberPadding: z.coerce.number().int().min(0).max(12).default(6),
  defaultPaymentTerms: trimmed(400).default(""),
  defaultNotes: trimmed(4000).default(""),
  defaultTerms: trimmed(4000).default(""),
  defaultDesign: designSchema.default({}),
  defaultPaymentEnabled: z.boolean().default(false),
  defaultPaymentProvider: z.enum(["stripe", "paypal", "manual"]).default("manual"),
});

export const customerSchemaInput = customerSchema.extend({
  saveToLibrary: z.boolean().optional(),
});

export const sendInvoiceSchema = z.object({
  to: z.string().trim().email("Enter a valid email").max(254),
  subject: trimmed(200).optional(),
  message: trimmed(4000).optional(),
  includePdf: z.boolean().default(true),
  includeLink: z.boolean().default(true),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.string().trim().max(20).default("all"),
  paymentStatus: z.string().trim().max(20).default("all"),
  currency: z.string().trim().max(8).default("all"),
  dateFrom: z.string().trim().max(10).default(""),
  dateTo: z.string().trim().max(10).default(""),
  sort: z
    .enum(["newest", "oldest", "amount_desc", "amount_asc", "number_asc"])
    .default("newest"),
});

export const paymentCheckoutSchema = z.object({
  token: z.string().trim().min(20).max(120),
  provider: z.enum(["stripe", "paypal"]),
});

export type InvoicePayload = z.infer<typeof invoicePayloadSchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
