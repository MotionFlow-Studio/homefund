"use client";

import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { CurrentUser } from "@/lib/auth-client";
import { currencyOptions, guessCurrency, SUGGESTED_CURRENCIES } from "@/lib/currency-options";
import { createHousehold } from "@/lib/household";
import { requestSync } from "@/lib/local/sync-status";
import { isCurrency } from "@/lib/money";

const formSchema = z.object({
  householdName: z.string().trim().min(1, "Give your household a name").max(80),
  memberName: z.string().trim().min(1, "Enter your name").max(60),
  currency: z.string().refine(isCurrency, "Choose a currency"),
});

type Errors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

export function CreateHousehold({ user }: { user: CurrentUser }) {
  const options = useMemo(() => currencyOptions(), []);
  const [currency, setCurrency] = useState(() =>
    typeof navigator === "undefined" ? "EUR" : guessCurrency(navigator.languages),
  );
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.filter((o) => SUGGESTED_CURRENCIES.includes(o.code) || o.code === currency);
    return options.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)).slice(0, 30);
  }, [options, query, currency]);

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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <h1 className="text-2xl font-semibold">Set up your household</h1>
      <p className="mt-2 opacity-80">
        Your household is shared with your family. Everyone sees the same budget, in one currency.
      </p>

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

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Currency</legend>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all currencies"
            aria-label="Search currencies"
            className="h-11 rounded-xl border border-black/15 bg-white px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
          />
          <div role="radiogroup" aria-label="Currency" className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto">
            {visible.map((option) => {
              const selected = option.code === currency;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCurrency(option.code)}
                  className={`flex h-12 items-center justify-between rounded-xl border px-4 text-left transition ${
                    selected
                      ? "border-brand bg-brand/10 font-semibold"
                      : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                  }`}
                >
                  <span>{option.name}</span>
                  <span className="font-mono text-sm opacity-70">{option.code}</span>
                </button>
              );
            })}
            {visible.length === 0 ? <p className="py-3 text-sm opacity-70">No currency found.</p> : null}
          </div>
          {errors.currency ? <span className="text-sm text-red-600 dark:text-red-400">{errors.currency}</span> : null}
        </fieldset>

        <Button type="submit" loading={saving}>
          Create household
        </Button>
      </form>
    </main>
  );
}
