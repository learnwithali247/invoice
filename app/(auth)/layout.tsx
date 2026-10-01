import Link from "next/link";
import { FileText } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-ink-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-900 text-white">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">Invoice Generator</span>
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="px-5 py-6 text-center text-2xs text-ink-400 sm:px-8">
        Invoices, payments and documents — nothing more.
      </footer>
    </div>
  );
}
