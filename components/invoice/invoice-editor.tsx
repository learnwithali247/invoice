"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CloudOff,
  Download,
  Eye,
  Loader2,
  Palette,
  Printer,
  Save,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { InvoicePreview } from "@/components/invoice/invoice-preview";
import { ShareDialog } from "@/components/invoice/share-dialog";
import { SendDialog } from "@/components/invoice/send-dialog";
import { GeneralPanel } from "@/components/invoice/panels/general-panel";
import { CustomerPanel } from "@/components/invoice/panels/customer-panel";
import { ItemsPanel } from "@/components/invoice/panels/items-panel";
import { PaymentPanel, type PaymentAvailability } from "@/components/invoice/panels/payment-panel";
import { DesignPanel } from "@/components/invoice/panels/design-panel";
import { NotesPanel } from "@/components/invoice/panels/notes-panel";
import { LogoUpload } from "@/components/invoice/logo-upload";
import { calculateTotals, formatMoney } from "@/lib/invoice/calculate";
import { getCurrency } from "@/lib/invoice/currencies";
import { toRenderModel } from "@/lib/invoice/mappers";
import { toSavePayload } from "@/lib/invoice/payload";
import { DEFAULT_DESIGN } from "@/lib/invoice/design";
import type { BusinessInfo, InvoiceDraft } from "@/lib/invoice/types";
import type { InvoiceRow } from "@/types/database";
import { absoluteUrl, cn, safeErrorMessage } from "@/lib/utils";

type Tab = "general" | "customer" | "items" | "payment" | "design" | "notes";
type SaveState = "idle" | "saving" | "saved" | "error";

const TABS: { value: Tab; label: string }[] = [
  { value: "general", label: "General" },
  { value: "customer", label: "Customer" },
  { value: "items", label: "Items" },
  { value: "payment", label: "Payment" },
  { value: "design", label: "Design" },
  { value: "notes", label: "Notes" },
];

const AUTOSAVE_MS = 900;

