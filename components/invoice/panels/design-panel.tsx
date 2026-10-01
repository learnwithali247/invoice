"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorInput, Field, Select, Toggle } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { PALETTES, type DesignSettings } from "@/lib/invoice/design";
import { FONT_OPTIONS, PAGE_SIZES, TEMPLATES } from "@/lib/invoice/templates";
import { cn } from "@/lib/utils";

type Patch = Partial<DesignSettings>;

export function DesignPanel({
  design,
  update,
  onReset,
}: {
  design: DesignSettings;
  update: (patch: Patch) => void;
  onReset: () => void;
}) {
  const [section, setSection] = React.useState<"template" | "colors" | "type" | "layout" | "visibility">(
    "template",
  );

  return (
    <div className="space-y-5">
      <SegmentedControl<typeof section>
        ariaLabel="Design section"
        value={section}
        onChange={setSection}
        className="w-full justify-between overflow-x-auto"
        options={[
          { value: "template", label: "Template" },
          { value: "colors", label: "Colors" },
          { value: "type", label: "Type" },
          { value: "layout", label: "Layout" },
          { value: "visibility", label: "Show / hide" },
        ]}
      />

      {section === "template" ? (
        <section className="space-y-3">
          <p className="text-2xs leading-relaxed text-ink-500">
            Switching templates only changes the presentation — no invoice data is lost.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((template) => {
              const active = design.template === template.slug;
              return (
                <button
                  key={template.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    update({
                      template: template.slug,
                      accentStyle: template.accentStyle as DesignSettings["accentStyle"],
                      tableStyle: template.tableStyle as DesignSettings["tableStyle"],
                      density: template.density as DesignSettings["density"],
                      divider: template.divider as DesignSettings["divider"],
                    })
                  }
                  className={cn(
                    "overflow-hidden rounded-lg border text-left transition-colors",
                    active
                      ? "border-ink-900 ring-1 ring-ink-900"
                      : "border-ink-200 hover:border-ink-400",
                  )}
                >
                  <TemplatePreview slug={template.slug} primary={design.primaryColor} />
                  <span className="block px-3 py-2">
                    <span className="block text-sm font-medium text-ink-900">{template.name}</span>
                    <span className="mt-0.5 block text-2xs leading-snug text-ink-500">
                      {template.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {section === "colors" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-medium text-ink-500">Palette:</span>
            {PALETTES.map((palette) => (
              <button
                key={palette.name}
                type="button"
                onClick={() => update(palette.values as Patch)}
                className="rounded-full border border-ink-300 px-2 py-0.5 text-2xs font-medium text-ink-600 transition-colors hover:bg-ink-100"
              >
                {palette.name}
              </button>
            ))}
          </div>

          <ColorField label="Primary color" value={design.primaryColor} onChange={(v) => update({ primaryColor: v, tableHeaderBackground: v })} />
          <ColorField label="Secondary color" value={design.secondaryColor} onChange={(v) => update({ secondaryColor: v })} />
          <ColorField label="Text color" value={design.textColor} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Muted text" value={design.mutedColor} onChange={(v) => update({ mutedColor: v })} />
          <ColorField label="Border color" value={design.borderColor} onChange={(v) => update({ borderColor: v })} />
          <ColorField label="Page background" value={design.backgroundColor} onChange={(v) => update({ backgroundColor: v })} />
          <ColorField
            label="Table header background"
            value={design.tableHeaderBackground}
            onChange={(v) => update({ tableHeaderBackground: v })}
          />
          <ColorField
            label="Table header text"
            value={design.tableHeaderTextColor}
            onChange={(v) => update({ tableHeaderTextColor: v })}
          />
        </section>
      ) : null}

      {section === "type" ? (
        <section className="space-y-4">
          <Field label="Font family" htmlFor="fontFamily">
            <Select
              id="fontFamily"
              value={design.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </Select>
          </Field>

          <Slider
            label="Base font size"
            value={design.baseFontSize}
            min={7}
            max={14}
            step={0.5}
            suffix="pt"
            onChange={(v) => update({ baseFontSize: v })}
          />
          <Slider
            label="Heading scale"
            value={design.headingScale}
            min={1}
            max={2.6}
            step={0.05}
            onChange={(v) => update({ headingScale: v })}
          />
          <Slider
            label="Table font size"
            value={design.tableFontSize}
            min={6}
            max={14}
            step={0.5}
            suffix="pt"
            onChange={(v) => update({ tableFontSize: v })}
          />
        </section>
      ) : null}

      {section === "layout" ? (
        <section className="space-y-4">
          <Field label="Header alignment" htmlFor="headerAlignment">
            <SegmentedControl<DesignSettings["headerAlignment"]>
              ariaLabel="Header alignment"
              value={design.headerAlignment}
              onChange={(v) => update({ headerAlignment: v })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>

          <Field label="Logo position" htmlFor="logoPosition">
            <SegmentedControl<DesignSettings["logoPosition"]>
              ariaLabel="Logo position"
              value={design.logoPosition}
              onChange={(v) => update({ logoPosition: v })}
              options={[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
                { value: "hidden", label: "Hidden" },
              ]}
            />
          </Field>

          <Field label="Invoice title position" htmlFor="titlePosition">
            <SegmentedControl<DesignSettings["titlePosition"]>
              ariaLabel="Title position"
              value={design.titlePosition}
              onChange={(v) => update({ titlePosition: v })}
              options={[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>

          <Field label="Accent style" htmlFor="accentStyle">
            <Select
              id="accentStyle"
              value={design.accentStyle}
              onChange={(e) => update({ accentStyle: e.target.value as DesignSettings["accentStyle"] })}
            >
              <option value="none">None</option>
              <option value="bar">Bar</option>
              <option value="block">Block</option>
              <option value="hairline">Hairline</option>
            </Select>
          </Field>

          <Field label="Table style" htmlFor="tableStyle">
            <Select
              id="tableStyle"
              value={design.tableStyle}
              onChange={(e) => update({ tableStyle: e.target.value as DesignSettings["tableStyle"] })}
            >
              <option value="lined">Lined</option>
              <option value="striped">Striped</option>
              <option value="borderless">Borderless</option>
            </Select>
          </Field>

          <Field label="Row density" htmlFor="density">
            <SegmentedControl<DesignSettings["density"]>
              ariaLabel="Row density"
              value={design.density}
              onChange={(v) => update({ density: v })}
              options={[
                { value: "compact", label: "Compact" },
                { value: "regular", label: "Regular" },
                { value: "airy", label: "Airy" },
              ]}
            />
          </Field>

          <Field label="Dividers" htmlFor="divider">
            <Select
              id="divider"
              value={design.divider}
              onChange={(e) => update({ divider: e.target.value as DesignSettings["divider"] })}
            >
              <option value="none">None</option>
              <option value="hairline">Hairline</option>
              <option value="thin">Thin</option>
              <option value="soft">Soft</option>
              <option value="solid">Solid</option>
            </Select>
          </Field>

          <Slider
            label="Corner radius"
            value={design.borderRadius}
            min={0}
            max={16}
            step={1}
            suffix="px"
            onChange={(v) => update({ borderRadius: v })}
          />
          <Slider
            label="Row spacing"
            value={design.rowSpacing}
            min={0}
            max={16}
            step={1}
            suffix="pt"
            onChange={(v) => update({ rowSpacing: v })}
          />
          <Slider
            label="Logo width"
            value={design.logoWidth}
            min={40}
            max={180}
            step={2}
            suffix="px"
            onChange={(v) => update({ logoWidth: v })}
          />

          <Toggle
            checked={design.showTableBorders}
            onChange={(v) => update({ showTableBorders: v })}
            label="Table borders"
            description="Turn off for a borderless table."
          />

          <Field label="Page size" htmlFor="pageSize" hint="Applies to print and PDF export.">
            <SegmentedControl<DesignSettings["pageSize"]>
              ariaLabel="Page size"
              value={design.pageSize}
              onChange={(v) => update({ pageSize: v })}
              options={PAGE_SIZES.map((size) => ({ value: size, label: size }))}
            />
          </Field>
        </section>
      ) : null}

      {section === "visibility" ? (
        <section className="space-y-1">
          <VisibilityToggle design={design} update={update} field="showCustomerEmail" label="Customer email" />
          <VisibilityToggle design={design} update={update} field="showCustomerPhone" label="Customer phone" />
          <VisibilityToggle design={design} update={update} field="showTaxId" label="Tax IDs (business & customer)" />
          <VisibilityToggle design={design} update={update} field="showShippingAddress" label="Shipping address" />
          <VisibilityToggle design={design} update={update} field="showPaymentTerms" label="Payment terms" />
          <VisibilityToggle design={design} update={update} field="showDueDate" label="Due date" />
          <VisibilityToggle design={design} update={update} field="showItemDescriptions" label="Item descriptions" />
          <VisibilityToggle design={design} update={update} field="showDiscount" label="Discount" />
          <VisibilityToggle design={design} update={update} field="showTax" label="Tax" />
          <VisibilityToggle design={design} update={update} field="showShipping" label="Shipping" />
          <VisibilityToggle design={design} update={update} field="showFees" label="Fees" />
          <VisibilityToggle design={design} update={update} field="showAdjustment" label="Adjustment" />
          <VisibilityToggle design={design} update={update} field="showAmountPaid" label="Amount paid / due" />
          <VisibilityToggle design={design} update={update} field="showNotes" label="Notes & terms" />
          <VisibilityToggle design={design} update={update} field="showFooter" label="Footer" />
          <VisibilityToggle design={design} update={update} field="showPaymentButton" label="Pay now button" />
          <VisibilityToggle design={design} update={update} field="showPageNumbers" label="Page numbers" />

          <div className="pt-4">
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset design to template defaults
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function VisibilityToggle({
  design,
  update,
  field,
  label,
}: {
  design: DesignSettings;
  update: (patch: Patch) => void;
  field: keyof DesignSettings;
  label: string;
}) {
  return (
    <Toggle
      checked={Boolean(design[field] as boolean)}
      onChange={(v) => update({ [field]: v } as Patch)}
      label={label}
    />
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <Field label={label} htmlFor={id}>
      <ColorInput id={id} value={value} onChange={onChange} />
    </Field>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-ink-700">
          {label}
        </label>
        <span className="text-2xs tabular-nums text-ink-500">
          {value}
          {suffix ? ` ${suffix}` : "×"}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600"
      />
    </div>
  );
}

function TemplatePreview({ slug, primary }: { slug: string; primary: string }) {
  const styles: Record<string, { header: string; rows: string[]; accent: string }> = {
    minimal: { header: "h-4 w-10 rounded-sm", rows: ["h-1.5", "h-1.5", "h-1.5"], accent: "bg-transparent" },
    modern: { header: "h-5 w-12 rounded", rows: ["h-2", "h-1.5", "h-2"], accent: "bg-ink-900" },
    corporate: { header: "h-6 w-full rounded-sm", rows: ["h-1.5", "h-1.5", "h-1.5"], accent: "bg-ink-800" },
    elegant: { header: "h-3 w-14 rounded-full", rows: ["h-px", "h-px", "h-px"], accent: "bg-ink-400" },
    compact: { header: "h-4 w-10 rounded-sm", rows: ["h-1", "h-1", "h-1"], accent: "bg-ink-700" },
    bold: { header: "h-8 w-full rounded", rows: ["h-2.5", "h-2.5", "h-2.5"], accent: "bg-ink-900" },
    professional: { header: "h-5 w-12 rounded-sm", rows: ["h-1.5", "h-1.5", "h-1.5"], accent: "bg-ink-900" },
  };
  const style = styles[slug] ?? styles.modern;

  return (
    <div className="flex h-16 flex-col gap-1.5 bg-white p-2.5">
      <div className={cn("h-1 w-full rounded", style.accent)} style={{ backgroundColor: slug === "minimal" || slug === "elegant" ? primary : primary, opacity: slug === "elegant" ? 0.4 : 1 }} />
      <div className="flex items-center gap-2">
        <div className={cn(style.header, "bg-ink-800")} />
        <div className="ml-auto h-2 w-8 rounded-sm bg-ink-200" />
      </div>
      <div className="mt-auto space-y-1">
        {style.rows.map((row, i) => (
          <div key={i} className={cn(row, "w-full rounded-sm bg-ink-100")} />
        ))}
      </div>
    </div>
  );
}
