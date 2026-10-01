import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center bg-ink-50 px-6 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-ink-400 shadow-subtle">
        <FileQuestion className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-5 text-lg font-semibold tracking-tight text-ink-900">Page not found</h1>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
        The page or invoice link you followed doesn&apos;t exist, or it was deleted by its owner.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/dashboard">
          <Button variant="secondary">Go to dashboard</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline">Sign in</Button>
        </Link>
      </div>
    </main>
  );
}
