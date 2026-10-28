"use client";

import { CalendarDays, Camera, LogOut, Plus, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { getCategory } from "@/lib/categories";
import { Money } from "@/components/money";
import { formatMoney } from "@/lib/money";

/**
 * Font size that keeps an amount on one line: as large as maxRem allows,
 * smaller for long amounts, measured against the card width (container units).
 */
function fitSize(text: string, maxRem: number) {
  const width = text.length * 0.62 + 0.4;
  return `min(${maxRem}rem, calc(100cqw / ${width.toFixed(2)}))`;
}
import { removeExpense, useHouseholdExpenses } from "@/lib/expenses";
import type { Expense, FixedCost, Household, Member, PaySettings } from "@/lib/model";
import { useBudget } from "@/lib/use-budget";
import { ExpenseForm } from "./expense-form";

type Props = {
  household: Household;
  me: Member;
  settings: PaySettings;
  fixedCosts: FixedCost[];
  onEditPay: () => void;
  onSignOut: () => void;
  signingOut: boolean;
};

function paydayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function Dashboard({ household, me, settings, fixedCosts, onEditPay, onSignOut, signingOut }: Props) {
  const budget = useBudget(me.id, settings, fixedCosts);
  const [adding, setAdding] = useState(false);
  const recent = (useHouseholdExpenses(household.id) ?? []).slice(0, 5);
  const [lastSaved, setLastSaved] = useState<Expense | null>(null);

  useEffect(() => {
    if (!lastSaved) return;
    const timer = window.setTimeout(() => setLastSaved(null), 6000);
    return () => window.clearTimeout(timer);
  }, [lastSaved]);

  if (!budget) {
    return <main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>;
  }

  const currency = household.currency;
  const money = (minor: number) => formatMoney(minor, currency);
  const spentShare =
    budget.availableMinor > 0 ? Math.min(100, (budget.spentMinor / budget.availableMinor) * 100) : 100;
  const initials = me.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (adding) {
    return (
      <ExpenseForm
        household={household}
        me={me}
        onClose={() => setAdding(false)}
        onSaved={(expense) => {
          setAdding(false);
          setLastSaved(expense);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm opacity-70">{household.name}</p>
          <h1 className="truncate text-xl font-semibold">Hi {me.name.split(" ")[0]}</h1>
        </div>
        <details className="group relative">
          <summary
            aria-label="Account menu"
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-sm font-semibold text-white [&::-webkit-details-marker]:hidden"
            style={{ backgroundColor: me.color }}
          >
            {initials}
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-60 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-neutral-900">
            <button
              type="button"
              onClick={onEditPay}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Settings2 size={18} /> Payday and costs
            </button>
            <Link
              href="/app/household"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Users size={18} /> Family and invites
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10"
            >
              <LogOut size={18} /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </details>
      </header>

      <section
        aria-label="Your budget"
        className={`rounded-[2rem] p-6 text-white shadow-sm [container-type:inline-size] ${
          budget.overspent ? "bg-gradient-to-br from-red-600 to-red-700" : "bg-gradient-to-br from-brand to-brand-strong"
        }`}
      >
        <p className="text-sm font-medium text-white/85">Left until payday</p>
        <p
          aria-live="polite"
          className="mt-1 whitespace-nowrap font-bold leading-none tracking-tight"
          style={{ fontSize: fitSize(money(budget.leftMinor), 3.75) }}
        >
          <Money minor={budget.leftMinor} currency={currency} />
        </p>

        <div className="mt-6 rounded-2xl bg-white/15 p-4 [container-type:inline-size]">
          <p className="text-sm font-medium text-white/85">You can spend per day</p>
          {budget.overspent ? (
            <p className="mt-1 text-2xl font-bold">Over budget</p>
          ) : (
            <p
              aria-live="polite"
              className="mt-1 whitespace-nowrap font-bold leading-none tracking-tight"
              style={{ fontSize: fitSize(money(budget.perDayMinor), 2.75) }}
            >
              <Money minor={budget.perDayMinor} currency={currency} />
            </p>
          )}
        </div>

        <p className="mt-5 flex items-center gap-2 text-base font-medium">
          <CalendarDays size={18} aria-hidden />
          <span>
            <span className="tabular-nums">{budget.daysLeft}</span> {budget.daysLeft === 1 ? "day" : "days"} to payday
            <span className="text-white/75"> · {paydayLabel(budget.nextPayday)}</span>
          </span>
        </p>
      </section>

      <section aria-label="This pay period" className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">This pay period</h2>
          <p className="text-sm tabular-nums opacity-70">
            {budget.availableMinor > 0 ? `${money(budget.spentMinor)} of ${money(budget.availableMinor)}` : money(budget.spentMinor)}
          </p>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          role="progressbar"
          aria-label="Share of this period's budget spent"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(spentShare)}
        >
          <div
            className={`h-full rounded-full ${budget.overspent ? "bg-red-500" : "bg-brand"}`}
            style={{ width: `${spentShare}%` }}
          />
        </div>

        {budget.availableMinor < 0 ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Your fixed costs and savings are {money(-budget.availableMinor)} more than your income. Check them under
            “Payday and costs”.
          </p>
        ) : budget.overspent ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            You are {money(-budget.leftMinor)} over budget. Try to hold off on spending until{" "}
            {paydayLabel(budget.nextPayday)}.
          </p>
        ) : budget.availableMinor === 0 ? (
          <p className="mt-4 text-sm opacity-80">Add your income under “Payday and costs” to see what you can spend.</p>
        ) : null}
      </section>
      <section aria-label="Recent expenses" className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Recent expenses</h2>
          <Link href="/app/expenses" className="text-sm font-semibold text-brand">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm opacity-70">Nothing yet. Scan a receipt or tap “Add expense” to record your first one.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-1.5">
                <CategoryBadge category={e.category} showLabel={false} size="sm" />
                <span className="min-w-0 flex-1 truncate">{e.note || e.merchant || getCategory(e.category).label}</span>
                <span className="shrink-0 font-medium tabular-nums">{money(e.amountMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col items-stretch gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {lastSaved ? (
          <div
            role="status"
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
          >
            <span>Saved {money(lastSaved.amountMinor)}</span>
            <button
              type="button"
              onClick={async () => {
                const id = lastSaved.id;
                setLastSaved(null);
                await removeExpense(id);
              }}
              className="font-semibold text-accent"
            >
              Undo
            </button>
          </div>
        ) : null}
        <div className="pointer-events-auto grid grid-cols-[auto_1fr] gap-3">
          <Link
            href="/app/scan"
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 text-lg font-semibold text-white shadow-lg transition active:scale-[0.98] dark:bg-neutral-100 dark:text-neutral-900"
          >
            <Camera size={22} aria-hidden /> Scan
          </Link>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-white shadow-lg transition hover:bg-brand-strong active:scale-[0.98]"
          >
            <Plus size={22} aria-hidden /> Add expense
          </button>
        </div>
      </div>
    </main>
  );
}
