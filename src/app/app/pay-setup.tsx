"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";
import type { FixedCost, PaySettings } from "@/lib/model";
import { savePaySettings } from "@/lib/pay-settings";

type Row = { key: string; id?: string; name: string; amount: string };

type Props = {
  memberId: string;
  currency: string;
  settings: PaySettings | null;
  fixedCosts: FixedCost[];
  onDone: () => void;
  onCancel?: () => void;
};

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function ordinal(day: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return day + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Parses an amount; returns null when empty, NaN when invalid. */
function parseAmount(value: string, currency: string): number | null {
  if (!value.trim()) return null;
  try {
    const minor = toMinor(value, currency);
    return minor < 0 ? Number.NaN : minor;
  } catch {
    return Number.NaN;
  }
}

function asText(minor: number, currency: string) {
  return String(fromMinor(minor, currency));
}

export function PaySetup({ memberId, currency, settings, fixedCosts, onDone, onCancel }: Props) {
  const [paydayDay, setPaydayDay] = useState(settings?.paydayDay ?? 1);
  const [income, setIncome] = useState(settings ? asText(settings.incomeMinor, currency) : "");
  const [savings, setSavings] = useState(
    settings && settings.savingsGoalMinor > 0 ? asText(settings.savingsGoalMinor, currency) : "",
  );
  const [rows, setRows] = useState<Row[]>(() =>
    fixedCosts.length > 0
      ? fixedCosts.map((c) => ({ key: c.id, id: c.id, name: c.name, amount: asText(c.amountMinor, currency) }))
      : [{ key: crypto.randomUUID(), name: "", amount: "" }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const incomeMinor = parseAmount(income, currency);
  const savingsMinor = parseAmount(savings, currency) ?? 0;
  const fixedTotal = rows.reduce((sum, r) => {
    const v = parseAmount(r.amount, currency);
    return sum + (v && Number.isFinite(v) ? v : 0);
  }, 0);
  const available =
    incomeMinor !== null && Number.isFinite(incomeMinor) && Number.isFinite(savingsMinor)
      ? incomeMinor - fixedTotal - savingsMinor
      : null;

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (incomeMinor === null) next.income = "Enter your income for one pay period";
    else if (!Number.isFinite(incomeMinor)) next.income = "Enter a valid amount";
    if (!Number.isFinite(savingsMinor)) next.savings = "Enter a valid amount";

    const costs: { id?: string; name: string; amountMinor: number }[] = [];
    for (const row of rows) {
      const amount = parseAmount(row.amount, currency);
      const name = row.name.trim();
      if (!name && amount === null) continue;
      if (!name) next[`name-${row.key}`] = "Name this cost";
      if (amount === null || !Number.isFinite(amount)) next[`amount-${row.key}`] = "Enter a valid amount";
      else costs.push({ id: row.id, name: name.slice(0, 60), amountMinor: amount });
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    await savePaySettings({
      memberId,
      paydayDay,
      incomeMinor: incomeMinor as number,
      savingsGoalMinor: savingsMinor,
      fixedCosts: costs,
      previousFixedCosts: fixedCosts,
    });
    setSaving(false);
    onDone();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <h1 className="text-2xl font-semibold">Your payday</h1>
      <p className="mt-2 opacity-80">
        Tell us when you get paid and what goes out every month. We will show what is left to spend until the next payday.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Payday (day of the month)</span>
          <select
            value={paydayDay}
            onChange={(e) => setPaydayDay(Number(e.target.value))}
            className="h-12 rounded-xl border border-black/15 bg-white px-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {ordinal(d)}
              </option>
            ))}
          </select>
          {paydayDay > 28 ? (
            <span className="text-sm opacity-70">In shorter months we use the last day of the month.</span>
          ) : null}
        </label>

        <MoneyInput
          label="Income per pay period"
          name="income"
          currency={currency}
          value={income}
          onChange={setIncome}
          error={errors.income}
          hint="Your take-home pay, after tax."
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Fixed costs</legend>
          <p className="-mt-1 text-sm opacity-70">Rent, utilities, phone, loans: things you pay every period.</p>
          {rows.map((row, index) => (
            <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_7.5rem_2.75rem] items-start gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <input
                  aria-label={`Fixed cost ${index + 1} name`}
                  value={row.name}
                  maxLength={60}
                  placeholder="Rent"
                  onChange={(e) => updateRow(row.key, { name: e.target.value })}
                  className="h-12 w-full min-w-0 rounded-xl border border-black/15 bg-white px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
                />
                {errors[`name-${row.key}`] ? (
                  <span className="text-sm text-red-600 dark:text-red-400">{errors[`name-${row.key}`]}</span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <input
                  aria-label={`Fixed cost ${index + 1} amount in ${currency}`}
                  inputMode="decimal"
                  value={row.amount}
                  placeholder="0"
                  onChange={(e) => updateRow(row.key, { amount: e.target.value.replace(/[^\d.,\s]/g, "") })}
                  className="h-12 w-full min-w-0 rounded-xl border border-black/15 bg-white px-3 text-right tabular-nums outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
                />
                {errors[`amount-${row.key}`] ? (
                  <span className="text-sm text-red-600 dark:text-red-400">{errors[`amount-${row.key}`]}</span>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Remove fixed cost ${index + 1}`}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                className="flex h-12 w-11 items-center justify-center rounded-xl opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), name: "", amount: "" }])}
            className="inline-flex h-11 items-center gap-2 self-start rounded-xl px-3 font-medium text-brand hover:bg-brand/10"
          >
            <Plus size={18} /> Add fixed cost
          </button>
        </fieldset>

        <MoneyInput
          label="Savings goal per period (optional)"
          name="savings"
          currency={currency}
          value={savings}
          onChange={setSavings}
          error={errors.savings}
          placeholder="0"
        />

        {available !== null ? (
          <div className={`rounded-2xl p-4 ${available < 0 ? "bg-red-50 dark:bg-red-950/40" : "bg-brand/10"}`}>
            <p className="text-sm opacity-80">Left to spend each pay period</p>
            <p className={`text-2xl font-semibold tabular-nums ${available < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {formatMoney(available, currency)}
            </p>
            {available < 0 ? (
              <p className="mt-1 text-sm">Your fixed costs and savings are more than your income.</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-3">
          {onCancel ? (
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          ) : null}
          <Button type="submit" loading={saving} className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </main>
  );
}
