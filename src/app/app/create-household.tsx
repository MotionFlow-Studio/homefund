"use client";

import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { CurrencyPicker } from "@/components/currency-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { CurrentUser } from "@/lib/auth-client";
import { guessCurrency } from "@/lib/currency-options";
import { createHousehold } from "@/lib/household";
import { requestSync } from "@/lib/local/sync-status";
import { isCurrency } from "@/lib/money";
import { JoinHousehold } from "./join-household";

const formSchema = z.object({
  householdName: z.string().trim().min(1, "Give your household a name").max(80),
  memberName: z.string().trim().min(1, "Enter your name").max(60),
  currency: z.string().refine(isCurrency, "Choose a currency"),
});

type Errors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

export function CreateHousehold({ user }: { user: CurrentUser }) {
  const [currency, setCurrency] = useState(() =>
    typeof navigator === "undefined" ? "EUR" : guessCurrency(navigator.languages),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(false);


  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = formSchema.safeParse({ ...form, currency });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    await createHousehold({ userId: user.id, ...parsed.data });
    void requestSync();
  }

  const firstName = user.name.split(" ")[0] || "";

  if (joining) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
        <h1 className="text-2xl font-semibold">Join a household</h1>
        <p className="mt-2 mb-8 opacity-80">Ask the person who set up HomeFund in your family for an invite code.</p>
        <JoinHousehold user={user} />
        <button type="button" onClick={() => setJoining(false)} className="mt-6 self-center text-sm font-semibold text-brand">
          Set up a new household instead
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <h1 className="text-2xl font-semibold">Set up your household</h1>
      <p className="mt-2 opacity-80">
        Your household is shared with your family. Everyone sees the same budget, in one currency.
      </p>
      <button
        type="button"
        onClick={() => setJoining(true)}
        className="mt-5 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 text-left transition hover:bg-brand/10"
      >
        <UserPlus size={22} aria-hidden className="shrink-0 text-brand" />
        <span>
          <span className="block font-semibold">Got an invite code?</span>
          <span className="block text-sm opacity-75">Join your family&rsquo;s household instead.</span>
        </span>
      </button>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <Field
          label="Household name"
          name="householdName"
          defaultValue={firstName ? `${firstName}'s family` : ""}
          placeholder="The Smith family"
          maxLength={80}
          required
          error={errors.householdName}
        />
        <Field
          label="Your name"
          name="memberName"
          defaultValue={user.name}
          autoComplete="name"
          maxLength={60}
          required
          error={errors.memberName}
        />

        <CurrencyPicker value={currency} onChange={setCurrency} error={errors.currency} />

        <Button type="submit" loading={saving}>
          Create household
        </Button>
      </form>
    </main>
  );
}
