"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { nextPath } from "@/lib/next-path";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AUTH_ERROR_TEXT, signIn } from "@/lib/auth-client";
import { signInSchema } from "@/lib/auth-schema";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signInSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? AUTH_ERROR_TEXT.invalid_input);
      return;
    }

    setError(null);
    setLoading(true);
    const result = await signIn(parsed.data);
    setLoading(false);

    if (result.ok) {
      router.replace(nextPath());
    } else {
      setError(AUTH_ERROR_TEXT[result.error]);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      footer={
        <>
          New to HomeFund?{" "}
          <Link href="/signup" className="font-semibold text-brand">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
