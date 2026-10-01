import * as React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { RenderModel } from "@/lib/invoice/types";
import { INVOICE_TYPE_META, PAYMENT_STATUS_LABELS } from "@/lib/invoice/types";
import { buildRenderSpec, mmToPt } from "@/lib/invoice/render-spec";
import { calculateTotals, formatMoney, type Decimal } from "@/lib/invoice/calculate";
import { formatDate } from "@/lib/invoice/date";
import { initials } from "@/lib/utils";

const PAGE_PT = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
} as const;

/**
 * PDF renderer.
 *
 * It consumes the exact same `RenderModel` + `RenderSpec` as the on-screen
 * preview, so colours, fonts, visibility toggles, currency and totals always
 * match. Text stays selectable (real vector text — never a screenshot) and the
 * table header repeats on every page via react-pdf's `fixed` layout.
 */
export function InvoicePdf({
  model,
  logoDataUrl,
}: {
  model: RenderModel;
  /** Absolute or data URL for the logo; fetched at render time. */
  logoDataUrl?: string | null;
}): React.ReactElement<DocumentProps> {
  const spec = buildRenderSpec(model.design);
  const d = model.design;
  const totals = calculateTotals({
    items: model.items,
    discountType: model.discountType,
    discountValue: model.discountValue,
    shipping: model.shipping,
    fees: model.fees,
    adjustment: model.adjustment,
    amountPaid: model.amountPaid,
  });

  const decimals = model.currency === "JPY" || model.currency === "KRW" ? 0 : 2;
  const money = (value: Decimal) => formatMoney(value, model.currencySymbol, decimals);
  const pad = {
    top: mmToPt(spec.paddingMm.top),
    right: mmToPt(spec.paddingMm.right),
    bottom: mmToPt(spec.paddingMm.bottom),
    left: mmToPt(spec.paddingMm.left),
  };
  const size = PAGE_PT[spec.pageSize];

  const bordered = spec.borderWidth > 0;
  const cellBorder = bordered
    ? `0.4pt solid ${spec.borderColor}`
    : `0.4pt solid transparent`;
  const showTaxColumn = d.showTax && model.items.some((i) => Number(i.tax) > 0);
  const showDiscountColumn =
    d.showDiscount &&
    (model.items.some((i) => Number(i.discount) > 0) ||
      (model.discountValue !== "0" && model.discountValue !== ""));

  const rowGap = mmToPt(spec.cellPadY);
  const cellPad = mmToPt(spec.cellPadX);

  const styles = StyleSheet.create({
    page: {
      paddingTop: pad.top + (spec.accentStyle === "block" ? mmToPt(4) : spec.accentStyle === "none" ? 0 : mmToPt(1.6)),
      paddingRight: pad.right,
      paddingBottom: pad.bottom,
      paddingLeft: pad.left,
      fontFamily: spec.pdfFont,
      fontSize: spec.basePt,
      color: spec.colors.text,
      backgroundColor: spec.colors.background,
      lineHeight: 1.45,
    },
    accent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height:
        spec.accentStyle === "hairline" ? mmToPt(0.6) : spec.accentStyle === "block" ? mmToPt(4) : mmToPt(1.6),
      backgroundColor: spec.colors.accentFill === "transparent" ? spec.colors.primary : spec.colors.accentFill,
    },
    row: { flexDirection: "row", alignItems: "flex-start" },
    col: { flex: 1 },
    brandName: { fontFamily: spec.pdfBold, fontSize: spec.headingPt, color: spec.colors.text },
    muted: { fontSize: spec.mutedPt, color: spec.colors.muted },
    tiny: { fontSize: spec.tinyPt, color: spec.colors.muted },
    label: {
      fontSize: spec.labelPt,
      color: spec.colors.secondary,
      fontFamily: spec.pdfBold,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    tableHead: {
      flexDirection: "row",
      backgroundColor: spec.colors.tableHeaderBackground,
      borderRadius: spec.tableStyle === "striped" ? spec.radius : 0,
    },
    th: {
      fontFamily: spec.pdfBold,
      fontSize: spec.labelPt,
      color: spec.colors.tableHeaderText,
      paddingTop: rowGap * 0.85,
      paddingBottom: rowGap * 0.85,
      paddingLeft: cellPad,
      paddingRight: cellPad,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    thRight: { textAlign: "right" },
    td: {
      paddingTop: rowGap,
      paddingBottom: rowGap,
      paddingLeft: cellPad,
      paddingRight: cellPad,
      borderBottom: cellBorder,
      fontSize: spec.tablePt,
      color: spec.colors.text,
    },
    tdRight: { textAlign: "right" },
    tdMuted: { color: spec.colors.muted },
    tdStrong: { fontFamily: spec.pdfBold },
    stripe: { backgroundColor: spec.colors.tableStripe },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: rowGap * 0.35,
      paddingBottom: rowGap * 0.35,
      fontSize: spec.basePt,
    },
    grandRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: rowGap * 0.5,
      paddingTop: rowGap * 0.75,
      paddingBottom: rowGap * 0.75,
      paddingLeft: cellPad,
      paddingRight: cellPad,
      backgroundColor: spec.colors.totalsPanel,
      borderRadius: spec.radius,
      fontFamily: spec.pdfBold,
      fontSize: spec.basePt * 1.08,
      color: spec.colors.text,
    },
    metaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: rowGap * 0.2 },
    footer: {
      position: "absolute",
      left: pad.left,
      right: pad.right,
      bottom: mmToPt(6),
      fontSize: spec.tinyPt,
      color: spec.colors.muted,
      borderTopWidth: spec.divider === "none" ? 0 : 0.4,
      borderTopColor: spec.borderColor,
      paddingTop: rowGap * 0.5,
    },
  });

  const billToLines: string[] = [];
  if (model.customer.name) billToLines.push(model.customer.name);
  if (model.customer.company) billToLines.push(model.customer.company);
  if (model.customer.address) billToLines.push(model.customer.address);
  if (d.showCustomerEmail && model.customer.email) billToLines.push(model.customer.email);
  if (d.showCustomerPhone && model.customer.phone) billToLines.push(model.customer.phone);
  if (d.showTaxId && model.customer.taxId) billToLines.push(`Tax ID: ${model.customer.taxId}`);

  const businessLines: string[] = [];
  if (model.business.addressLine1) businessLines.push(model.business.addressLine1);
  if (model.business.addressLine2) businessLines.push(model.business.addressLine2);
  const cityLine = [model.business.city, model.business.state, model.business.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) businessLines.push(cityLine);
  if (model.business.country) businessLines.push(model.business.country);
  const businessContact = [model.business.email, model.business.phone, model.business.website]
    .filter(Boolean)
    .join("  ·  ");

  const metaRows: [string, string][] = [["Invoice number", model.invoiceNumber || "—"]];
  metaRows.push(["Invoice date", formatDate(model.invoiceDate)]);
  if (d.showDueDate) metaRows.push(["Due date", formatDate(model.dueDate)]);
  if (model.poNumber) metaRows.push(["PO number", model.poNumber]);
  if (model.reference) metaRows.push(["Reference", model.reference]);
  if (d.showPaymentTerms && model.paymentTerms) metaRows.push(["Payment terms", model.paymentTerms]);

  const summaryRows: [string, string][] = [["Subtotal", money(totals.subtotal)]];
  if (d.showDiscount && totals.discountTotal.gt(0)) summaryRows.push(["Discount", `-${money(totals.discountTotal)}`]);
  if (d.showTax && totals.taxTotal.gt(0)) {
    summaryRows.push([model.invoiceType === "tax" ? "VAT" : "Tax", money(totals.taxTotal)]);
  }
  if (d.showShipping && totals.shipping.gt(0)) summaryRows.push(["Shipping", money(totals.shipping)]);
  if (d.showFees && totals.fees.gt(0)) summaryRows.push(["Fees", money(totals.fees)]);
  if (d.showAdjustment && !totals.adjustment.isZero()) {
    summaryRows.push(["Adjustment", `${totals.adjustment.gt(0) ? "+" : "-"}${money(totals.adjustment.abs())}`]);
  }

  const typeLabel = INVOICE_TYPE_META[model.invoiceType]?.label ?? "Invoice";

  /* --- repeating band: slim letterhead + table header --------------------- */
  const FixedBand = (
    <View fixed>
      <View style={[styles.row, { justifyContent: "space-between", paddingBottom: rowGap * 0.6, borderBottomWidth: 0.5, borderBottomColor: spec.borderColor }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: cellPad }}>
          {d.logoPosition !== "hidden" && logoDataUrl ? (
            /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */
            <Image
              src={logoDataUrl}
              style={{ width: spec.logoWidthPt * 0.42, height: spec.logoWidthPt * 0.42, objectFit: "contain" }}
            />
          ) : null}
          <Text style={{ fontFamily: spec.pdfBold, fontSize: spec.basePt * 1.05, color: spec.colors.text }}>
            {model.business.businessName || "Invoice"}
          </Text>
        </View>
        <Text style={{ fontFamily: spec.pdfBold, fontSize: spec.basePt, color: spec.colors.primary, letterSpacing: 1 }}>
          {typeLabel.toUpperCase()} · {model.invoiceNumber}
        </Text>
      </View>
      <View style={{ height: rowGap * 0.8 }} />
      <View style={styles.tableHead}>
        <Text style={[styles.th, { width: "46%" }]}>Description</Text>
        <Text style={[styles.th, styles.thRight, { width: "9%" }]}>Qty</Text>
        <Text style={[styles.th, styles.thRight, { width: "13%" }]}>Unit price</Text>
        {showDiscountColumn ? <Text style={[styles.th, styles.thRight, { width: "11%" }]}>Discount</Text> : null}
        {showTaxColumn ? <Text style={[styles.th, styles.thRight, { width: "9%" }]}>Tax</Text> : null}
        <Text style={[styles.th, styles.thRight, { width: "12%" }]}>Amount</Text>
      </View>
    </View>
  );

  return (
    <Document
      title={`${typeLabel} ${model.invoiceNumber}`}
      author={model.business.businessName || undefined}
      subject={`${typeLabel} for ${model.customer.name || model.customer.company || "customer"}`}
      keywords="invoice, receipt, billing"
      creator="Invoice Generator"
      producer="Invoice Generator"
    >
      <Page size={[size.width, size.height]} style={styles.page} wrap>
        {spec.accentStyle !== "none" ? <View style={styles.accent} fixed /> : null}

        {/* letterhead */}
        <View style={[styles.row, { justifyContent: "space-between", paddingBottom: rowGap * 0.9, marginBottom: rowGap * 0.9, borderBottomWidth: spec.divider === "none" ? 0 : 0.5, borderBottomColor: spec.borderColor }]}>
          <View style={{ gap: cellPad, flexDirection: d.logoPosition === "right" ? "row-reverse" : "row", flexShrink: 1 }}>
            {d.logoPosition !== "hidden" ? (
              logoDataUrl ? (
                /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */
                <Image
                  src={logoDataUrl}
                  style={{ width: spec.logoWidthPt, maxHeight: spec.logoMaxHeightPt, objectFit: "contain" }}
                />
              ) : model.business.businessName ? (
                <View
                  style={{
                    width: spec.logoWidthPt,
                    height: spec.logoWidthPt,
                    borderRadius: spec.radius,
                    backgroundColor: spec.colors.accentFill === "transparent" ? spec.colors.totalsPanel : spec.colors.accentFill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#ffffff", fontFamily: spec.pdfBold, fontSize: spec.logoWidthPt * 0.34 }}>
                    {initials(model.business.businessName || "YB")}
                  </Text>
                </View>
              ) : null
            ) : null}
            <View style={{ flexShrink: 1 }}>
              {model.business.businessName ? <Text style={styles.brandName}>{model.business.businessName}</Text> : null}
              {businessLines.length ? <Text style={[styles.muted, { marginTop: 1.5 }]}>{businessLines.join("\n")}</Text> : null}
              {businessContact ? <Text style={[styles.muted, { marginTop: 1.5 }]}>{businessContact}</Text> : null}
              {d.showTaxId && model.business.taxId ? (
                <Text style={[styles.muted, { marginTop: 1.5 }]}>
                  Tax ID: {model.business.taxId}
                  {model.business.registrationNumber ? ` · Reg: ${model.business.registrationNumber}` : ""}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: d.titlePosition === "right" ? "flex-end" : "flex-start" }}>
            <Text
              style={{
                fontFamily: spec.pdfBold,
                fontSize: spec.titlePt,
                color: spec.colors.primary,
                letterSpacing: spec.accentStyle === "block" ? -0.5 : 1.6,
              }}
            >
              {typeLabel.toUpperCase()}
            </Text>
            {model.paymentStatus !== "unpaid" ? (
              <View
                style={{
                  marginTop: rowGap * 0.4,
                  paddingHorizontal: cellPad,
                  paddingVertical: 1.5,
                  borderRadius: 999,
                  backgroundColor: spec.colors.totalsPanel,
                  alignSelf: d.titlePosition === "right" ? "flex-end" : "flex-start",
                }}
              >
                <Text style={{ fontSize: spec.labelPt, fontFamily: spec.pdfBold, color: spec.colors.primary, letterSpacing: 0.8 }}>
                  {(PAYMENT_STATUS_LABELS[model.paymentStatus] ?? model.paymentStatus).toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* parties + meta */}
        <View style={[styles.row, { marginBottom: rowGap * 0.9, gap: mmToPt(6) }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { marginBottom: rowGap * 0.25 }]}>Bill to</Text>
            {billToLines.map((line, i) => (
              <Text
                key={`${line}-${i}`}
                style={
                  i === 0
                    ? { fontFamily: spec.pdfBold, fontSize: spec.basePt * 1.05, marginBottom: 0.8 }
                    : [styles.muted, { marginBottom: 0.8 }]
                }
              >
                {line}
              </Text>
            ))}
            {d.showShippingAddress && model.customer.shippingAddress ? (
              <>
                <Text style={[styles.label, { marginTop: rowGap * 0.5, marginBottom: rowGap * 0.25 }]}>Ship to</Text>
                <Text style={styles.muted}>{model.customer.shippingAddress}</Text>
              </>
            ) : null}
          </View>
          <View style={{ width: mmToPt(62) }}>
            {metaRows.map(([label, value]) => (
              <View key={label} style={styles.metaRow}>
                <Text style={styles.muted}>{label}</Text>
                <Text style={{ fontFamily: spec.pdfBold, fontSize: spec.basePt }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* repeating band from page 2 onwards */}
        {FixedBand}

        {/* items */}
        {model.items.length === 0 ? (
          <Text style={[styles.td, { textAlign: "center" }]}>No items yet</Text>
        ) : null}
        {model.items.map((item, index) => {
          const calc = totals.items[index];
          const stripe = spec.tableStyle === "striped" && index % 2 === 1;
          return (
            <View key={item.id} style={[styles.row, stripe ? styles.stripe : undefined]}>
              <View style={{ width: "46%", padding: cellPad, borderBottomWidth: 0.4, borderBottomColor: spec.borderColor, borderTopWidth: 0.4, borderTopColor: spec.borderColor }}>
                <Text style={{ fontFamily: spec.pdfBold, fontSize: spec.tablePt }}>
                  {item.name || "Untitled item"}
                </Text>
                {d.showItemDescriptions && item.description ? (
                  <Text style={[styles.muted, { marginTop: 1, fontSize: spec.mutedPt }]}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={[styles.td, styles.tdRight, { width: "9%" }]}>{trimNumber(item.quantity)}</Text>
              <Text style={[styles.td, styles.tdRight, { width: "13%" }]}>{money(calc.base)}</Text>
              {showDiscountColumn ? (
                <Text style={[styles.td, styles.tdRight, { width: "11%" }, Number(item.discount) === 0 ? styles.tdMuted : undefined]}>
                  {Number(item.discount) > 0 ? `${trimNumber(item.discount)}%` : "—"}
                </Text>
              ) : null}
              {showTaxColumn ? (
                <Text style={[styles.td, styles.tdRight, { width: "9%" }, Number(item.tax) === 0 ? styles.tdMuted : undefined]}>
                  {Number(item.tax) > 0 ? `${trimNumber(item.tax)}%` : "—"}
                </Text>
              ) : null}
              <Text style={[styles.td, styles.tdRight, styles.tdStrong, { width: "12%" }]}>
                {money(calc.total)}
              </Text>
            </View>
          );
        })}
        <View style={{ height: rowGap * 0.4 }} />

        {/* totals — kept together */}
        <View style={{ alignItems: "flex-end" }} wrap={false}>
          <View style={{ width: mmToPt(74) }}>
            {summaryRows.map(([label, value]) => (
              <View key={label} style={styles.totalRow}>
                <Text>{label}</Text>
                <Text style={{ fontFamily: spec.pdfBold }}>{value}</Text>
              </View>
            ))}
            <View style={styles.grandRow}>
              <Text>Total</Text>
              <Text>{money(totals.total)}</Text>
            </View>
            {d.showAmountPaid && totals.amountPaid.gt(0) ? (
              <>
                <View style={[styles.totalRow, { paddingHorizontal: cellPad, color: spec.colors.muted }]}>
                  <Text style={styles.muted}>Amount paid</Text>
                  <Text style={styles.muted}>-{money(totals.amountPaid)}</Text>
                </View>
                <View style={[styles.totalRow, { paddingHorizontal: cellPad }]}>
                  <Text style={{ fontFamily: spec.pdfBold, color: spec.colors.primary }}>Amount due</Text>
                  <Text style={{ fontFamily: spec.pdfBold, color: spec.colors.primary }}>{money(totals.amountDue)}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* notes / terms */}
        {(d.showNotes && (model.notes || model.terms)) ||
        (d.showShipping && model.customer.shippingAddress) ? (
          <View style={[styles.row, { marginTop: rowGap * 0.9, gap: mmToPt(6) }]} wrap={false}>
            {d.showNotes && model.notes ? (
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { marginBottom: rowGap * 0.2 }]}>Notes</Text>
                <Text style={styles.muted}>{model.notes}</Text>
              </View>
            ) : null}
            {d.showNotes && model.terms ? (
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { marginBottom: rowGap * 0.2 }]}>Terms & conditions</Text>
                <Text style={styles.muted}>{model.terms}</Text>
              </View>
            ) : null}
            {d.showShipping && model.customer.shippingAddress ? (
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { marginBottom: rowGap * 0.2 }]}>Shipping address</Text>
                <Text style={styles.muted}>{model.customer.shippingAddress}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* payment */}
        {d.showPaymentButton && model.paymentEnabled && totals.amountDue.gt(0) ? (
          <View
            style={[
              styles.row,
              {
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: rowGap * 0.8,
                padding: mmToPt(3.4),
                borderWidth: 0.5,
                borderColor: spec.borderColor,
                borderRadius: spec.radius,
              },
            ]}
            wrap={false}
          >
            <View>
              <Text style={styles.muted}>Amount due</Text>
              <Text style={{ fontFamily: spec.pdfBold, fontSize: spec.basePt * 1.3 }}>
                {money(totals.amountDue)}
              </Text>
            </View>
            <View
              style={{
                paddingVertical: mmToPt(2.2),
                paddingHorizontal: mmToPt(6),
                borderRadius: spec.radius,
                backgroundColor: spec.colors.accentFill === "transparent" ? spec.colors.primary : spec.colors.accentFill,
              }}
            >
              <Text style={{ color: "#ffffff", fontFamily: spec.pdfBold, fontSize: spec.basePt }}>
                Pay now{model.payUrl ? ` · ${model.payUrl}` : ""}
              </Text>
            </View>
          </View>
        ) : null}

        {/* footer */}
        {d.showFooter ? (
          <View style={styles.footer} fixed>
            {model.paymentInstructions ? (
              <Text style={styles.tiny}>Payment instructions: {model.paymentInstructions}</Text>
            ) : null}
            {model.footerText ? <Text style={styles.tiny}>{model.footerText}</Text> : null}
            <View style={[styles.row, { justifyContent: "space-between", marginTop: 1 }]}>
              <Text style={styles.tiny}>
                {[model.business.businessName, model.business.email].filter(Boolean).join(" · ")}
              </Text>
              {d.showPageNumbers ? (
                <Text
                  style={styles.tiny}
                  render={({ pageNumber, totalPages }) =>
                    `${model.invoiceNumber} · Page ${pageNumber} of ${totalPages}`
                  }
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

function trimNumber(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value || "0";
  return String(Number(n.toFixed(4)));
}
