import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf } from "@/components/pdf/invoice-pdf";
import type { RenderModel } from "@/lib/invoice/types";

/**
 * Renders the invoice to a real, selectable-text PDF buffer.
 * Server-side only, so the PDF renderer never ships to the browser bundle.
 */
export async function renderInvoicePdf(
  model: RenderModel,
  logoDataUrl?: string | null,
): Promise<Buffer> {
  const element = <InvoicePdf model={model} logoDataUrl={logoDataUrl} />;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

export function pdfFileName(model: RenderModel): string {
  const number = (model.invoiceNumber || "invoice").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${number}-${new Date().toISOString().slice(0, 10)}.pdf`;
}
