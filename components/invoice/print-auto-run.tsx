"use client";

import * as React from "react";

/**
 * Sets the real @page size from the invoice's design and opens the browser
 * print dialog once the document is laid out. Guarantees the printed output
 * matches the preview's page geometry exactly.
 */
export function PrintAutoRun({ pageSize }: { pageSize: "A4" | "Letter" }) {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@page { size: ${pageSize}; margin: 0; } @media print { html, body { width: auto; } }`;
    document.head.appendChild(style);

    const timer = setTimeout(() => {
      window.focus();
      window.print();
    }, 350);

    return () => {
      clearTimeout(timer);
      style.remove();
    };
  }, [pageSize]);

  return (
    <div className="no-print border-b border-ink-200 bg-ink-50 px-4 py-2 text-center text-xs text-ink-600">
      Printing at {pageSize} — cancel the dialog to return.
    </div>
  );
}
