"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { safeErrorMessage } from "@/lib/utils";

type Errors = Partial<Record<"fullName" | "email" | "password" | "confirm" | "form", string>>;

const passwordRule = (value: string) => {
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[a-zA-Z]/.test(value)) return "Include at least one letter.";
  if (!/[0-9]/.test(value)) return "Include at least one number.";
  return null;
};

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [businessName, setBusinessName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [loading, setLoading] = React.useState(false);

  function validate(): Errors {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Tell us your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    const pw = passwordRule(password);
    if (pw) next.password = pw;
    if (confirm !== password) next.confirm = "Passwords do not match.";
    return next;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          business_name: businessName.trim() || fullName.trim(),
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setErrors({ form: safeErrorMessage(error, "Could not create your account.") });
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      // email confirmation required
      setErrors({
        form: "Account created. Check your inbox to confirm your email, then sign in.",
      });
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Your first invoice takes about a minute. No setup screens in the way.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <Field label="Full name" htmlFor="fullName" required error={errors.fullName}>
          <Input
            id="fullName"
            name="name"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Morgan"
          />
        </Field>

        <Field
          label="Business name"
          htmlFor="businessName"
          hint="Optional — you can change this later in Settings."
        >
          <Input
            id="businessName"
            name="organization"
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Morgan Studio"
          />
        </Field>

        <Field label="Email" htmlFor="email" required error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirm" required error={errors.confirm}>
          <Input
            id="confirm"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {errors.form ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {errors.form}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          loading={loading}
          className="w-full"
          loadingText="Creating account…"
        >
          Create account
          {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
