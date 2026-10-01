import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  info: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: BadgeTone }) {
  const colors: Record<BadgeTone, string> = {
    neutral: "bg-ink-400",
    info: "bg-brand-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    purple: "bg-violet-500",
  };
  return <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", colors[tone])} />;
}
