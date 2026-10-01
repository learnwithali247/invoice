"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { safeErrorMessage } from "@/lib/utils";

const passwordRule = (value: string) => {
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[a-zA-Z]/.test(value)) return "Include at least one letter.";
  if (!/[0-9]/.test(value)) return "Include at least one number.";
  return null;
};

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    // Supabase parses the recovery token from the URL automatically
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const pw = passwordRule(password);
    if (pw) return setError(pw);
    if (password !== confirm) return setError("Passwords do not match.");

    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(safeErrorMessage(updateError, "The password could not be updated."));
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1200);
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">Password updated</h1>
        <p className="mt-2 text-sm text-ink-500">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink-900">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        {ready
          ? "Pick something you haven't used before."
          : "Open this page from the link in your reset email."}
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <Field label="New password" htmlFor="password" required hint="At least 8 characters, with a letter and a number.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={!ready}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Field label="Confirm new password" htmlFor="confirm" required>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            disabled={!ready}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          loading={loading}
          disabled={!ready}
          className="w-full"
          loadingText="Updating…"
        >
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        <Link href="/login" className="font-medium text-ink-900 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
