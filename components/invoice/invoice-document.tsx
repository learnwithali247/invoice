import * as React from "react";
import type { RenderModel } from "@/lib/invoice/types";
import { INVOICE_TYPE_META, PAYMENT_STATUS_LABELS } from "@/lib/invoice/types";
import { buildRenderSpec, COLUMN_WIDTHS } from "@/lib/invoice/render-spec";
import { withAlpha } from "@/lib/invoice/color";
import { formatDate } from "@/lib/invoice/date";
import { calculateTotals, formatMoney, type Decimal } from "@/lib/invoice/calculate";
import { initials } from "@/lib/utils";

type Spec = ReturnType<typeof buildRenderSpec>;
type Money = Decimal;

type Props = {
  model: RenderModel;
  /** Show the "Pay now" affordance as an interactive-looking button. */
  showPayButton?: boolean;
  className?: string;
  id?: string;
};

export function InvoiceDocument({ model, showPayButton = true, className, id }: Props) {
  const spec = React.useMemo(() => buildRenderSpec(model.design), [model.design]);
  const d = model.design;
  const totals = React.useMemo(
    () =>
      calculateTotals({
        items: model.items,
        discountType: model.discountType,
        discountValue: model.discountValue,
        shipping: model.shipping,
        fees: model.fees,
        adjustment: model.adjustment,
        amountPaid: model.amountPaid,
      }),
    [
      model.items,
      model.discountType,
      model.discountValue,
      model.shipping,
      model.fees,
      model.adjustment,
      model.amountPaid,
    ],
  );

  const money = (value: Money) => formatMoney(value, model.currencySymbol, getDecimals(model.currency));

  const typeLabel = INVOICE_TYPE_META[model.invoiceType]?.label ?? "Invoice";
  const showTaxColumn = d.showTax && model.items.some((i) => Number(i.tax) > 0);
  const showDiscountColumn =
    d.showDiscount &&
    (model.items.some((i) => Number(i.discount) > 0) ||
      (model.discountValue !== "0" && model.discountValue !== ""));

  const sheetStyle: React.CSSProperties = {
    width: `${spec.pageWidthMm}mm`,
    minHeight: `${spec.pageHeightMm}mm`,
    padding: `${spec.paddingMm.top}mm ${spec.paddingMm.right}mm ${spec.paddingMm.bottom}mm ${spec.paddingMm.left}mm`,
    background: spec.colors.background,
    color: spec.colors.text,
    fontFamily: spec.fontStack,
    fontSize: `${spec.basePt}pt`,
    lineHeight: 1.45,
    position: "relative",
    overflow: "hidden",
  };

  const isVoid = model.status === "cancelled";

  return (
    <div id={id} className={className} style={sheetStyle} data-page-size={spec.pageSize}>
      {/* watermark for non-final documents */}
      {model.status === "draft" || isVoid ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: `${spec.titlePt * 3.2}pt`,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: withAlpha(spec.colors.muted, 0.1),
              transform: "rotate(-28deg)",
              userSelect: "none",
            }}
          >
            {isVoid ? "CANCELLED" : "DRAFT"}
          </span>
        </div>
      ) : null}

      {/* accent rule */}
      {spec.accentStyle !== "none" ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: spec.accentStyle === "hairline" ? "0.6mm" : spec.accentStyle === "block" ? "4mm" : "1.6mm",
            background: spec.colors.accentFill,
          }}
        />
      ) : null}

      <HeaderBlock
        model={model}
        spec={spec}
        typeLabel={typeLabel}
        align={d.headerAlignment}
      />

      <PartiesBlock model={model} spec={spec} />

      <ItemsBlock
        model={model}
        spec={spec}
        totals={totals}
        money={money}
        showTaxColumn={showTaxColumn}
        showDiscountColumn={showDiscountColumn}
      />

      <TotalsBlock model={model} spec={spec} totals={totals} money={money} />

      {(d.showNotes && (model.notes || model.terms)) || (d.showShipping && model.customer.shippingAddress) ? (
        <NotesBlock model={model} spec={spec} />
      ) : null}

      {d.showPaymentButton && showPayButton && model.paymentEnabled && Number(totals.amountDue.toString()) > 0 ? (
        <PaymentBlock spec={spec} amountDue={money(totals.amountDue)} />

      ) : null}

      {d.showFooter && (model.footerText || model.paymentInstructions || businessExtra(model)) ? (
        <FooterBlock model={model} spec={spec} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

function HeaderBlock({
  model,
  spec,
  typeLabel,
  align,
}: {
  model: RenderModel;
  spec: Spec;
  typeLabel: string;
  align: string;
}) {
  const d = model.design;
  const centered = align === "center";


  const logo = d.logoPosition !== "hidden" && (model.business.logoUrl || model.business.businessName);

  const brandBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.6mm", minWidth: 0 }}>
      {model.business.businessName ? (
        <div
          style={{
            fontSize: `${spec.headingPt}pt`,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            color: spec.colors.text,
            overflowWrap: "anywhere",
          }}
        >
          {model.business.businessName}
        </div>
      ) : null}
      <BusinessMeta model={model} spec={spec} />
    </div>
  );

  const titleBlock = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.2mm",
        textAlign: d.titlePosition === "right" ? "right" : "left",
        alignItems: d.titlePosition === "right" ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          fontSize: `${spec.titlePt}pt`,
          fontWeight: 800,
          letterSpacing: `${spec.accentStyle === "block" ? "-0.02" : "0.04"}em`,
          textTransform: "uppercase",
          lineHeight: 1,
          color: spec.colors.primary,
        }}
      >
        {typeLabel}
      </div>
      {model.status !== "draft" || model.paymentStatus !== "unpaid" ? (
        <StatusPill model={model} spec={spec} />
      ) : null}
    </div>
  );

  const logoNode = logo ? (
    <Logo model={model} spec={spec} position={d.logoPosition} />
  ) : null;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: centered ? "center" : "space-between",
        gap: "6mm",
        flexDirection: centered ? "column" : "row",
        paddingTop: spec.accentStyle === "block" ? "2mm" : "1mm",
        paddingBottom: "5mm",
        borderBottom:
          spec.divider === "none" ? "none" : `${spec.dividerWidthMm}mm solid ${spec.borderColor}`,
        marginBottom: "5mm",
        textAlign: centered ? "center" : "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "4mm",
          flexDirection: d.logoPosition === "right" ? "row-reverse" : "row",
          minWidth: 0,
        }}
      >
        {logoNode}
        {brandBlock}
      </div>
      {titleBlock}
    </header>
  );
}

