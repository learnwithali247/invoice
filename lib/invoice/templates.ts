

export const TEMPLATES = [
  {
    slug: "minimal",
    name: "Minimal",
    description: "Whitespace-forward, hairline rules, no fills.",
    accentStyle: "none",
    tableStyle: "borderless",
    density: "regular",
    divider: "thin",
  },
  {
    slug: "modern",
    name: "Modern",
    description: "Accent bar, soft header block, striped rows.",
    accentStyle: "bar",
    tableStyle: "striped",
    density: "regular",
    divider: "soft",
  },
  {
    slug: "corporate",
    name: "Corporate",
    description: "Ruled header block with a formal, printed feel.",
    accentStyle: "block",
    tableStyle: "lined",
    density: "regular",
    divider: "solid",
  },
  {
    slug: "elegant",
    name: "Elegant",
    description: "Serif headings and airy spacing for premium work.",
    accentStyle: "hairline",
    tableStyle: "borderless",
    density: "airy",
    divider: "hairline",
  },
  {
    slug: "compact",
    name: "Compact",
    description: "Tight rows — built for long item lists.",
    accentStyle: "bar",
    tableStyle: "lined",
    density: "compact",
    divider: "thin",
  },
  {
    slug: "bold",
    name: "Bold",
    description: "High-contrast blocks and oversized headings.",
    accentStyle: "block",
    tableStyle: "striped",
    density: "regular",
    divider: "none",
  },
  {
    slug: "professional",
    name: "Professional",
    description: "Balanced everyday default.",
    accentStyle: "bar",
    tableStyle: "lined",
    density: "regular",
    divider: "soft",
  },
] as const;

export type TemplateSlug = (typeof TEMPLATES)[number]["slug"];

export const TEMPLATE_SLUGS = TEMPLATES.map((t) => t.slug) as string[];

export function getTemplate(slug: string) {
  return TEMPLATES.find((t) => t.slug === slug) ?? TEMPLATES[1];
}

export const FONT_OPTIONS = [
  { value: "inter", label: "Inter", stack: "'Inter', 'Segoe UI', system-ui, sans-serif", pdf: "Helvetica" },
  { value: "lato", label: "Lato", stack: "'Lato', 'Segoe UI', system-ui, sans-serif", pdf: "Helvetica" },
  { value: "roboto", label: "Roboto", stack: "'Roboto', 'Segoe UI', system-ui, sans-serif", pdf: "Helvetica" },
  { value: "opensans", label: "Open Sans", stack: "'Open Sans', 'Segoe UI', system-ui, sans-serif", pdf: "Helvetica" },
  { value: "montserrat", label: "Montserrat", stack: "'Montserrat', 'Segoe UI', system-ui, sans-serif", pdf: "Helvetica" },
  { value: "source", label: "Source Sans", stack: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif", pdf: "Helvetica" },
  { value: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif", pdf: "Times-Roman" },
  { value: "playfair", label: "Playfair", stack: "'Playfair Display', Georgia, serif", pdf: "Times-Roman" },
  { value: "mono", label: "Mono", stack: "'JetBrains Mono', 'Consolas', monospace", pdf: "Courier" },
] as const;

export const PAGE_SIZES = ["A4", "Letter"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: "A4" },
  Letter: { width: 215.9, height: 279.4, label: "US Letter" },
};
