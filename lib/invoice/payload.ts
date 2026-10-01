import type { InvoiceDraft } from "./types";
import type { DesignSettings } from "./design";

/** Shape accepted by POST /api/invoices (see `invoicePayloadSchema`). */
export type InvoiceSavePayload = {
  id: string | null;
  invoiceNumber: string;
  invoiceType: InvoiceDraft["invoiceType"];
  status: InvoiceDraft["status"];
  customer: InvoiceDraft["customer"];
  invoiceDate: string;
  dueDate: string;
  poNumber: string;
  reference: string;
  currency: string;
  paymentTerms: string;
  items: { id: string; name: string; description: string; quantity: string; unitPrice: string; discount: string; tax: string }[];
  discountType: InvoiceDraft["discountType"];
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
  paymentProvider: InvoiceDraft["paymentProvider"];
  saveCustomer?: boolean;
};

export function toSavePayload(
  draft: InvoiceDraft,
  options: { saveCustomer?: boolean } = {},
): InvoiceSavePayload {
  return {
    id: draft.id,
    invoiceNumber: draft.invoiceNumber.trim(),
    invoiceType: draft.invoiceType,
    status: draft.status,
    customer: {
      id: draft.customer.id,
      name: draft.customer.name,
      company: draft.customer.company,
      email: draft.customer.email,
      phone: draft.customer.phone,
      address: draft.customer.address,
      shippingAddress: draft.customer.shippingAddress,
      taxId: draft.customer.taxId,
      notes: draft.customer.notes,
    },
    invoiceDate: draft.invoiceDate,
    dueDate: draft.dueDate,
    poNumber: draft.poNumber,
    reference: draft.reference,
    currency: draft.currency,
    paymentTerms: draft.paymentTerms,
    items: draft.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
    })),
    discountType: draft.discountType,
    discountValue: draft.discountValue,
    shipping: draft.shipping,
    fees: draft.fees,
    adjustment: draft.adjustment,
    amountPaid: draft.amountPaid,
    template: draft.template,
    design: draft.design,
    notes: draft.notes,
    terms: draft.terms,
    footerText: draft.footerText,
    paymentInstructions: draft.paymentInstructions,
    paymentEnabled: draft.paymentEnabled,
    paymentProvider: draft.paymentProvider,
    saveCustomer: options.saveCustomer ?? false,
  };
}
