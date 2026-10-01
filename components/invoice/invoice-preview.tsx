"use client";

import * as React from "react";
import type { RenderModel } from "@/lib/invoice/types";
import { InvoiceDocument } from "./invoice-document";

const CSS_PX_PER_MM = 96 / 25.4;

/**
 * Live preview. The document is always authored at its true physical size
 * (mm) and then scaled to fit the available width, so what you see is exactly
 * what prints and what the PDF reproduces.
 */
export function InvoicePreview({
  model,
  className,
  interactive = true,
}: {
  model: RenderModel;
  className?: string;
  interactive?: boolean;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState<number | null>(null);
  const [zoom, setZoom] = React.useState(1);

  React.useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const update = () => {
      const available = node.clientWidth;
      if (available <= 0) return;
      setScale(available / (210 * CSS_PX_PER_MM));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const widthMm = model.design.pageSize === "Letter" ? 215.9 : 210;
  const nativeWidth = widthMm * CSS_PX_PER_MM;
  const effective = (scale ?? 0.5) * zoom;

  return (
    <div ref={frameRef} className={className}>
      <div
        className="mx-auto"
        style={{
          width: nativeWidth * effective,
          height: "auto",
          overflow: "hidden",
        }}
      >
        <div
          className="invoice-sheet origin-top-left bg-white"
          style={{
            width: nativeWidth,
            transform: `scale(${effective})`,
            transformOrigin: "top left",
          }}
        >
          <InvoiceDocument model={model} showPayButton={interactive} />
        </div>
      </div>

      {zoom !== 1 ? (
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="mt-3 w-full rounded-md border border-ink-300 bg-white py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50"
        >
          Reset zoom to fit
        </button>
      ) : null}
    </div>
  );
}
