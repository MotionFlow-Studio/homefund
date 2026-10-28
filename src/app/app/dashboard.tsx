"use client";

import { CalendarDays, Camera, ChartPie, LogOut, Plus, Receipt, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Money } from "@/components/money";
import { addDays, localToday } from "@/lib/budget";
import { getCategory } from "@/lib/categories";
import { removeExpense, useHouseholdExpenses, useHouseholdMembers } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import type { Expense, FixedCost, Household, Member, PaySettings } from "@/lib/model";
import { useBudget } from "@/lib/use-budget";
import { ExpenseForm } from "./expense-form";
import { FamilyBudgets } from "./family-budgets";
import { EmptyState, HomeSkeleton } from "@/components/loading";

type Props = {
  household: Household;
  me: Member;
  settings: PaySettings;
  fixedCosts: FixedCost[];
  onSignOut: () => void;
  signingOut: boolean;
};

/**
 * Font size that keeps an amount on one line: as large as maxRem allows,
 * smaller for long amounts, measured against the card width (container units).
 * `text` is the amount without its symbol; room for the small symbol is added.
 */
function fitSize(text: string, maxRem: number) {
  const width = text.length * 0.62 + 1.2;
  return `min(${maxRem}rem, calc(100cqw / ${width.toFixed(2)}))`;
}

/** The amount without its currency symbol, which is set much smaller and takes little room. */
function digits(amount: string) {
  return amount.replace(/[^\d.,\s-]/g, "").trim();
}

function paydayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function Dashboard({ household, me, settings, fixedCosts, onSignOut, signingOut }: Props) {
  const budget = useBudget(me.id, settings, fixedCosts);
  const [adding, setAdding] = useState(false);
  const recent = (useHouseholdExpenses(household.id) ?? []).slice(0, 5);
  const [lastSaved, setLastSaved] = useState<Expense | null>(null);
  const members = useHouseholdMembers(household.id) ?? [];
  const memberById = new Map(members.map((m) => [m.id, m]));
  const today = localToday();

  useEffect(() => {
    if (!lastSaved) return;
    const timer = window.setTimeout(() => setLastSaved(null), 6000);
    return () => window.clearTimeout(timer);
  }, [lastSaved]);

  if (!budget) {
    return <HomeSkeleton />;
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
            <Link
              href="/app/settings"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Settings2 size={18} /> Settings
            </Link>
            <Link
              href="/app/household"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Users size={18} /> Family and invites
            </Link>
            <Link
              href="/app/overview"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ChartPie size={18} /> Family overview
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
        className={`relative overflow-hidden rounded-[2rem] p-6 text-white shadow-lg shadow-brand/20 [container-type:inline-size] ${
          budget.overspent
            ? "bg-gradient-to-br from-red-600 to-red-700 shadow-red-600/20"
            : "bg-gradient-to-br from-brand to-brand-strong"
        }`}
      >
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10" />

        <p className="relative text-sm font-medium text-white/85">
          {budget.overspent ? "Over budget by" : "Left until payday"}
        </p>
        <p
          aria-live="polite"
          className="relative mt-1 whitespace-nowrap font-bold leading-none tracking-tight"
          style={{ fontSize: fitSize(digits(money(Math.abs(budget.leftMinor))), 3.75) }}
        >
          <Money minor={Math.abs(budget.leftMinor)} currency={currency} />
        </p>

        <div className="relative mt-5">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-label="Share of this period's budget spent"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(spentShare)}
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${spentShare}%` }} />
          </div>
          <p className="mt-2 text-sm text-white/80 tabular-nums">
            {budget.availableMinor > 0
              ? `${money(budget.spentMinor)} spent of ${money(budget.availableMinor)}`
              : `${money(budget.spentMinor)} spent`}
          </p>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 p-3.5 [container-type:inline-size]">
            <p className="text-sm text-white/80">Per day</p>
            {budget.overspent ? (
              <p className="mt-1 text-xl font-bold">Nothing left</p>
            ) : (
              <p
                aria-live="polite"
                className="mt-1 whitespace-nowrap font-bold leading-none tracking-tight"
                style={{ fontSize: fitSize(digits(money(budget.perDayMinor)), 1.75) }}
              >
                <Money minor={budget.perDayMinor} currency={currency} />
              </p>
            )}
            <p className="mt-1 text-xs text-white/75">{budget.overspent ? "until payday" : "to stay on budget"}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3.5">
            <p className="flex items-center gap-1.5 text-sm text-white/80">
              <CalendarDays size={14} aria-hidden /> Payday
            </p>
            <p className="mt-1 text-[1.75rem] leading-none font-bold tracking-tight">
              <span className="tabular-nums">{budget.daysLeft}</span>
              <span className="ml-1 text-base font-semibold">{budget.daysLeft === 1 ? "day" : "days"}</span>
            </p>
            <p className="mt-1 text-xs text-white/75">{paydayLabel(budget.nextPayday)}</p>
          </div>
        </div>
      </section>

      {budget.availableMinor < 0 ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Your fixed costs and savings are {money(-budget.availableMinor)} more than your income. Check them in{" "}
          <Link href="/app/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      ) : budget.overspent ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
          You are {money(-budget.leftMinor)} over budget. Try to hold off on spending until {paydayLabel(budget.nextPayday)}.
        </p>
      ) : budget.availableMinor === 0 ? (
        <p className="rounded-2xl bg-black/[0.04] p-4 text-sm dark:bg-white/[0.06]">
          Add your income in{" "}
          <Link href="/app/settings" className="font-semibold text-brand">
            Settings
          </Link>{" "}
          to see what you can spend.
        </p>
      ) : null}

      <FamilyBudgets household={household} me={me} />

      <section aria-label="Recent expenses" className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Recent expenses</h2>
          <Link href="/app/expenses" className="text-sm font-semibold text-brand">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState compact icon={<Receipt size={20} />}>
            Nothing yet. Scan a receipt or add an expense with the buttons below, and it shows up here.
          </EmptyState>
        ) : (
          <ul className="mt-2 flex flex-col">
            {recent.map((e) => {
              const payer = memberById.get(e.memberId);
              return (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <span aria-hidden={!e.note && !e.merchant}>
                    <CategoryBadge category={e.category} showLabel={false} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.note || e.merchant || getCategory(e.category).label}</span>
                    <span className="flex items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap opacity-65">
                      {dayLabel(e.spentOn, today)}
                      {payer && members.length > 1 ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="size-2 rounded-full" style={{ backgroundColor: payer.color }} aria-hidden />
                          {payer.id === me.id ? "You" : payer.name.split(" ")[0]}
                        </>
                      ) : null}
                      {e.source === "receipt" ? (
                        <>
                          <span aria-hidden>·</span>
                          <Receipt size={12} aria-hidden /> Receipt
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(e.amountMinor)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background from-55% to-transparent pt-12">
        <div className="mx-auto flex max-w-md flex-col items-stretch gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
          <div className="pointer-events-auto grid grid-cols-2 gap-3">
            <Link
              href="/app/scan"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-strong active:scale-[0.98]"
            >
              <Camera size={22} aria-hidden /> Scan receipt
            </Link>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-lg font-semibold text-white shadow-lg transition active:scale-[0.98] dark:bg-neutral-800"
            >
              <Plus size={22} aria-hidden /> Add expense
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
