import { requireUser, updateBusinessSettings } from "@/lib/invoice/service";
import { handleApiError, jsonOk, readJson } from "@/lib/api";
import { businessSettingsSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const { user } = await requireUser();
    const payload = businessSettingsSchema.parse(await readJson(request));

    const row = await updateBusinessSettings(user.id, {
      business_name: payload.businessName,
      email: payload.email || null,
      phone: payload.phone || null,
      website: payload.website || null,
      address_line1: payload.addressLine1 || null,
      address_line2: payload.addressLine2 || null,
      city: payload.city || null,
      state: payload.state || null,
      postal_code: payload.postalCode || null,
      country: payload.country || null,
      tax_id: payload.taxId || null,
      registration_number: payload.registrationNumber || null,
      additional_info: payload.additionalInfo || null,
      default_currency: payload.defaultCurrency,
      default_template: payload.defaultTemplate,
      invoice_prefix: payload.invoicePrefix,
      next_invoice_number: payload.nextInvoiceNumber,
      number_padding: payload.numberPadding,
      default_payment_terms: payload.defaultPaymentTerms,
      default_notes: payload.defaultNotes,
      default_terms: payload.defaultTerms,
      default_design: payload.defaultDesign as Record<string, unknown>,
      default_payment_enabled: payload.defaultPaymentEnabled,
      default_payment_provider: payload.defaultPaymentProvider,
    });

    return jsonOk(row);
  } catch (error) {
    return handleApiError(error, "PUT /api/settings/business");
  }
}
