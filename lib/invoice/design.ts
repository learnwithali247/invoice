import { getTemplate } from "./templates";

export const ACCENT_STYLES = ["none", "bar", "block", "hairline"] as const;
export type AccentStyle = (typeof ACCENT_STYLES)[number];

export const TABLE_STYLES = ["lined", "striped", "borderless"] as const;
export type TableStyle = (typeof TABLE_STYLES)[number];

export const DENSITIES = ["compact", "regular", "airy"] as const;
export type Density = (typeof DENSITIES)[number];

export const DIVIDERS = ["none", "hairline", "thin", "soft", "solid"] as const;
export type DividerStyle = (typeof DIVIDERS)[number];

export const ALIGNMENTS = ["left", "center", "right"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

export const LOGO_POSITIONS = ["left", "right", "hidden"] as const;
export type LogoPosition = (typeof LOGO_POSITIONS)[number];

/**
 * Design settings live in a single JSONB column so new visual options can be
 * added later without a schema migration. Every field is optional when read
 * from the database — `normaliseDesign` fills the gaps.
 */
export type DesignSettings = {
  template: string;

  // colours
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  backgroundColor: string;
  tableHeaderBackground: string;
  tableHeaderTextColor: string;

  // typography
  fontFamily: string;
  baseFontSize: number;
  headingScale: number;
  tableFontSize: number;

  // layout
  headerAlignment: Alignment;
  logoPosition: LogoPosition;
  businessPosition: "left" | "right";
  titlePosition: "left" | "right";
  accentStyle: AccentStyle;
  tableStyle: TableStyle;
  density: Density;
  divider: DividerStyle;
  borderRadius: number;
  rowSpacing: number;
  showTableBorders: boolean;
  logoWidth: number;

  // visibility
  showTaxId: boolean;
  showCustomerPhone: boolean;
  showCustomerEmail: boolean;
  showShippingAddress: boolean;
  showPaymentTerms: boolean;
  showDueDate: boolean;
  showNotes: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showFees: boolean;
  showAdjustment: boolean;
  showShipping: boolean;
  showFooter: boolean;
  showPaymentButton: boolean;
  showAmountPaid: boolean;
  showBankDetails: boolean;
  showItemDescriptions: boolean;
  showZeroValueColumns: boolean;

  // printing
  pageSize: "A4" | "Letter";

  // footer content
  footerNote: string;
  showPageNumbers: boolean;
};

export const DEFAULT_DESIGN: DesignSettings = {
  template: "modern",

  primaryColor: "#111827",
  secondaryColor: "#6b7280",
  textColor: "#111827",
  mutedColor: "#6b7280",
  borderColor: "#e5e7eb",
  backgroundColor: "#ffffff",
  tableHeaderBackground: "#111827",
  tableHeaderTextColor: "#ffffff",

  fontFamily: "inter",
  baseFontSize: 10,
  headingScale: 1.55,
  tableFontSize: 9.5,

  headerAlignment: "left",
  logoPosition: "left",
  businessPosition: "left",
  titlePosition: "right",
  accentStyle: "bar",
  tableStyle: "lined",
  density: "regular",
  divider: "soft",
  borderRadius: 4,
  rowSpacing: 6,
  showTableBorders: true,
  logoWidth: 96,

  showTaxId: true,
  showCustomerPhone: true,
  showCustomerEmail: true,
  showShippingAddress: true,
  showPaymentTerms: true,
  showDueDate: true,
  showNotes: true,
  showDiscount: true,
  showTax: true,
  showFees: false,
  showAdjustment: false,
  showShipping: true,
  showFooter: true,
  showPaymentButton: true,
  showAmountPaid: true,
  showBankDetails: true,
  showItemDescriptions: true,
  showZeroValueColumns: true,

  pageSize: "A4",

  footerNote: "",
  showPageNumbers: true,
};

/** Accepts unknown/partial JSON from the DB and produces a complete, safe object. */
export function normaliseDesign(input: unknown): DesignSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const templateSlug = typeof raw.template === "string" ? raw.template : DEFAULT_DESIGN.template;
  const template = getTemplate(templateSlug);
  const templateDefaults: Partial<DesignSettings> = {
    accentStyle: template.accentStyle as AccentStyle,
    tableStyle: template.tableStyle as TableStyle,
    density: template.density as Density,
    divider: template.divider as DividerStyle,
  };

  const merged = { ...DEFAULT_DESIGN, ...templateDefaults, ...raw } as DesignSettings & {
    template?: string;
  };

  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim())
      ? v.trim()
      : fallback;

  const primary = hex(merged.primaryColor, DEFAULT_DESIGN.primaryColor);

  return {
    ...merged,
    template: templateSlug,

    primaryColor: primary,
    secondaryColor: hex(merged.secondaryColor, DEFAULT_DESIGN.secondaryColor),
    textColor: hex(merged.textColor, DEFAULT_DESIGN.textColor),
    mutedColor: hex(merged.mutedColor, DEFAULT_DESIGN.mutedColor),
    borderColor: hex(merged.borderColor, DEFAULT_DESIGN.borderColor),
    backgroundColor: hex(merged.backgroundColor, DEFAULT_DESIGN.backgroundColor),
    tableHeaderBackground: hex(merged.tableHeaderBackground, primary),
    tableHeaderTextColor: hex(merged.tableHeaderTextColor, DEFAULT_DESIGN.tableHeaderTextColor),

    fontFamily: str(merged.fontFamily, DEFAULT_DESIGN.fontFamily),
    baseFontSize: num(merged.baseFontSize, DEFAULT_DESIGN.baseFontSize, 7, 14),
    headingScale: num(merged.headingScale, DEFAULT_DESIGN.headingScale, 1, 3),
    tableFontSize: num(merged.tableFontSize, DEFAULT_DESIGN.tableFontSize, 6, 14),

    headerAlignment: str(merged.headerAlignment, DEFAULT_DESIGN.headerAlignment) as Alignment,
    logoPosition: str(merged.logoPosition, DEFAULT_DESIGN.logoPosition) as LogoPosition,
    accentStyle: str(merged.accentStyle, DEFAULT_DESIGN.accentStyle) as AccentStyle,
    tableStyle: str(merged.tableStyle, DEFAULT_DESIGN.tableStyle) as TableStyle,
    density: str(merged.density, DEFAULT_DESIGN.density) as Density,
    divider: str(merged.divider, DEFAULT_DESIGN.divider) as DividerStyle,
    pageSize: (str(merged.pageSize, "A4") === "Letter" ? "Letter" : "A4") as "A4" | "Letter",

    borderRadius: num(merged.borderRadius, DEFAULT_DESIGN.borderRadius, 0, 24),
    rowSpacing: num(merged.rowSpacing, DEFAULT_DESIGN.rowSpacing, 0, 24),
    logoWidth: num(merged.logoWidth, DEFAULT_DESIGN.logoWidth, 32, 220),

    showTaxId: bool(merged.showTaxId, true),
    showCustomerPhone: bool(merged.showCustomerPhone, true),
    showCustomerEmail: bool(merged.showCustomerEmail, true),
    showShippingAddress: bool(merged.showShippingAddress, true),
    showPaymentTerms: bool(merged.showPaymentTerms, true),
    showDueDate: bool(merged.showDueDate, true),
    showNotes: bool(merged.showNotes, true),
    showDiscount: bool(merged.showDiscount, true),
    showTax: bool(merged.showTax, true),
    showFees: bool(merged.showFees, DEFAULT_DESIGN.showFees),
    showAdjustment: bool(merged.showAdjustment, DEFAULT_DESIGN.showAdjustment),
    showShipping: bool(merged.showShipping, true),
    showFooter: bool(merged.showFooter, true),
    showPaymentButton: bool(merged.showPaymentButton, true),
    showAmountPaid: bool(merged.showAmountPaid, true),
    showBankDetails: bool(merged.showBankDetails, true),
    showItemDescriptions: bool(merged.showItemDescriptions, true),
    showZeroValueColumns: bool(merged.showZeroValueColumns, true),
    showTableBorders: bool(merged.showTableBorders, true),
    showPageNumbers: bool(merged.showPageNumbers, true),
  };
}

