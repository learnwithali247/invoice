"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  LogOut,
  Palette,
  Receipt,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea, Toggle, ColorInput } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { LogoUpload } from "@/components/invoice/logo-upload";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES } from "@/lib/invoice/currencies";
import { DEFAULT_DESIGN, PALETTES, type DesignSettings } from "@/lib/invoice/design";
import { FONT_OPTIONS, TEMPLATES } from "@/lib/invoice/templates";
import { createClient } from "@/lib/supabase/client";
import { safeErrorMessage } from "@/lib/utils";
import type { BusinessSettingsRow } from "@/types/database";

type Tab = "business" | "invoice" | "design" | "payments" | "account";

type Form = {
  businessName: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId: string;
  registrationNumber: string;
  additionalInfo: string;
  defaultCurrency: string;
  defaultTemplate: string;
  invoicePrefix: string;
  nextInvoiceNumber: string;
  numberPadding: string;
  defaultPaymentTerms: string;
  defaultNotes: string;
  defaultTerms: string;
  defaultDesign: DesignSettings;
  defaultPaymentEnabled: boolean;
  defaultPaymentProvider: string;
};

export type PaymentInfo = {
  mode: "test" | "live" | "disabled";
  appUrl: string;
  providers: { name: string; label: string; configured: boolean; isTest: boolean }[];
  email: { provider: string; real: boolean };
  webhookUrls: string[];
};

function toForm(row: BusinessSettingsRow | null): Form {
  const design =
    row?.default_design && typeof row.default_design === "object"
      ? ({ ...DEFAULT_DESIGN, ...(row.default_design as object) } as DesignSettings)
      : { ...DEFAULT_DESIGN };

  return {
    businessName: row?.business_name ?? "",
    email: row?.email ?? "",
    phone: row?.phone ?? "",
    website: row?.website ?? "",
    addressLine1: row?.address_line1 ?? "",
    addressLine2: row?.address_line2 ?? "",
    city: row?.city ?? "",
    state: row?.state ?? "",
    postalCode: row?.postal_code ?? "",
    country: row?.country ?? "",
    taxId: row?.tax_id ?? "",
    registrationNumber: row?.registration_number ?? "",
    additionalInfo: row?.additional_info ?? "",
    defaultCurrency: row?.default_currency ?? "USD",
    defaultTemplate: row?.default_template ?? "modern",
    invoicePrefix: row?.invoice_prefix ?? "INV-",
    nextInvoiceNumber: String(row?.next_invoice_number ?? 1),
    numberPadding: String(row?.number_padding ?? 6),
    defaultPaymentTerms: row?.default_payment_terms ?? "Payment due within 14 days.",
    defaultNotes: row?.default_notes ?? "Thank you for your business.",
    defaultTerms: row?.default_terms ?? "",
    defaultDesign: design,
    defaultPaymentEnabled: row?.default_payment_enabled ?? false,
    defaultPaymentProvider: row?.default_payment_provider ?? "manual",
  };
}

