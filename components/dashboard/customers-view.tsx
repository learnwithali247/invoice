"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { safeErrorMessage } from "@/lib/utils";
import type { CustomerRow } from "@/types/database";

type Draft = {
  id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  shippingAddress: string;
  taxId: string;
  notes: string;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  shippingAddress: "",
  taxId: "",
  notes: "",
};

export function CustomersView({ initial }: { initial: CustomerRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [customers, setCustomers] = React.useState(initial);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [deleting, setDeleting] = React.useState<CustomerRow | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const firstRun = React.useRef(true);

  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = search ? `?search=${encodeURIComponent(search)}` : "";
        const response = await fetch(`/api/customers${params}`, { signal: controller.signal });
        const json = await response.json();
        if (json?.ok) setCustomers(json.data as CustomerRow[]);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Could not load customers", safeErrorMessage(error));
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, toast]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    if (!editing.name.trim()) {
      setFormError("A customer name is required.");
      return;
    }
    setFormError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not save the customer.");
      setCustomers((prev) => {
        const next = json.data as CustomerRow;
        return prev.some((c) => c.id === next.id)
          ? prev.map((c) => (c.id === next.id ? next : c))
          : [...prev, next].sort((a, b) => a.name.localeCompare(b.name));
      });
      setEditing(null);
      toast.success(editing.id ? "Customer updated" : "Customer added");
    } catch (error) {
      setFormError(safeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      const response = await fetch(`/api/customers/${deleting.id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not delete the customer.");
      setCustomers((prev) => prev.filter((c) => c.id !== deleting.id));
      toast.success("Customer deleted");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error("Could not delete", safeErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Customers</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            Saved customers appear as a dropdown in the invoice editor.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="h-4 w-4" aria-hidden />
          Add customer
        </Button>
      </header>

      <div className="relative mt-6">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company or email"
          className="pl-9"
          aria-label="Search customers"
          type="search"
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-ink-200 bg-white">
        {loading ? (
          <div className="divide-y divide-ink-100" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={search ? <Search className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            title={search ? "No customers match that search" : "No customers yet"}
            description={
              search
                ? "Try a different search term."
                : "Save a customer while creating an invoice, or add one here."
            }
            action={
              search ? (
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setEditing({ ...EMPTY })}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add customer
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {customers.map((customer) => (
              <li key={customer.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {customer.name}
                    {customer.company ? (
                      <span className="font-normal text-ink-500"> · {customer.company}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </p>
                </div>
                <DropdownMenu
                  label={`Actions for ${customer.name}`}
                  items={[
                    {
                      label: "Edit",
                      icon: <Pencil className="h-4 w-4" />,
                      onSelect: () =>
                        setEditing({
                          id: customer.id,
                          name: customer.name ?? "",
                          company: customer.company ?? "",
                          email: customer.email ?? "",
                          phone: customer.phone ?? "",
                          address: customer.billing_address ?? "",
                          shippingAddress: customer.shipping_address ?? "",
                          taxId: customer.tax_id ?? "",
                          notes: customer.notes ?? "",
                        }),
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 className="h-4 w-4" />,
                      danger: true,
                      separatorBefore: true,
                      onSelect: () => setDeleting(customer),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit customer" : "Add customer"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={save}
              loading={saving}
              loadingText="Saving…"
              type="submit"
              form="customer-form"
            >
              Save customer
            </Button>
          </>
        }
      >
        {editing ? (
          <form id="customer-form" onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="c-name" required error={formError}>
                <Input
                  id="c-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label="Company" htmlFor="c-company">
                <Input
                  id="c-company"
                  value={editing.company}
                  onChange={(e) => setEditing({ ...editing, company: e.target.value })}
                />
              </Field>
              <Field label="Email" htmlFor="c-email">
                <Input
                  id="c-email"
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </Field>
              <Field label="Phone" htmlFor="c-phone">
                <Input
                  id="c-phone"
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Billing address" htmlFor="c-address">
              <Textarea
                id="c-address"
                rows={2}
                value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tax ID" htmlFor="c-tax">
                <Input
                  id="c-tax"
                  value={editing.taxId}
                  onChange={(e) => setEditing({ ...editing, taxId: e.target.value })}
                />
              </Field>
              <Field label="Notes" htmlFor="c-notes">
                <Input
                  id="c-notes"
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </Field>
            </div>
          </form>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="The customer is removed from your library. Invoices that already reference them keep their saved details."
        confirmLabel="Delete customer"
        onConfirm={remove}
      />
    </div>
  );
}
