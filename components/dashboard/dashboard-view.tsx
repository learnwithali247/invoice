"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { InvoiceActions, type InvoiceRowView } from "./invoice-actions";
import { InvoiceTypePicker } from "./invoice-type-picker";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/invoice/calculate";
import { getCurrency } from "@/lib/invoice/currencies";
import { formatDate } from "@/lib/invoice/date";
import { cn, pluralise } from "@/lib/utils";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  INVOICE_STATUSES,
  STATUS_LABELS,
  type PaymentStatus,
  type InvoiceStatus,
} from "@/lib/invoice/types";
import { CURRENCIES } from "@/lib/invoice/currencies";

export type InvoiceListItem = InvoiceRowView & {
  invoice_type: string;
  customer_name: string;
  customer_company: string | null;
  customer_email?: string | null;
  status: string;
  payment_status: string;
  currency: string;
  currency_symbol: string | null;
  invoice_date: string;
  due_date: string | null;
  total: number;
  amount_due: number;
  amount_paid: number;
  template: string;
  created_at: string;
};

export type DashboardPayload = {
  invoices: InvoiceListItem[];
  total: number;
  page: number;
  pageCount: number;
};

const PAYMENT_TONES: Record<string, BadgeTone> = {
  unpaid: "neutral",
  pending: "warning",
  paid: "success",
  partially_paid: "info",
  overdue: "danger",
  cancelled: "neutral",
  refunded: "purple",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  draft: "neutral",
  sent: "info",
  viewed: "info",
  paid: "success",
  partial: "info",
  overdue: "danger",
  cancelled: "neutral",
};