export function SettingsView({
  initial,
  logoUrl,
  userEmail,
  payments,
}: {
  initial: BusinessSettingsRow | null;
  logoUrl: string | null;
  userEmail: string;
  payments: PaymentInfo;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = React.useState<Tab>("business");
  const [form, setForm] = React.useState<Form>(() => toForm(initial));
  const [logo, setLogo] = React.useState<string | null>(logoUrl);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [passwords, setPasswords] = React.useState({ currentPassword: "", newPassword: "" });
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [nameBusy, setNameBusy] = React.useState(false);

  function patch(changes: Partial<Form>) {
    setForm((current) => ({ ...current, ...changes }));
    setDirty(true);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/settings/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nextInvoiceNumber: Number(form.nextInvoiceNumber) || 1,
          numberPadding: Number(form.numberPadding) || 6,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not save settings.");
      setDirty(false);
      toast.success("Settings saved");
      router.refresh();
    } catch (error) {
      setFormError(safeErrorMessage(error));
      toast.error("Could not save settings", safeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordBusy(true);
    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not change the password.");
      setPasswords({ currentPassword: "", newPassword: "" });
      toast.success("Password updated");
    } catch (error) {
      toast.error("Could not change the password", safeErrorMessage(error));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setNameBusy(true);
    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not update your name.");
      toast.success("Name updated");
      router.refresh();
    } catch (error) {
      toast.error("Could not update your name", safeErrorMessage(error));
    } finally {
      setNameBusy(false);
    }
  }

  async function deleteAccount() {
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmEmail }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not delete the account.");
      toast.success("Account deleted");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (error) {
      toast.error("Could not delete the account", safeErrorMessage(error));
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Settings</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            Business details, invoice defaults and account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="text-2xs font-medium text-amber-600">Unsaved changes</span>
          ) : null}
          <Button variant="secondary" onClick={save} loading={saving} loadingText="Saving…">
            Save settings
          </Button>
        </div>
      </header>

      <div className="mt-6 border-b border-ink-200">
        <Tabs
          ariaLabel="Settings sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: "business", label: "Business", icon: <Building2 className="h-4 w-4" /> },
            { value: "invoice", label: "Invoice", icon: <Receipt className="h-4 w-4" /> },
            { value: "design", label: "Design", icon: <Palette className="h-4 w-4" /> },
            { value: "payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
            { value: "account", label: "Account", icon: <UserRound className="h-4 w-4" /> },
          ]}
        />
      </div>

      <div className="mt-6 space-y-6">
        {formError ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {formError}
          </p>
        ) : null}

        {tab === "business" ? (
          <>
            <Panel title="Logo" description="Shown on the header of every invoice you create.">
              <LogoUpload
                logoUrl={logo}
                businessName={form.businessName}
                onUploaded={setLogo}
                onRemoved={() => setLogo(null)}
              />
            </Panel>

            <Panel title="Business details" description="Printed in the invoice header.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" htmlFor="s-name" className="sm:col-span-2">
                  <Input
                    id="s-name"
                    value={form.businessName}
                    onChange={(e) => patch({ businessName: e.target.value })}
                    placeholder="Morgan Studio"
                  />
                </Field>
                <Field label="Email" htmlFor="s-email">
                  <Input
                    id="s-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </Field>
                <Field label="Phone" htmlFor="s-phone">
                  <Input
                    id="s-phone"
                    value={form.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Website" htmlFor="s-website">
                  <Input
                    id="s-website"
                    value={form.website}
                    onChange={(e) => patch({ website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </Field>
                <Field label="Address line 1" htmlFor="s-a1">
                  <Input
                    id="s-a1"
                    value={form.addressLine1}
                    onChange={(e) => patch({ addressLine1: e.target.value })}
                  />
                </Field>
                <Field label="Address line 2" htmlFor="s-a2">
                  <Input
                    id="s-a2"
                    value={form.addressLine2}
                    onChange={(e) => patch({ addressLine2: e.target.value })}
                  />
                </Field>
                <Field label="City" htmlFor="s-city">
                  <Input
                    id="s-city"
                    value={form.city}
                    onChange={(e) => patch({ city: e.target.value })}
                  />
                </Field>
                <Field label="State / province" htmlFor="s-state">
                  <Input
                    id="s-state"
                    value={form.state}
                    onChange={(e) => patch({ state: e.target.value })}
                  />
                </Field>
                <Field label="Postal code" htmlFor="s-postal">
                  <Input
                    id="s-postal"
                    value={form.postalCode}
                    onChange={(e) => patch({ postalCode: e.target.value })}
                  />
                </Field>
                <Field label="Country" htmlFor="s-country">
                  <Input
                    id="s-country"
                    value={form.country}
                    onChange={(e) => patch({ country: e.target.value })}
                  />
                </Field>
                <Field label="Tax ID / VAT number" htmlFor="s-tax">
                  <Input id="s-tax" value={form.taxId} onChange={(e) => patch({ taxId: e.target.value })} />
                </Field>
                <Field label="Registration number" htmlFor="s-reg">
                  <Input
                    id="s-reg"
                    value={form.registrationNumber}
                    onChange={(e) => patch({ registrationNumber: e.target.value })}
                  />
                </Field>
                <Field
                  label="Additional information"
                  htmlFor="s-extra"
                  className="sm:col-span-2"
                  hint="Appears under your contact block."
                >
                  <Textarea
                    id="s-extra"
                    rows={2}
                    value={form.additionalInfo}
                    onChange={(e) => patch({ additionalInfo: e.target.value })}
                  />
                </Field>
              </div>
            </Panel>
          </>
        ) : null}

        {tab === "invoice" ? (
          <Panel title="Invoice defaults" description="Applied to every new invoice.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default currency" htmlFor="s-currency">
                <Select
                  id="s-currency"
                  value={form.defaultCurrency}
                  onChange={(e) => patch({ defaultCurrency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name} ({c.symbol})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Default template" htmlFor="s-template">
                <Select
                  id="s-template"
                  value={form.defaultTemplate}
                  onChange={(e) =>
                    patch({
                      defaultTemplate: e.target.value,
                      defaultDesign: {
                        ...form.defaultDesign,
                        template: e.target.value,
                        ...(TEMPLATES.find((t) => t.slug === e.target.value) ?? {}),
                      } as DesignSettings,
                    })
                  }
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Invoice prefix"
                htmlFor="s-prefix"
                hint="Used with the next number, e.g. INV-000042."
              >
                <Input
                  id="s-prefix"
                  value={form.invoicePrefix}
                  onChange={(e) => patch({ invoicePrefix: e.target.value })}
                  className="font-mono"
                />
              </Field>

              <Field label="Next number" htmlFor="s-next">
                <Input
                  id="s-next"
                  type="number"
                  min={0}
                  value={form.nextInvoiceNumber}
                  onChange={(e) => patch({ nextInvoiceNumber: e.target.value })}
                  className="font-mono"
                />
              </Field>

              <Field label="Number padding" htmlFor="s-pad" hint="How many digits to zero-pad.">
                <Select
                  id="s-pad"
                  value={form.numberPadding}
                  onChange={(e) => patch({ numberPadding: e.target.value })}
                >
                  {[0, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Default payment terms" htmlFor="s-terms" className="sm:col-span-2">
                <Textarea
                  id="s-terms"
                  rows={2}
                  value={form.defaultPaymentTerms}
                  onChange={(e) => patch({ defaultPaymentTerms: e.target.value })}
                />
              </Field>

              <Field label="Default notes" htmlFor="s-notes" className="sm:col-span-2">
                <Textarea
                  id="s-notes"
                  rows={2}
                  value={form.defaultNotes}
                  onChange={(e) => patch({ defaultNotes: e.target.value })}
                />
              </Field>

              <Field label="Default terms & conditions" htmlFor="s-tc" className="sm:col-span-2">
                <Textarea
                  id="s-tc"
                  rows={3}
                  value={form.defaultTerms}
                  onChange={(e) => patch({ defaultTerms: e.target.value })}
                />
              </Field>
            </div>
          </Panel>
        ) : null}

        {tab === "design" ? (
          <Panel title="Default design" description="Starting point for new invoices. Every value stays editable per invoice.">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-ink-500">Palette:</span>
                {PALETTES.map((palette) => (
                  <button
                    key={palette.name}
                    type="button"
                    onClick={() =>
                      patch({
                        defaultDesign: { ...form.defaultDesign, ...(palette.values as object) },
                      })
                    }
                    className="rounded-full border border-ink-300 px-2 py-0.5 text-2xs font-medium text-ink-600 transition-colors hover:bg-ink-100"
                  >
                    {palette.name}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary color" htmlFor="d-primary">
                  <ColorInput
                    id="d-primary"
                    value={form.defaultDesign.primaryColor}
                    onChange={(v) =>
                      patch({
                        defaultDesign: {
                          ...form.defaultDesign,
                          primaryColor: v,
                          tableHeaderBackground: v,
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Background color" htmlFor="d-bg">
                  <ColorInput
                    id="d-bg"
                    value={form.defaultDesign.backgroundColor}
                    onChange={(v) => patch({ defaultDesign: { ...form.defaultDesign, backgroundColor: v } })}
                  />
                </Field>
              </div>

              <Field label="Font family" htmlFor="d-font">
                <Select
                  id="d-font"
                  value={form.defaultDesign.fontFamily}
                  onChange={(e) => patch({ defaultDesign: { ...form.defaultDesign, fontFamily: e.target.value } })}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Page size" htmlFor="d-page">
                  <Select
                    id="d-page"
                    value={form.defaultDesign.pageSize}
                    onChange={(e) =>
                      patch({
                        defaultDesign: {
                          ...form.defaultDesign,
                          pageSize: e.target.value as DesignSettings["pageSize"],
                        },
                      })
                    }
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">US Letter</option>
                  </Select>
                </Field>
                <Field label="Row density" htmlFor="d-density">
                  <Select
                    id="d-density"
                    value={form.defaultDesign.density}
                    onChange={(e) =>
                      patch({
                        defaultDesign: {
                          ...form.defaultDesign,
                          density: e.target.value as DesignSettings["density"],
                        },
                      })
                    }
                  >
                    <option value="compact">Compact</option>
                    <option value="regular">Regular</option>
                    <option value="airy">Airy</option>
                  </Select>
                </Field>
              </div>

              <div className="space-y-1 border-t border-ink-200 pt-4">
                <Toggle
                  checked={form.defaultDesign.showPaymentButton}
                  onChange={(v) => patch({ defaultDesign: { ...form.defaultDesign, showPaymentButton: v } })}
                  label="Show the Pay now button by default"
                />
                <Toggle
                  checked={form.defaultDesign.showShippingAddress}
                  onChange={(v) => patch({ defaultDesign: { ...form.defaultDesign, showShippingAddress: v } })}
                  label="Show shipping addresses"
                />
                <Toggle
                  checked={form.defaultDesign.showPageNumbers}
                  onChange={(v) => patch({ defaultDesign: { ...form.defaultDesign, showPageNumbers: v } })}
                  label="Page numbers in the PDF footer"
                />
              </div>
            </div>
          </Panel>
        ) : null}

        {tab === "payments" ? (
          <>
            <Panel title="Payment providers" description="Configured through server environment variables only.">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                    Mode
                  </span>
                  {payments.mode === "test" ? (
                    <Badge tone="warning">TEST MODE</Badge>
                  ) : payments.mode === "live" ? (
                    <Badge tone="success">LIVE</Badge>
                  ) : (
                    <Badge tone="neutral">DISABLED</Badge>
                  )}
                  {payments.mode === "test" ? (
                    <span className="flex items-center gap-1 text-2xs text-amber-700">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      No real money moves in test mode.
                    </span>
                  ) : null}
                </div>

                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                  {payments.providers.map((provider) => (
                    <li key={provider.name} className="flex items-center justify-between gap-3 px-3.5 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{provider.label}</p>
                        <p className="text-2xs text-ink-500">
                          {provider.configured
                            ? provider.isTest
                              ? "Configured with sandbox credentials"
                              : "Configured with live credentials"
                            : "Missing server environment variables"}
                        </p>
                      </div>
                      <Badge tone={provider.configured ? "success" : "neutral"}>
                        {provider.configured ? "Ready" : "Not configured"}
                      </Badge>
                    </li>
                  ))}
                </ul>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-ink-700">Webhook endpoints</p>
                  {payments.webhookUrls.map((url) => (
                    <p key={url} className="truncate rounded bg-ink-50 px-2 py-1 font-mono text-2xs text-ink-600">
                      {url}
                    </p>
                  ))}
                  <p className="text-2xs leading-relaxed text-ink-500">
                    Paste these into your provider dashboard so payments are confirmed server-side.
                    An invoice is never marked paid from a browser redirect.
                  </p>
                </div>

                <Toggle
                  checked={form.defaultPaymentEnabled}
                  onChange={(v) => patch({ defaultPaymentEnabled: v })}
                  label="Enable the Pay now button on new invoices"
                  description="Requires at least one configured provider."
                />

                <Field label="Default provider" htmlFor="s-provider">
                  <Select
                    id="s-provider"
                    value={form.defaultPaymentProvider}
                    onChange={(e) => patch({ defaultPaymentProvider: e.target.value })}
                  >
                    <option value="manual">Manual / bank transfer</option>
                    {payments.providers.map((p) => (
                      <option key={p.name} value={p.name} disabled={!p.configured}>
                        {p.label}
                        {p.configured ? "" : " (not configured)"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Panel>

            <Panel title="Email delivery" description="Used by the “Send invoice” action.">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    Provider: <span className="font-mono text-xs">{payments.email.provider}</span>
                  </p>
                  <p className="text-2xs text-ink-500">
                    {payments.email.real
                      ? "Emails are delivered by this provider."
                      : "Console provider — messages are logged on the server, not delivered."}
                  </p>
                </div>
                <Badge tone={payments.email.real ? "success" : "warning"}>
                  {payments.email.real ? "Live" : "Console"}
                </Badge>
              </div>
            </Panel>
          </>
        ) : null}

        {tab === "account" ? (
          <>
            <Panel title="Profile">
              <form onSubmit={saveName} className="flex flex-wrap items-end gap-3">
                <Field label="Full name" htmlFor="a-name" className="min-w-48 flex-1">
                  <Input
                    id="a-name"
                    defaultValue=""
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Button type="submit" variant="outline" loading={nameBusy} loadingText="Saving…">
                  Update name
                </Button>
              </form>
              <p className="mt-3 text-xs text-ink-500">
                Signed in as <span className="font-medium text-ink-800">{userEmail}</span>
              </p>
            </Panel>

            <Panel title="Change password">
              <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
                <Field label="Current password" htmlFor="a-current" required>
                  <Input
                    id="a-current"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  />
                </Field>
                <Field label="New password" htmlFor="a-new" required>
                  <Input
                    id="a-new"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="outline" loading={passwordBusy} loadingText="Updating…">
                    Update password
                  </Button>
                </div>
              </form>
            </Panel>

            <Panel title="Session">
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </Panel>

            <Panel title="Danger zone" description="Deleting your account removes every invoice, customer and stored logo permanently.">
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete account
              </Button>
            </Panel>
          </>
        ) : null}
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description="This cannot be undone. All invoices, customers, transactions and uploaded logos are removed."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()}
              onClick={deleteAccount}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <Field label={`Type ${userEmail} to confirm`} htmlFor="confirm-email" required>
          <Input
            id="confirm-email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            inputMode="email"
            autoComplete="off"
          />
        </Field>
      </Dialog>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <div className="border-b border-ink-200 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

