"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AUTH_ERROR_TEXT, signUp } from "@/lib/auth-client";
import { PASSWORD_MIN, signUpSchema } from "@/lib/auth-schema";

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

export function SignUpForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      const fieldErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof Errors] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    const result = await signUp(parsed.data);
    setLoading(false);

    if (!result.ok) {
      setErrors({ form: AUTH_ERROR_TEXT[result.error] });
    } else if (result.value.status === "signed_in") {
      router.replace("/app");
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <AuthCard title="Check your email" footer={<Link href="/signin" className="font-semibold text-brand">Back to sign in</Link>}>
        <p className="text-center opacity-80">
          We sent you a link to confirm your email address. Open it, then sign in.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-brand">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Your name" name="name" autoComplete="name" required error={errors.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required error={errors.email} />
        <Field
          label={`Password (at least ${PASSWORD_MIN} characters)`}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
          error={errors.password}
        />
        {errors.form ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {errors.form}
          </p>
        ) : null}
        <Button type="submit" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