export function DashboardView({
  initial,
  summary,
  initialQuery,
}: {
  initial: DashboardPayload;
  summary: Record<string, { billed: number; outstanding: number; overdue: number; count: number }>;
  initialQuery: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  const [search, setSearch] = React.useState(initialQuery.search ?? "");
  const [status, setStatus] = React.useState(initialQuery.status ?? "all");
  const [paymentStatus, setPaymentStatus] = React.useState(initialQuery.paymentStatus ?? "all");
  const [currency, setCurrency] = React.useState(initialQuery.currency ?? "all");
  const [dateFrom, setDateFrom] = React.useState(initialQuery.dateFrom ?? "");
  const [dateTo, setDateTo] = React.useState(initialQuery.dateTo ?? "");
  const [sort, setSort] = React.useState(initialQuery.sort ?? "newest");
  const [page, setPage] = React.useState(Number(initialQuery.page ?? 1));

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (currency !== "all") params.set("currency", currency);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (sort !== "newest") params.set("sort", sort);
    params.set("page", String(page));
    return params.toString();
  }, [search, status, paymentStatus, currency, dateFrom, dateTo, sort, page]);

  const firstLoad = React.useRef(true);

  React.useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/invoices?${queryString}`, {
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error?.message ?? "Could not load invoices.");
        setData(json.data);
        router.replace(`/dashboard?${queryString}`, { scroll: false });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Could not load invoices", (error as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [queryString, router, toast]);

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setPaymentStatus("all");
    setCurrency("all");
    setDateFrom("");
    setDateTo("");
    setSort("newest");
    setPage(1);
  }

  const activeFilters =
    (search ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (paymentStatus !== "all" ? 1 : 0) +
    (currency !== "all" ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  const primaryCurrency =
    currency !== "all" ? currency : Object.keys(summary)[0] ?? "USD";
  const primary = getCurrency(primaryCurrency);
  const stats = summary[primaryCurrency];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Invoices</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {data.total === 0
              ? "Nothing here yet."
              : `${pluralise(data.total, "invoice")} · page ${data.page} of ${data.pageCount}`}
          </p>
        </div>
        <Button variant="secondary" size="lg" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Create invoice
        </Button>
      </header>

      {stats && stats.count > 0 ? (
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Receipt className="h-4 w-4" />}
            label="Total billed"
            value={formatMoney(stats.billed, primary.symbol, primary.decimals)}
            hint={`${pluralise(stats.count, "invoice")} all time`}
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Outstanding"
            value={formatMoney(stats.outstanding, primary.symbol, primary.decimals)}
            hint="Awaiting payment"
          />
          <StatCard
            icon={<TrendingDown className="h-4 w-4" />}
            label="Overdue"
            value={formatMoney(stats.overdue, primary.symbol, primary.decimals)}
            hint="Past the due date"
            tone={stats.overdue > 0 ? "danger" : "default"}
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Average invoice"
            value={formatMoney(
              stats.count ? stats.billed / stats.count : 0,
              primary.symbol,
              primary.decimals,
            )}
            hint="Across all statuses"
          />
        </section>
      ) : null}

      {/* filter bar */}
      <section className="mt-6 rounded-lg border border-ink-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search number, customer or email"
              className="pl-9"
              aria-label="Search invoices"
              type="search"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="sort">
              Sort by
            </label>
            <div className="relative">
              <ArrowDownUp
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <Select
                id="sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="w-[10.5rem] pl-8"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
                <option value="number_asc">Invoice number</option>
              </Select>
            </div>

            <Button
              variant={filtersOpen || activeFilters ? "secondary" : "outline"}
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
              {activeFilters ? (
                <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-2xs">{activeFilters}</span>
              ) : null}
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="grid gap-3 border-t border-ink-200 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={INVOICE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s as InvoiceStatus] }))}
            />
            <FilterSelect
              label="Payment status"
              value={paymentStatus}
              onChange={(v) => {
                setPaymentStatus(v);
                setPage(1);
              }}
              options={PAYMENT_STATUSES.map((s) => ({
                value: s,
                label: PAYMENT_STATUS_LABELS[s as PaymentStatus],
              }))}
            />
            <FilterSelect
              label="Currency"
              value={currency}
              onChange={(v) => {
                setCurrency(v);
                setPage(1);
              }}
              options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
            />
            <div className="space-y-1.5">
              <label htmlFor="dateFrom" className="block text-xs font-medium text-ink-700">
                From
              </label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dateTo" className="block text-xs font-medium text-ink-700">
                To
              </label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            {activeFilters ? (
              <div className="sm:col-span-2 lg:col-span-5">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* table */}
      <section className="mt-4 overflow-hidden rounded-lg border border-ink-200 bg-white">
        {loading ? (
          <div className="divide-y divide-ink-100" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : data.invoices.length === 0 ? (
          activeFilters || search ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No invoices match those filters"
              description="Try a different search term, or clear the filters to see everything."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No invoices yet"
              description="Create your first invoice in seconds."
              action={
                <Button variant="secondary" onClick={() => setPickerOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Create invoice
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* desktop table */}
            <table className="hidden w-full md:table">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/60 text-left">
                  <th scope="col" className="px-4 py-2.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                    Invoice
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                    Amount
                  </th>
                  <th scope="col" className="w-12 px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onDeleted={() => setVersion((v) => v + 1)}
                  />
                ))}
              </tbody>
            </table>

            {/* mobile cards */}
            <ul className="divide-y divide-ink-100 md:hidden">
              {data.invoices.map((invoice) => (
                <li key={invoice.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                        className="truncate text-sm font-semibold text-ink-900 hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </button>
                      <p className="truncate text-xs text-ink-500">
                        {invoice.customer_company || invoice.customer_name || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink-900">
                        {formatMoney(
                          invoice.total,
                          getCurrency(invoice.currency, invoice.currency_symbol).symbol,
                          getCurrency(invoice.currency).decimals,
                        )}
                      </p>
                      <Badge tone={PAYMENT_TONES[invoice.payment_status] ?? "neutral"} className="mt-1">
                        {PAYMENT_STATUS_LABELS[invoice.payment_status as PaymentStatus] ??
                          invoice.payment_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-2xs text-ink-500">
                      {formatDate(invoice.invoice_date)}
                    </span>
                    <InvoiceActions
                      invoice={{
                        id: invoice.id,
                        invoiceNumber: invoice.invoiceNumber,
                        publicToken: invoice.publicToken,
                        paymentEnabled: invoice.paymentEnabled,
                        customer_name: invoice.customer_name,
                        customer_email: invoice.customer_email ?? null,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {data.pageCount > 1 ? (
              <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
                <p className="text-xs text-ink-500">
                  Page {data.page} of {data.pageCount}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data.page >= data.pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <InvoiceTypePicker open={pickerOpen} onClose={() => setPickerOpen(false)} key={version} />
    </div>
  );
}

function InvoiceRow({
  invoice,
  onDeleted,
}: {
  invoice: InvoiceListItem;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const currency = getCurrency(invoice.currency, invoice.currency_symbol);

  return (
    <tr className="group transition-colors hover:bg-ink-50/60">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => router.push(`/invoices/${invoice.id}`)}
          className="text-sm font-semibold text-ink-900 hover:underline"
        >
          {invoice.invoiceNumber}
        </button>
        <p className="mt-0.5 text-2xs tracking-wide text-ink-400 uppercase">{invoice.invoice_type}</p>
      </td>
      <td className="max-w-0 px-4 py-3">
        <p className="truncate text-sm text-ink-800">
          {invoice.customer_company || invoice.customer_name || "—"}
        </p>
        {invoice.customer_company && invoice.customer_name ? (
          <p className="truncate text-2xs text-ink-500">{invoice.customer_name}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap text-ink-600">
        {formatDate(invoice.invoice_date)}
        {invoice.due_date ? (
          <span className="mt-0.5 block text-2xs text-ink-400">
            due {formatDate(invoice.due_date)}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={STATUS_TONES[invoice.status] ?? "neutral"}>
            {STATUS_LABELS[invoice.status as InvoiceStatus] ?? invoice.status}
          </Badge>
          <Badge tone={PAYMENT_TONES[invoice.payment_status] ?? "neutral"}>
            {PAYMENT_STATUS_LABELS[invoice.payment_status as PaymentStatus] ??
              invoice.payment_status}
          </Badge>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-semibold tabular-nums text-ink-900">
          {formatMoney(invoice.total, currency.symbol, currency.decimals)}
        </p>
        {invoice.amount_due > 0 && invoice.payment_status !== "paid" ? (
          <p className="mt-0.5 text-2xs tabular-nums text-ink-500">
            {formatMoney(invoice.amount_due, currency.symbol, currency.decimals)} due
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right">
        <InvoiceActions
          invoice={{
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            publicToken: invoice.publicToken,
            paymentEnabled: invoice.paymentEnabled,
            customer_name: invoice.customer_name,
            customer_email: invoice.customer_email ?? null,
          }}
          onDeleted={onDeleted}
        />
      </td>
    </tr>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3.5">
      <div className="flex items-center gap-2 text-ink-400">
        {icon}
        <span className="text-2xs font-semibold tracking-wider text-ink-500 uppercase">{label}</span>
      </div>
      <p
        className={cn(
          "mt-2 text-lg font-semibold tracking-tight tabular-nums",
          tone === "danger" ? "text-red-600" : "text-ink-900",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-2xs text-ink-500">{hint}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-ink-700">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

