"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { safeErrorMessage } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(safeErrorMessage(resetError, "Could not send the reset link."));
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <MailCheck className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          If an account exists for <span className="font-medium text-ink-800">{email}</span>, a password
          reset link is on its way. The link expires in one hour.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back to sign in
      </Link>

      <h1 className="mt-6 text-xl font-semibold tracking-tight text-ink-900">Reset your password</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Enter your email and we&apos;ll send a secure reset link.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="secondary" size="lg" loading={loading} className="w-full" loadingText="Sending…">
          Send reset link
        </Button>
      </form>
    </div>
  );
}
