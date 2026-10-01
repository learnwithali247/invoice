import Decimal from "decimal.js";

// Money is handled as base-10 decimals end to end. Never use floats for totals.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 });

export { Decimal };

export function dec(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  try {
    const d = new Decimal(String(value).replace(/[^0-9.\-]/g, ""));
    return d.isFinite() ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

export const clampPercent = (d: Decimal) =>
  Decimal.min(Decimal.max(d, new Decimal(0)), new Decimal(100));

/** Parse a human-entered number ("1 234,50" → 1234.5) for display fallback. */
export function parseLooseNumber(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/\s/g, "").replace(/[^0-9.,\-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalised = cleaned;
  if (lastComma > lastDot) {
    normalised = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalised = cleaned.replace(/,/g, "");
  }
  const n = Number(normalised);
  return Number.isFinite(n) ? n : 0;
}

export type CalculatedItem = {
  id: string;
  base: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  total: Decimal;
};

export type Totals = {
  items: CalculatedItem[];
  /** Σ quantity × unit price, before any discount. */
  subtotal: Decimal;
  /** Sum of the per-line discounts. */
  itemDiscountTotal: Decimal;
  /** The invoice-level discount (percent or fixed). */
  invoiceDiscount: Decimal;
  /** Everything that was taken off: item discounts + invoice discount. */
  discountTotal: Decimal;
  taxTotal: Decimal;
  shipping: Decimal;
  fees: Decimal;
  adjustment: Decimal;
  total: Decimal;
  amountPaid: Decimal;
  amountDue: Decimal;
};

export type TotalsInput = {
  items: { id: string; quantity: string; unitPrice: string; discount: string; tax: string }[];
  discountType: "percent" | "fixed";
  discountValue: string;
  shipping: string;
  fees: string;
  adjustment: string;
  amountPaid: string;
};

/**
 * Mirrors `public.recalculate_invoice_totals()` exactly, so the live preview
 * and the stored row always agree. Postgres remains the final authority.
 *
 * Order of operations:
 *   base_i            = qty_i × price_i
 *   item discount_i   = base_i × d_i
 *   netAfterItems     = Σ base_i − Σ item discount_i
 *   invoice discount  = percent ? rate × netAfterItems : min(netAfterItems, value)
 *   effectiveRate_i   = (1 − d_i) × (percent ? 1 − rate : 1)
 *   tax_i             = round(base_i × effectiveRate_i × t_i, 2)
 *   total             = netAfterItems − invoiceDiscount + Σ tax_i + shipping + fees + adjustment
 */
export function calculateTotals(input: TotalsInput): Totals {
  const HUNDRED = new Decimal(100);
  const isPercent = input.discountType === "percent";
  const invoiceRate = clampPercent(dec(input.discountValue)).div(HUNDRED);
  const invoiceShare = isPercent ? invoiceRate : new Decimal(0);

  const bases = input.items.map((item) =>
    Decimal.max(dec(item.quantity), new Decimal(0)).times(
      Decimal.max(dec(item.unitPrice), new Decimal(0)),
    ),
  );
  const itemRates = input.items.map((item) => clampPercent(dec(item.discount)).div(HUNDRED));
  const taxRates = input.items.map((item) => clampPercent(dec(item.tax)).div(HUNDRED));

  const subtotal = bases.reduce((acc, base) => acc.plus(base), new Decimal(0));
  const itemDiscountTotal = bases.reduce(
    (acc, base, index) => acc.plus(base.times(itemRates[index])),
    new Decimal(0),
  );
  const netAfterItems = Decimal.max(subtotal.minus(itemDiscountTotal), new Decimal(0));

  const invoiceDiscount = (
    isPercent
      ? netAfterItems.times(invoiceRate)
      : Decimal.min(netAfterItems, Decimal.max(dec(input.discountValue), new Decimal(0)))
  ).toDecimalPlaces(2);

  const items: CalculatedItem[] = input.items.map((item, index) => {
    const base = bases[index];
    const effectiveRate = Decimal.max(
      Decimal.max(new Decimal(1).minus(itemRates[index]), new Decimal(0)).times(
        Decimal.max(new Decimal(1).minus(invoiceShare), new Decimal(0)),
      ),
      new Decimal(0),
    );
    const taxable = base.times(effectiveRate);
    return {
      id: item.id,
      base,
      discountAmount: base.times(itemRates[index]).toDecimalPlaces(2),
      taxAmount: taxable.times(taxRates[index]).toDecimalPlaces(2),
      total: taxable.times(new Decimal(1).plus(taxRates[index])).toDecimalPlaces(2),
    };
  });

  const taxTotal = items.reduce((acc, item) => acc.plus(item.taxAmount), new Decimal(0));

  const shipping = Decimal.max(dec(input.shipping), new Decimal(0)).toDecimalPlaces(2);
  const fees = Decimal.max(dec(input.fees), new Decimal(0)).toDecimalPlaces(2);
  const adjustment = dec(input.adjustment).toDecimalPlaces(2);

  const total = netAfterItems
    .minus(invoiceDiscount)
    .plus(taxTotal)
    .plus(shipping)
    .plus(fees)
    .plus(adjustment)
    .toDecimalPlaces(2);

  const amountPaid = Decimal.min(
    Decimal.max(dec(input.amountPaid), new Decimal(0)),
    total,
  ).toDecimalPlaces(2);
  const amountDue = total.minus(amountPaid).toDecimalPlaces(2);

  return {
    items,
    subtotal,
    itemDiscountTotal: itemDiscountTotal.toDecimalPlaces(2),
    invoiceDiscount,
    discountTotal: itemDiscountTotal.plus(invoiceDiscount).toDecimalPlaces(2),
    taxTotal,
    shipping,
    fees,
    adjustment,
    total,
    amountPaid,
    amountDue,
  };
}

/** number | string -> plain number safe for JSON/DB round-trips. */
export const toNumber = (d: Decimal) => d.toNumber();

export function formatMoney(
  value: string | number | Decimal,
  symbol: string,
  decimals = 2,
  options: { showSign?: boolean } = {},
): string {
  const d = dec(value as string | number).toDecimalPlaces(decimals);
  const negative = d.isNegative();
  const abs = d.abs().toFixed(decimals);
  const [intPart, fracPart] = abs.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fracPart ? `${grouped}.${fracPart}` : grouped;
  const sign = negative ? "-" : options.showSign ? "+" : "";
  return `${sign}${symbol}${body}`;
}

export function formatCompact(value: string | number | Decimal, symbol: string, decimals = 2): string {
  const d = dec(value as string | number);
  const abs = d.abs();
  if (abs.gte(1_000_000)) return `${d.div(1_000_000).toFixed(2)}M${symbol === "$" ? "" : " " + symbol}`;
  if (abs.gte(10_000)) return `${d.div(1_000).toFixed(1)}k${symbol === "$" ? "" : " " + symbol}`;
  return formatMoney(d, symbol, decimals);
}