export function InvoiceEditor({
  initialDraft,
  business,
  paymentAvailability,
  serverUpdatedAt,
  isNew,
}: {
  initialDraft: InvoiceDraft;
  business: BusinessInfo;
  paymentAvailability: PaymentAvailability;
  serverUpdatedAt: string | null;
  isNew: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = React.useState<InvoiceDraft>(initialDraft);
  const [businessInfo, setBusinessInfo] = React.useState<BusinessInfo>(business);
  const [tab, setTab] = React.useState<Tab>("general");
  const [mobilePane, setMobilePane] = React.useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [restorable, setRestorable] = React.useState<InvoiceDraft | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [downloadBusy, setDownloadBusy] = React.useState(false);

  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  const savingRef = React.useRef(false);
  const retriesRef = React.useRef(0);

  const storageKey = `invoice-draft:${initialDraft.id ?? "new"}`;
  const initialRef = React.useRef(initialDraft);

  /* ------------------------------------------------------------------ */
  /* local draft recovery                                                */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { draft: InvoiceDraft; savedAt: number };
      if (!parsed?.draft) return;
      const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
      if (parsed.savedAt <= serverTime) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      if (JSON.stringify(parsed.draft) === JSON.stringify(initialRef.current)) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      setRestorable(parsed.draft);
    } catch {
      /* ignore malformed drafts */
    }
  }, [storageKey, serverUpdatedAt]);

  /* ------------------------------------------------------------------ */
  /* local draft write (cheap, throttled)                                */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ draft: draftRef.current, savedAt: Date.now() }),
        );
      } catch {
        /* storage full or blocked — the server copy is still authoritative */
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, dirty, storageKey]);

  /* ------------------------------------------------------------------ */
  /* autosave                                                            */
  /* ------------------------------------------------------------------ */
  const persist = React.useCallback(
    async (options: { manual?: boolean } = {}) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaveState("saving");
      setSaveError(null);

      const payload = toSavePayload(draftRef.current);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      try {
        const response = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error?.message ?? "Save failed.");

        const data = json?.data as
          | { minimal: true; reassigned?: { localId: string; serverId: string }[] }
          | { invoice: InvoiceRow; items: Array<{ id: string }> };
        const minimal = Boolean((data as { minimal?: boolean })?.minimal);

        // The server may have had to mint an id for an item whose local id was
        // not a UUID. Adopt those so the next autosave upserts the same rows
        // instead of inserting duplicates.
        const remap = new Map(
          ((data as { reassigned?: { localId: string; serverId: string }[] }).reassigned ?? []).map(
            (entry) => [entry.localId, entry.serverId],
          ),
        );
        if (remap.size) {
          setDraft((current) => {
            const next = {
              ...current,
              items: current.items.map((item) => ({
                ...item,
                id: remap.get(item.id) ?? item.id,
              })),
            };
            draftRef.current = next;
            return next;
          });
        }

        // A first save returns the persisted invoice; a later autosave returns a
        // minimal acknowledgement because the browser already has everything.
        const saved = minimal ? null : (data as { invoice: InvoiceRow; items: Array<{ id: string }> });

        if (minimal || !saved) {
          setDirty(false);
          setSaveState("saved");
          retriesRef.current = 0;
          try {
            window.localStorage.removeItem(storageKey);
          } catch {
            /* ignore */
          }
          if (options.manual) toast.success("Invoice saved");
          return;
        }

        const idMap = new Map<string, string>();
        saved.items.forEach((item, index) => {
          const local = draftRef.current.items[index];
          if (local && item?.id) idMap.set(local.id, item.id);
        });

        setDraft((current) => {
          const next: InvoiceDraft = {
            ...current,
            id: saved.invoice.id,
            publicToken: saved.invoice.public_token,
            invoiceNumber: saved.invoice.invoice_number,
            paymentStatus: saved.invoice.payment_status as InvoiceDraft["paymentStatus"],
            status: saved.invoice.status as InvoiceDraft["status"],
            items: current.items.map((item) => ({
              ...item,
              id: idMap.get(item.id) ?? item.id,
            })),
          };
          draftRef.current = next;
          return next;
        });

        setDirty(false);
        setSaveState("saved");
        retriesRef.current = 0;
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }

        if (isNew) {
          // update the URL without a navigation so the editor is not remounted
          window.history.replaceState(null, "", `/invoices/${saved.invoice.id}`);
        }
        if (options.manual) toast.success("Invoice saved");
      } catch (error) {

        clearTimeout(timeout);
        const message =
          (error as Error).name === "AbortError"
            ? "The save timed out."
            : safeErrorMessage(error, "Could not save the invoice.");
        setSaveState("error");
        setSaveError(message);
        retriesRef.current += 1;
        if (options.manual) toast.error("Could not save", message);
      } finally {
        savingRef.current = false;
      }
    },
    [isNew, storageKey, toast],
  );

  React.useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, dirty, persist]);

  // retry after a transient failure
  React.useEffect(() => {
    if (saveState !== "error") return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) void persist();
    }, Math.min(15_000, 2_500 * retriesRef.current));
    return () => clearTimeout(timer);
  }, [saveState, persist]);

  /* ------------------------------------------------------------------ */
  /* keyboard shortcut                                                   */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void persist({ manual: true });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist]);

  /* ------------------------------------------------------------------ */
  /* derived                                                             */
  /* ------------------------------------------------------------------ */
  const totals = React.useMemo(
    () =>
      calculateTotals({
        items: draft.items,
        discountType: draft.discountType,
        discountValue: draft.discountValue,
        shipping: draft.shipping,
        fees: draft.fees,
        adjustment: draft.adjustment,
        amountPaid: draft.amountPaid,
      }),
    [
      draft.items,
      draft.discountType,
      draft.discountValue,
      draft.shipping,
      draft.fees,
      draft.adjustment,
      draft.amountPaid,
    ],
  );

  const model = React.useMemo(() => toRenderModel(draft, businessInfo), [draft, businessInfo]);
  const currency = getCurrency(draft.currency);

  const patch = React.useCallback((changes: Partial<InvoiceDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...changes };
      draftRef.current = next;
      return next;
    });
    setDirty(true);
    setSaveState("idle");
  }, []);

  const patchCustomer = React.useCallback(
    (changes: Partial<InvoiceDraft["customer"]>) => {
      patch({ customer: { ...draftRef.current.customer, ...changes } });
    },
    [patch],
  );

  const patchDesign = React.useCallback(
    (changes: Partial<InvoiceDraft["design"]>) => {
      patch({ design: { ...draftRef.current.design, ...changes } });
    },
    [patch],
  );

  async function downloadPdf() {
    if (downloadBusy) return;
    setDownloadBusy(true);
    try {
      await persist();
      const id = draftRef.current.id;
      if (!id) throw new Error("Save the invoice first.");
      const response = await fetch(`/api/invoices/${id}/pdf`, { method: "POST" });
      if (!response.ok) throw new Error("PDF generation failed.");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const name = /filename="(.+?)"/.exec(disposition)?.[1] ?? `${draftRef.current.invoiceNumber}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("PDF downloaded");
    } catch (error) {
      toast.error("Could not generate the PDF", safeErrorMessage(error));
    } finally {
      setDownloadBusy(false);
    }
  }

  const statusBar = (
    <SaveIndicator state={saveState} error={saveError} />
  );

  const publicPath = draft.publicToken
    ? absoluteUrl(`/pay/invoice/${draft.publicToken}`)
    : null;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur print-hidden">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (dirty) void persist();
                router.push("/dashboard");
              }}
            >
              ← Dashboard
            </Button>
            <span aria-hidden className="text-ink-300">
              /
            </span>
            <input
              value={draft.invoiceNumber}
              onChange={(e) => patch({ invoiceNumber: e.target.value })}
              aria-label="Invoice number"
              className="min-w-0 max-w-44 rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-sm font-semibold text-ink-900 hover:border-ink-300 focus:border-ink-400 focus:outline-none"
            />
            {draft.invoiceType !== "standard" ? (
              <Badge tone="info" className="hidden sm:inline-flex">
                {draft.invoiceType}
              </Badge>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {statusBar}

            <Button
              size="sm"
              variant="outline"
              onClick={() => void persist({ manual: true })}
              loading={saveState === "saving"}
              loadingText="Saving…"
            >
              {!saveState || saveState === "saving" ? <Save className="h-3.5 w-3.5" aria-hidden /> : null}
              Save
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void persist();
                if (draftRef.current.id)
                  window.open(`/invoices/${draftRef.current.id}/print`, "_blank", "noopener");
              }}
              title="Print invoice"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Print</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={downloadPdf}
              loading={downloadBusy}
              loadingText="Generating PDF…"
            >
              {!downloadBusy ? <Download className="h-3.5 w-3.5" aria-hidden /> : null}
              <span className="hidden sm:inline">Download PDF</span>
            </Button>

            <Button size="sm" variant="outline" onClick={() => setShareOpen(true)} title="Share">
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Share</span>
            </Button>

            <Button size="sm" variant="secondary" onClick={() => setSendOpen(true)} title="Send by email">
              <Send className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden md:inline">Send</span>
            </Button>
          </div>
        </div>

        {/* mobile pane switch */}
        <div className="flex border-t border-ink-200 lg:hidden">
          {(["edit", "preview"] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              onClick={() => setMobilePane(pane)}
              aria-pressed={mobilePane === pane}
              className={cn(
                "flex-1 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                mobilePane === pane
                  ? "border-ink-900 text-ink-900"
                  : "border-transparent text-ink-500",
              )}
            >
              {pane === "edit" ? "Editor" : "Preview"}
            </button>
          ))}
        </div>
      </header>

      {/* body */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-0 px-0 lg:gap-6 lg:px-6 lg:py-5">
        {/* editor */}
        <div
          className={cn(
            "min-w-0 flex-1 lg:max-w-[min(46%,680px)]",
            mobilePane === "edit" ? "block" : "hidden lg:block",
          )}
        >
          <div className="border-b border-ink-200 bg-white px-4 sm:px-6">
            <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="Invoice sections" />
          </div>

          <div className="space-y-6 px-4 py-5 sm:px-6">
            {tab === "general" ? (
              <>
                <LogoUpload
                  logoUrl={businessInfo.logoUrl}
                  businessName={businessInfo.businessName}
                  onUploaded={(url) => setBusinessInfo((current) => ({ ...current, logoUrl: url }))}
                  onRemoved={() => setBusinessInfo((current) => ({ ...current, logoUrl: null }))}
                />
                <div className="rounded-lg border border-ink-200 p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-500 uppercase">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Business details
                  </p>
                  <BusinessSummary business={businessInfo} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push("/settings")}
                    className="mt-2"
                  >
                    Edit business details in Settings →
                  </Button>
                </div>

                <GeneralPanel
                  draft={draft}
                  update={patch}
                  totals={totals}
                  onReserveNumber={() => patch({ invoiceNumber: "" })}
                />
              </>
            ) : null}

            {tab === "customer" ? (
              <CustomerPanel
                draft={draft}
                onCustomerChange={patchCustomer}
                onSaved={() => undefined}
              />
            ) : null}

            {tab === "items" ? (
              <ItemsPanel
                items={draft.items}
                currency={draft.currency}
                onChange={(items) => patch({ items })}
              />
            ) : null}

            {tab === "payment" ? (
              <PaymentPanel
                draft={draft}
                availability={paymentAvailability}
                update={patch}
                amountDue={formatMoney(totals.amountDue, currency.symbol, currency.decimals)}
                publicPath={publicPath}
              />
            ) : null}

            {tab === "design" ? (
              <DesignPanel
                design={draft.design}
                update={patchDesign}
                onReset={() =>
                  patchDesign({
                    ...DEFAULT_DESIGN,
                    template: draft.template,
                    primaryColor: draft.design.primaryColor,
                  })
                }
              />
            ) : null}

            {tab === "notes" ? <NotesPanel draft={draft} update={patch} /> : null}
          </div>
        </div>

        {/* preview */}
        <div
          className={cn(
            "min-w-0 flex-1 bg-ink-100/70 px-3 py-5 sm:px-4",
            mobilePane === "preview" ? "block" : "hidden lg:block",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Live preview
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xs text-ink-400">
                {draft.design.pageSize} · {model.design.template}
              </span>
              <button
                type="button"
                onClick={() => setTab("design")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                <Palette className="h-3 w-3" aria-hidden />
                Customise
              </button>
            </div>
          </div>
          <InvoicePreview model={model} />
          <p className="mt-3 text-center text-2xs text-ink-400">
            The preview is scaled to fit. Print and PDF use the real {draft.design.pageSize} page size.
          </p>
        </div>
      </div>

      {/* dialogs */}
      <Dialog
        open={Boolean(restorable)}
        onClose={() => setRestorable(null)}
        title="We found an unsaved invoice"
        description="Your browser has a newer version of this invoice than the one saved on the server."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  window.localStorage.removeItem(storageKey);
                } catch {
                  /* ignore */
                }
                setRestorable(null);
              }}
            >
              Discard
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (restorable) {
                  draftRef.current = restorable;
                  setDraft(restorable);
                  setDirty(true);
                }
                setRestorable(null);
              }}
            >
              Restore draft
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-600">
          Restoring replaces what is currently on screen. The saved version stays untouched until you
          save again.
        </p>
      </Dialog>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        invoice={{
          id: draft.id ?? "",
          invoiceNumber: draft.invoiceNumber,
          paymentEnabled: draft.paymentEnabled,
          customerName: draft.customer.name,
        }}
      />

      <SendDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        invoice={{ id: draft.id ?? "", invoiceNumber: draft.invoiceNumber }}
        defaultEmail={draft.customer.email}
      />
    </div>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-500" aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-emerald-600" aria-live="polite">
        <Check className="h-3 w-3" aria-hidden />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-red-600" role="status">
        <AlertCircle className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">{error ?? "Unable to save"}</span>
        <span className="sm:hidden">Retrying…</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-ink-400" aria-live="polite">
      <CloudOff className="hidden h-3 w-3 sm:block" aria-hidden />
      Autosave on
    </span>
  );
}

function BusinessSummary({ business }: { business: BusinessInfo }) {
  const lines = [
    business.businessName,
    [business.addressLine1, business.city, business.country].filter(Boolean).join(", "),
    [business.email, business.phone].filter(Boolean).join(" · "),
    business.taxId ? `Tax ID: ${business.taxId}` : "",
  ].filter(Boolean);

  return (
    <dl className="space-y-1 text-xs">
      {lines.map((line, index) => (
        <div key={index} className="flex gap-2">
          <dt className="sr-only">Detail {index + 1}</dt>
          <dd className={index === 0 ? "font-medium text-ink-900" : "text-ink-500"}>{line}</dd>
        </div>
      ))}
    </dl>
  );
}

