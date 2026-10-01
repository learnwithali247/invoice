/** Small hex/rgba helpers used by the renderer and the PDF engine. */

export function normaliseHex(input: string | null | undefined, fallback = "#000000"): string {
  if (typeof input !== "string") return fallback;
  let hex = input.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  return `#${hex.toLowerCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normaliseHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/** `rgba()` string from a hex colour + 0..1 alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/** Mix two hex colours. `amount` 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.min(1, Math.max(0, amount));
  const to = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[to(ca.r, cb.r), to(ca.g, cb.g), to(ca.b, cb.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function lighten(hex: string, amount = 0.5): string {
  return mix(hex, "#ffffff", amount);
}

export function darken(hex: string, amount = 0.5): string {
  return mix(hex, "#000000", amount);
}

/** Relative luminance contrast ratio (WCAG). Used to pick readable text on fills. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const { r, g, b: bl } = hexToRgb(hex);
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Number.isFinite(ratio) ? ratio : 1;
}

/** Pick whichever of black/white reads better on `background`. */
export function readableOn(background: string): string {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#111111")
    ? "#ffffff"
    : "#111111";
}
