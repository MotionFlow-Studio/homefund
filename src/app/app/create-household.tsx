"use client";

import { ArrowRight, House, UserPlus } from "lucide-react";
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
import { SetupFrame } from "./setup-frame";

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
      <SetupFrame
        step={1}
        icon={<UserPlus size={26} />}
        title="Join your family"
        subtitle="Ask the person who set up HomeFund in your family for an invite code."
      >
        <JoinHousehold user={user} />
        <button type="button" onClick={() => setJoining(false)} className="mt-5 w-full text-center text-sm font-semibold text-brand">
          Set up a new household instead
        </button>
      </SetupFrame>
    );
  }

  return (
    <SetupFrame
      step={1}
      icon={<House size={26} />}
      title={firstName ? `Welcome, ${firstName}!` : "Set up your household"}
      subtitle="Your household is shared with your family. Everyone sees the same budget, in one currency."
    >
      <button
        type="button"
        onClick={() => setJoining(true)}
        className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 p-4 text-left ring-1 ring-indigo-500/20 transition hover:ring-indigo-500/40"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30">
          <UserPlus size={19} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Got an invite code?</span>
          <span className="block text-sm opacity-70">Join your family&rsquo;s household instead.</span>
        </span>
        <ArrowRight size={18} aria-hidden className="shrink-0 text-indigo-600 transition group-hover:translate-x-0.5 dark:text-indigo-300" />
      </button>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold tracking-wider uppercase opacity-50">
        <span className="h-px flex-1 bg-current opacity-30" /> or start a new one <span className="h-px flex-1 bg-current opacity-30" />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
          Create household <ArrowRight size={18} aria-hidden className="ml-2" />
        </Button>
      </form>
    </SetupFrame>
  );
}
