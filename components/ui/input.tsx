import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-ink-300 bg-white text-sm text-ink-900 shadow-subtle transition-colors placeholder:text-ink-400 hover:border-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-9 px-3", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, "resize-y px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(fieldBase, "h-9 cursor-pointer appearance-none pr-8 pl-3", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-ink-400"
      >
        <path
          d="M6 8l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("block text-xs font-medium text-ink-700", className)} {...props}>
      {children}
      {required ? (
        <span aria-hidden className="ml-0.5 text-red-600">
          *
        </span>
      ) : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
  action,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <Label htmlFor={htmlFor} required={required}>
              {label}
            </Label>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
      {hint && !error ? <p className="text-2xs leading-snug text-ink-500">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-2xs font-medium leading-snug text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const generated = React.useId();
  const inputId = id ?? generated;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <label htmlFor={inputId} className="block cursor-pointer text-sm font-medium text-ink-800">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs leading-snug text-ink-500">{description}</p>
        ) : null}
      </div>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-brand-600" : "bg-ink-300 hover:bg-ink-400",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded border-ink-300 text-brand-600 accent-brand-600",
        className,
      )}
      {...props}
    />
  );
}

export function ColorInput({
  id,
  value,
  onChange,
  swatches,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  swatches?: string[];
}) {
  const palette = swatches ?? [
    "#111827",
    "#ffffff",
    "#f9fafb",
    "#e5e7eb",
    "#9ca3af",
    "#6b7280",
    "#1f2937",
    "#312e81",
    "#1d4ed8",
    "#0f766e",
    "#b91c1c",
    "#a16207",
  ];
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-9 w-11 shrink-0 overflow-hidden rounded-md border border-ink-300">
        <input
          id={id}
          type="color"
          value={normaliseHex(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Colour picker"
          className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0"
        />
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="font-mono text-xs uppercase"
        aria-label="Colour hex value"
      />
      <div className="hidden flex-wrap gap-1 lg:flex">
        {palette.slice(0, 6).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Use colour ${c}`}
            className="h-4 w-4 rounded border border-ink-300"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function normaliseHex(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}
