import type { DesignSettings } from "./design";
import { normaliseDesign } from "./design";
import { FONT_OPTIONS, PAGE_DIMENSIONS, type PageSize } from "./templates";
import { lighten, normaliseHex, withAlpha } from "./color";

export type RenderSpec = {
  pageSize: PageSize;
  pageWidthMm: number;
  pageHeightMm: number;
  paddingMm: { top: number; right: number; bottom: number; left: number };

  fontStack: string;
  /** Built-in PDF font family (Helvetica / Times-Roman / Courier). */
  pdfFont: string;
  pdfBold: string;
  pdfItalic: string;

  basePt: number;
  tablePt: number;
  titlePt: number;
  headingPt: number;
  mutedPt: number;
  labelPt: number;
  tinyPt: number;

  colors: {
    primary: string;
    secondary: string;
    text: string;
    muted: string;
    border: string;
    background: string;
    tableHeaderBackground: string;
    tableHeaderText: string;
    tableStripe: string;
    totalsPanel: string;
    accentFill: string;
    softFill: string;
  };

  cellPadX: number;
  cellPadY: number;
  radius: number;
  borderWidth: number;
  borderColor: string;
  /** Rule thickness in mm used for section separators. */
  dividerWidthMm: number;
  showBorders: boolean;

  accentStyle: DesignSettings["accentStyle"];
  tableStyle: DesignSettings["tableStyle"];
  divider: DesignSettings["divider"];
  density: DesignSettings["density"];

  logoWidthPt: number;
  logoMaxHeightPt: number;

  /** Estimated usable content width in mm. */
  contentWidthMm: number;
};

const MM_PT = 2.834645669;

export const mmToPt = (mm: number) => mm * MM_PT;
export const ptToMm = (pt: number) => pt / MM_PT;

/**
 * Turns design settings into concrete, printable numbers.
 *
 * Both renderers (HTML preview/print and react-pdf) consume this object, so the
 * two outputs share one layout contract.
 */
export function buildRenderSpec(designInput: DesignSettings | Record<string, unknown>): RenderSpec {
  const design = normaliseDesign(designInput);
  const pageSize: PageSize = design.pageSize === "Letter" ? "Letter" : "A4";
  const dims = PAGE_DIMENSIONS[pageSize];

  const basePt = design.baseFontSize;
  const font = FONT_OPTIONS.find((f) => f.value === design.fontFamily) ?? FONT_OPTIONS[0];

  const compact = design.density === "compact";
  const airy = design.density === "airy";
  const densityFactor = compact ? 0.78 : airy ? 1.28 : 1;

  const scale = compact ? 0.92 : airy ? 1.08 : 1;
  const paddingMm = {
    top: compact ? 12 : airy ? 20 : 15,
    right: compact ? 12 : airy ? 20 : 15,
    bottom: compact ? 12 : airy ? 20 : 15,
    left: compact ? 12 : airy ? 20 : 15,
  };

  const primary = normaliseHex(design.primaryColor, "#111827");
  const secondary = normaliseHex(design.secondaryColor, "#6b7280");
  const text = normaliseHex(design.textColor, "#111827");
  const muted = normaliseHex(design.mutedColor, "#6b7280");
  const border = normaliseHex(design.borderColor, "#e5e7eb");
  const background = normaliseHex(design.backgroundColor, "#ffffff");
  const tableHeaderBackground = normaliseHex(design.tableHeaderBackground, primary);
  const tableHeaderText = normaliseHex(design.tableHeaderTextColor, "#ffffff");

  const dividerWidthMm =
    design.divider === "none"
      ? 0
      : design.divider === "hairline"
        ? 0.2
        : design.divider === "thin"
          ? 0.3
          : design.divider === "soft"
            ? 0.5
            : 0.9;

  return {
    pageSize,
    pageWidthMm: dims.width,
    pageHeightMm: dims.height,
    paddingMm,

    fontStack: font.stack,
    pdfFont: font.pdf,
    pdfBold: font.pdf === "Times-Roman" ? "Times-Bold" : font.pdf === "Courier" ? "Courier-Bold" : "Helvetica-Bold",
    pdfItalic: font.pdf === "Times-Roman" ? "Times-Italic" : font.pdf === "Courier" ? "Courier-Oblique" : "Helvetica-Oblique",

    basePt: round2(basePt),
    tablePt: round2(basePt * (design.tableFontSize / Math.max(basePt, 1)) * scale),
    titlePt: round2(basePt * design.headingScale * 2.05),
    headingPt: round2(basePt * design.headingScale * 1.12),
    mutedPt: round2(basePt * 0.82),
    labelPt: round2(basePt * 0.72),
    tinyPt: round2(basePt * 0.68),

    colors: {
      primary,
      secondary,
      text,
      muted,
      border,
      background,
      tableHeaderBackground,
      tableHeaderText,
      tableStripe: withAlpha(muted, 0.07),
      totalsPanel: withAlpha(secondary, 0.08),
      accentFill: design.accentStyle === "none" ? "transparent" : primary,
      softFill: lighten(background === "#ffffff" ? primary : background, 0.94),
    },

    cellPadX: round2(3.2 * scale),
    cellPadY: round2((compact ? 3.2 : airy ? 8 : 5.2) * densityFactor + design.rowSpacing * 0.25),
    radius: design.borderRadius,
    borderWidth: design.showTableBorders ? dividerWidthMm || 0.25 : 0,
    dividerWidthMm,
    borderColor: border,
    showBorders: design.showTableBorders,

    accentStyle: design.accentStyle,
    tableStyle: design.tableStyle,
    divider: design.divider,
    density: design.density,

    logoWidthPt: round2(mmToPt(design.logoWidth * 0.16)), // design.logoWidth is ~px at 96dpi
    logoMaxHeightPt: round2(mmToPt(design.logoWidth * 0.12)),

    contentWidthMm: round2(dims.width - paddingMm.left - paddingMm.right),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Table column widths as a percentage of the content width. */
export const COLUMN_WIDTHS = {
  item: 46,
  qty: 9,
  price: 13,
  discount: 11,
  tax: 9,
  total: 12,
} as const;