/** Palette presets offered in the design panel. */
export const PALETTES: { name: string; values: Partial<DesignSettings> }[] = [
  {
    name: "Ink",
    values: {
      primaryColor: "#111827",
      secondaryColor: "#6b7280",
      textColor: "#111827",
      mutedColor: "#6b7280",
      borderColor: "#e5e7eb",
      backgroundColor: "#ffffff",
      tableHeaderBackground: "#111827",
      tableHeaderTextColor: "#ffffff",
    },
  },
  {
    name: "Slate",
    values: {
      primaryColor: "#1f2937",
      secondaryColor: "#64748b",
      textColor: "#0f172a",
      mutedColor: "#64748b",
      borderColor: "#e2e8f0",
      backgroundColor: "#ffffff",
      tableHeaderBackground: "#f1f5f9",
      tableHeaderTextColor: "#0f172a",
    },
  },
  {
    name: "Indigo",
    values: {
      primaryColor: "#312e81",
      secondaryColor: "#6366f1",
      textColor: "#1e1b4b",
      mutedColor: "#6b7280",
      borderColor: "#e0e7ff",
      backgroundColor: "#ffffff",
      tableHeaderBackground: "#312e81",
      tableHeaderTextColor: "#ffffff",
    },
  },
  {
    name: "Emerald",
    values: {
      primaryColor: "#064e3b",
      secondaryColor: "#10b981",
      textColor: "#0f172a",
      mutedColor: "#64748b",
      borderColor: "#d1fae5",
      backgroundColor: "#ffffff",
      tableHeaderBackground: "#064e3b",
      tableHeaderTextColor: "#ffffff",
    },
  },
  {
    name: "Wine",
    values: {
      primaryColor: "#4c1d29",
      secondaryColor: "#9f1239",
      textColor: "#1c1917",
      mutedColor: "#78716c",
      borderColor: "#f1e3e5",
      backgroundColor: "#ffffff",
      tableHeaderBackground: "#4c1d29",
      tableHeaderTextColor: "#ffffff",
    },
  },
  {
    name: "Sand",
    values: {
      primaryColor: "#3f3f46",
      secondaryColor: "#a16207",
      textColor: "#27272a",
      mutedColor: "#78716c",
      borderColor: "#e7e5e4",
      backgroundColor: "#fffdf8",
      tableHeaderBackground: "#f5f5f4",
      tableHeaderTextColor: "#27272a",
    },
  },
];