function Logo({
  model,
  spec,
  position,
}: {
  model: RenderModel;
  spec: Spec;
  position: string;
}) {
  const { logoUrl, businessName } = model.business;
  const sizeMm = mmToMm(spec.logoWidthPt);

  if (!logoUrl) {
    return (
      <div
        aria-hidden
        style={{
          width: `${sizeMm}mm`,
          minWidth: `${sizeMm}mm`,
          height: `${sizeMm}mm`,
          borderRadius: `${Math.min(spec.radius, 8)}px`,
          background:
            spec.colors.accentFill === "transparent" ? spec.colors.totalsPanel : spec.colors.accentFill,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${spec.logoWidthPt * 0.34}pt`,
          fontWeight: 800,
          letterSpacing: "0.02em",
          flexShrink: 0,
        }}
      >
        {initials(businessName || "Your Business")}
      </div>
    );
  }
  return (
    <img
      src={logoUrl}

      alt={`${businessName || "Business"} logo`}
      style={{
        width: `${sizeMm}mm`,
        maxHeight: `${mmToMm(spec.logoMaxHeightPt)}mm`,
        objectFit: "contain",
        objectPosition: position === "right" ? "right center" : "left center",
        flexShrink: 0,
      }}
    />
  );
}

function BusinessMeta({ model, spec }: { model: RenderModel; spec: Spec }) {
  const b = model.business;
  const rows: string[] = [];
  if (b.addressLine1) rows.push(b.addressLine1);
  if (b.addressLine2) rows.push(b.addressLine2);
  const cityLine = [b.city, b.state, b.postalCode].filter(Boolean).join(", ");
  if (cityLine) rows.push(cityLine);
  if (b.country) rows.push(b.country);
  const contact = [b.email, b.phone, b.website].filter(Boolean).join("  ·  ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6mm", minWidth: 0 }}>
      {rows.length ? (
        <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted, whiteSpace: "pre-line" }}>
          {rows.join("\n")}
        </div>
      ) : null}
      {contact ? (
        <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted, overflowWrap: "anywhere" }}>
          {contact}
        </div>
      ) : null}
      {model.design.showTaxId && b.taxId ? (
        <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted }}>
          Tax ID: {b.taxId}
          {b.registrationNumber ? ` · Reg: ${b.registrationNumber}` : ""}
        </div>
      ) : null}
      {b.additionalInfo ? (
        <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted, whiteSpace: "pre-line" }}>
          {b.additionalInfo}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ model, spec }: { model: RenderModel; spec: Spec }) {
  const label = PAYMENT_STATUS_LABELS[model.paymentStatus] ?? model.paymentStatus;
  const paid = model.paymentStatus === "paid";
  const bg = paid ? "#ecfdf5" : model.paymentStatus === "overdue" ? "#fef2f2" : spec.colors.totalsPanel;
  const fg = paid ? "#047857" : model.paymentStatus === "overdue" ? "#b91c1c" : spec.colors.primary;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.6mm 2.4mm",
        borderRadius: "999px",
        background: bg,
        color: fg,
        fontSize: `${spec.labelPt}pt`,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Parties + meta                                                             */
/* -------------------------------------------------------------------------- */

function PartiesBlock({ model, spec }: { model: RenderModel; spec: Spec }) {
  const d = model.design;
  const c = model.customer;
  const meta: [string, string][] = [
    ["Invoice number", model.invoiceNumber || "—"],
    ["Invoice date", formatDate(model.invoiceDate)],
  ];
  if (d.showDueDate) meta.push(["Due date", formatDate(model.dueDate)]);
  if (model.poNumber) meta.push(["PO number", model.poNumber]);
  if (model.reference) meta.push(["Reference", model.reference]);
  if (d.showPaymentTerms && model.paymentTerms) meta.push(["Payment terms", model.paymentTerms]);

  const showShip = d.showShippingAddress && Boolean(c.shippingAddress);

  return (
    <section
      style={{
        display: "flex",
        gap: "6mm",
        alignItems: "flex-start",
        marginBottom: "6mm",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 46mm", minWidth: 0 }}>
        <SectionLabel spec={spec}>Bill to</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6mm" }}>
          {c.name ? (
            <div style={{ fontSize: `${spec.basePt * 1.05}pt`, fontWeight: 700, color: spec.colors.text }}>
              {c.name}
            </div>
          ) : null}
          {c.company ? (
            <div style={{ fontSize: `${spec.basePt}pt`, color: spec.colors.text }}>{c.company}</div>
          ) : null}
          {c.address ? (
            <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted, whiteSpace: "pre-line" }}>
              {c.address}
            </div>
          ) : null}
          {d.showCustomerEmail && c.email ? (
            <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted }}>{c.email}</div>
          ) : null}
          {d.showCustomerPhone && c.phone ? (
            <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted }}>{c.phone}</div>
          ) : null}
          {d.showTaxId && c.taxId ? (
            <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted }}>Tax ID: {c.taxId}</div>
          ) : null}
        </div>
        {showShip ? (
          <div style={{ marginTop: "3.5mm" }}>
            <SectionLabel spec={spec}>Ship to</SectionLabel>
            <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted, whiteSpace: "pre-line" }}>
              {c.shippingAddress}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ flex: "0 1 62mm", minWidth: 0 }}>
        <dl
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: "3mm",
            rowGap: "1.1mm",
            fontSize: `${spec.basePt}pt`,
          }}
        >
          {meta.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt style={{ color: spec.colors.muted, fontSize: `${spec.mutedPt}pt`, whiteSpace: "nowrap" }}>
                {label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: spec.colors.text,
                  textAlign: d.headerAlignment === "right" ? "left" : "right",
                  overflowWrap: "anywhere",
                }}
              >
                {value}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </section>
  );
}

function SectionLabel({ spec, children }: { spec: Spec; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: `${spec.labelPt}pt`,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: spec.colors.secondary,
        marginBottom: "1.4mm",
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Items                                                                      */
/* -------------------------------------------------------------------------- */

function ItemsBlock({
  model,
  spec,
  totals,
  money,
  showTaxColumn,
  showDiscountColumn,
}: {
  model: RenderModel;
  spec: Spec;
  totals: ReturnType<typeof calculateTotals>;
  money: (v: Money) => string;
  showTaxColumn: boolean;
  showDiscountColumn: boolean;
}) {
  const d = model.design;
  const cols = [
    { key: "item", label: "Description", width: COLUMN_WIDTHS.item, align: "left" as const },
    { key: "qty", label: "Qty", width: COLUMN_WIDTHS.qty, align: "right" as const },
    { key: "price", label: "Unit price", width: COLUMN_WIDTHS.price, align: "right" as const },
    ...(showDiscountColumn
      ? [{ key: "discount", label: "Discount", width: COLUMN_WIDTHS.discount, align: "right" as const }]
      : []),
    ...(showTaxColumn ? [{ key: "tax", label: "Tax", width: COLUMN_WIDTHS.tax, align: "right" as const }] : []),
    { key: "total", label: "Amount", width: COLUMN_WIDTHS.total, align: "right" as const },
  ];

  const striped = spec.tableStyle === "striped";
  const bordered = spec.borderWidth > 0;

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        marginBottom: "5mm",
        fontSize: `${spec.tablePt}pt`,

      }}
    >
      <colgroup>
        {cols.map((c) => (
          <col key={c.key} style={{ width: `${c.width}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {cols.map((c) => (
            <th
              key={c.key}
              scope="col"
              style={{
                background: spec.colors.tableHeaderBackground,
                color: spec.colors.tableHeaderText,
                fontSize: `${spec.labelPt}pt`,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textAlign: c.align,
                padding: `${spec.cellPadY * 0.92}mm ${spec.cellPadX}mm`,
                borderRight:
                  bordered && c.key !== "total"
                    ? `${spec.borderWidth}mm solid ${withAlpha(spec.colors.tableHeaderText, 0.18)}`
                    : undefined,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.items.length === 0 ? (
          <tr>
            <td
              colSpan={cols.length}
              style={{
                padding: `${spec.cellPadY * 2}mm ${spec.cellPadX}mm`,
                color: spec.colors.muted,
                fontSize: `${spec.mutedPt}pt`,
                textAlign: "center",
              }}
            >
              No items yet
            </td>
          </tr>
        ) : null}
        {model.items.map((item, index) => {
          const calc = totals.items[index];
          const hasDesc = d.showItemDescriptions && Boolean(item.description);
          return (
            <tr
              key={item.id}
              style={{
                background: striped && index % 2 === 1 ? spec.colors.tableStripe : "transparent",
              }}
            >
              <td
                style={{
                  padding: `${spec.cellPadY}mm ${spec.cellPadX}mm`,
                  borderBottom: bordered ? `${spec.borderWidth}mm solid ${spec.borderColor}` : "none",
                  verticalAlign: "top",
                }}
              >
                <div style={{ fontWeight: 600, color: spec.colors.text, overflowWrap: "anywhere" }}>
                  {item.name || "Untitled item"}
                </div>
                {hasDesc ? (
                  <div
                    style={{
                      marginTop: "0.5mm",
                      fontSize: `${spec.mutedPt}pt`,
                      color: spec.colors.muted,
                      whiteSpace: "pre-line",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.description}
                  </div>
                ) : null}
              </td>
              <NumCell spec={spec} bordered={bordered}>
                {trimNumber(item.quantity)}
              </NumCell>
              <NumCell spec={spec} bordered={bordered}>
                {money(calc.base)}
              </NumCell>
              {showDiscountColumn ? (
                <NumCell spec={spec} bordered={bordered} muted={Number(item.discount) === 0}>
                  {Number(item.discount) > 0 ? `${trimNumber(item.discount)}%` : "—"}
                </NumCell>
              ) : null}
              {showTaxColumn ? (
                <NumCell spec={spec} bordered={bordered} muted={Number(item.tax) === 0}>
                  {Number(item.tax) > 0 ? `${trimNumber(item.tax)}%` : "—"}
                </NumCell>
              ) : null}
              <td
                style={{
                  padding: `${spec.cellPadY}mm ${spec.cellPadX}mm`,
                  borderBottom: bordered ? `${spec.borderWidth}mm solid ${spec.borderColor}` : "none",
                  textAlign: "right",
                  fontWeight: 700,
                  color: spec.colors.text,
                  whiteSpace: "nowrap",
                }}
              >
                {money(calc.total)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NumCell({
  spec,
  bordered,
  muted,
  children,
}: {
  spec: Spec;
  bordered: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: `${spec.cellPadY}mm ${spec.cellPadX}mm`,
        borderBottom: bordered ? `${spec.borderWidth}mm solid ${spec.borderColor}` : "none",
        textAlign: "right",
        whiteSpace: "nowrap",
        color: muted ? spec.colors.muted : spec.colors.text,
      }}
    >
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/*  Totals                                                                     */
/* -------------------------------------------------------------------------- */

function TotalsBlock({
  model,
  spec,
  totals,
  money,
}: {
  model: RenderModel;
  spec: Spec;
  totals: ReturnType<typeof calculateTotals>;
  money: (v: Money) => string;
}) {
  const d = model.design;
  const rows: [string, string, boolean?][] = [];
  rows.push(["Subtotal", money(totals.subtotal)]);
  if (d.showDiscount && totals.discountTotal.gt(0)) {
    rows.push([
      "Discount",
      `-${money(totals.discountTotal)}`,
      true,
    ]);
  }
  if (d.showTax && totals.taxTotal.gt(0)) rows.push([model.invoiceType === "tax" ? "VAT" : "Tax", money(totals.taxTotal)]);
  if (d.showShipping && totals.shipping.gt(0)) rows.push(["Shipping", money(totals.shipping)]);
  if (d.showFees && totals.fees.gt(0)) rows.push(["Fees", money(totals.fees)]);
  if (d.showAdjustment && !totals.adjustment.isZero()) {
    rows.push(["Adjustment", `${totals.adjustment.gt(0) ? "+" : "-"}${money(totals.adjustment.abs())}`]);
  }

  const labelWidth = 30;

  return (
    <section style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6mm" }}>
      <div style={{ width: `${labelWidth + 34}mm`, maxWidth: "100%" }}>
        {rows.map(([label, value, negative]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "4mm",
              padding: `0.9mm 0`,
              fontSize: `${spec.basePt}pt`,
              color: negative ? spec.colors.muted : spec.colors.text,
              borderBottom: spec.divider === "none" ? "none" : `${spec.dividerWidthMm || 0.2}mm solid ${withAlpha(spec.colors.muted, 0.18)}`,
            }}
          >
            <span>{label}</span>
            <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{value}</span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "4mm",
            marginTop: "1.5mm",
            padding: "2mm 2.4mm",
            borderRadius: `${spec.radius}px`,
            background: spec.colors.totalsPanel,
            fontSize: `${spec.basePt * 1.06}pt`,
            fontWeight: 800,
            color: spec.colors.text,
          }}
        >
          <span>Total</span>
          <span style={{ whiteSpace: "nowrap" }}>{money(totals.total)}</span>
        </div>
        {d.showAmountPaid && totals.amountPaid.gt(0) ? (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "4mm",
                padding: "1.4mm 2.4mm 0",
                fontSize: `${spec.basePt * 0.92}pt`,
                color: spec.colors.muted,
              }}
            >
              <span>Amount paid</span>
              <span style={{ fontWeight: 600 }}>-{money(totals.amountPaid)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "4mm",
                padding: "0.6mm 2.4mm",
                fontSize: `${spec.basePt}pt`,
                fontWeight: 800,
                color: spec.colors.primary,
              }}
            >
              <span>Amount due</span>
              <span style={{ whiteSpace: "nowrap" }}>{money(totals.amountDue)}</span>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Notes / terms                                                              */
/* -------------------------------------------------------------------------- */

function NotesBlock({ model, spec }: { model: RenderModel; spec: Spec }) {
  const c = model.customer;
  const showShip = model.design.showShippingAddress && Boolean(c.shippingAddress);
  return (
    <section
      style={{
        display: "flex",
        gap: "6mm",
        flexWrap: "wrap",
        marginBottom: "6mm",
      }}
    >
      {model.notes ? (
        <div style={{ flex: "1 1 40mm", minWidth: 0 }}>
          <SectionLabel spec={spec}>Notes</SectionLabel>
          <TextBlock spec={spec}>{model.notes}</TextBlock>
        </div>
      ) : null}
      {model.terms ? (
        <div style={{ flex: "1 1 40mm", minWidth: 0 }}>
          <SectionLabel spec={spec}>Terms & conditions</SectionLabel>
          <TextBlock spec={spec}>{model.terms}</TextBlock>
        </div>
      ) : null}
      {showShip ? (
        <div style={{ flex: "1 1 40mm", minWidth: 0 }}>
          <SectionLabel spec={spec}>Shipping address</SectionLabel>
          <TextBlock spec={spec}>{c.shippingAddress}</TextBlock>
        </div>
      ) : null}
    </section>
  );
}

function TextBlock({ spec, children }: { spec: Spec; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: `${spec.mutedPt}pt`,
        color: spec.colors.muted,
        whiteSpace: "pre-line",
        lineHeight: 1.5,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Payment + footer                                                           */
/* -------------------------------------------------------------------------- */

function PaymentBlock({
  spec,
  amountDue,
}: {
  spec: Spec;
  amountDue: string;
}) {

  return (
    <section
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "4mm",
        flexWrap: "wrap",
        padding: "3.4mm 4mm",
        borderRadius: `${spec.radius}px`,
        border: `${spec.borderWidth || 0.3}mm solid ${spec.borderColor}`,
        marginBottom: "6mm",
        breakInside: "avoid",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: `${spec.mutedPt}pt`, color: spec.colors.muted }}>Amount due</div>
        <div style={{ fontSize: `${spec.basePt * 1.3}pt`, fontWeight: 800, color: spec.colors.text }}>
          {amountDue}
        </div>
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "2mm",
          padding: "2.4mm 6mm",
          borderRadius: `${Math.min(spec.radius, 8)}px`,
          background: spec.colors.accentFill === "transparent" ? spec.colors.primary : spec.colors.accentFill,
          color: "#ffffff",
          fontSize: `${spec.basePt * 0.98}pt`,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        Pay now
      </div>
    </section>
  );
}

function FooterBlock({ model, spec }: { model: RenderModel; spec: Spec }) {
  const extra = businessExtra(model);
  return (
    <footer
      style={{
        marginTop: "auto",
        paddingTop: "4mm",
        borderTop: spec.divider === "none" ? "none" : `${spec.dividerWidthMm || 0.2}mm solid ${spec.borderColor}`,
        display: "flex",
        flexDirection: "column",
        gap: "1.4mm",
        fontSize: `${spec.tinyPt}pt`,
        color: spec.colors.muted,
      }}
    >
      {model.paymentInstructions ? (
        <div style={{ whiteSpace: "pre-line" }}>
          <strong style={{ color: spec.colors.text }}>Payment instructions: </strong>
          {model.paymentInstructions}
        </div>
      ) : null}
      {extra ? <div style={{ whiteSpace: "pre-line" }}>{extra}</div> : null}
      {model.footerText ? (
        <div style={{ fontWeight: 600, color: spec.colors.text }}>{model.footerText}</div>
      ) : null}
    </footer>
  );
}

function businessExtra(model: RenderModel): string {
  const parts: string[] = [];
  if (model.business.businessName) parts.push(model.business.businessName);
  const contact = [model.business.email, model.business.phone, model.business.website].filter(
    Boolean,
  );
  if (contact.length) parts.push(contact.join("  · "));
  return parts.join(" — ");
}


/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

function trimNumber(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value || "0";
  return String(Number(n.toFixed(4)));
}

function getDecimals(code: string): number {
  return code === "JPY" || code === "KRW" ? 0 : 2;
}

const mmToMm = (pt: number) => pt / 2.834645669;
