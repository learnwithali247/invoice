"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings as SettingsIcon,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ToastProvider } from "@/components/ui/toast";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({
  user,
  children,
}: {
  user: { email: string; name: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-ink-900 text-white"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2 text-ink-900">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-900 text-white">
        <FileText className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-sm font-semibold tracking-tight">Invoice Generator</span>
    </Link>
  );

  return (
    <ToastProvider>
      <div className="flex min-h-dvh bg-ink-50">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-200 bg-white px-3 py-4 lg:flex">
          <div className="px-1.5 pb-5">{brand}</div>
          <Button
            variant="secondary"
            className="mb-4 w-full"
            onClick={() => router.push("/invoices/new")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New invoice
          </Button>
          {nav}
          <div className="mt-auto pt-4">
            <UserCard user={user} onSignOut={signOut} />
          </div>
        </aside>

        {/* mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 animate-fade-in bg-ink-950/30"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-ink-200 bg-white px-3 py-4 animate-slide-up">
              <div className="flex items-center justify-between px-1.5 pb-5">
                {brand}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant="secondary"
                className="mb-4 w-full"
                onClick={() => router.push("/invoices/new")}
              >
                <Plus className="h-4 w-4" aria-hidden />
                New invoice
              </Button>
              {nav}
              <div className="mt-auto pt-4">
                <UserCard user={user} onSignOut={signOut} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-md p-2 text-ink-600 transition-colors hover:bg-ink-100"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            {brand}
            <div className="ml-auto lg:hidden">
              <UserMenu user={user} onSignOut={signOut} compact />
            </div>
          </header>

          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function UserCard({ user, onSignOut }: { user: { email: string; name: string }; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 p-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-2xs font-semibold text-white">
        {initials(user.name || user.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ink-900">{user.name || "Account"}</p>
        <p className="truncate text-2xs text-ink-500">{user.email}</p>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function UserMenu({
  user,
  onSignOut,
  compact,
}: {
  user: { email: string; name: string };
  onSignOut: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <DropdownMenu
          items={[
            { label: "Settings", icon: <SettingsIcon className="h-4 w-4" />, onSelect: () => router.push("/settings") },
            { label: "Customers", icon: <Users className="h-4 w-4" />, onSelect: () => router.push("/customers") },
            { label: "Sign out", icon: <LogOut className="h-4 w-4" />, onSelect: onSignOut, separatorBefore: true, danger: true },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:bg-ink-100"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[10px] font-semibold text-white">
          {initials(user.name || user.email)}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{user.name || user.email}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" aria-hidden />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-1 min-w-52 rounded-lg border border-ink-200 bg-white py-1 shadow-panel animate-slide-up">
            <div className="px-3 py-2">
              <p className="truncate text-xs font-semibold text-ink-900">{user.name || "Account"}</p>
              <p className="truncate text-2xs text-ink-500">{user.email}</p>
            </div>
            <div className="my-1 h-px bg-ink-200" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/settings");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50"
            >
              <SettingsIcon className="h-4 w-4 text-ink-400" aria-hidden />
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
