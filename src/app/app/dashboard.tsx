"use client";

import { CalendarDays, Camera, ChartPie, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Money } from "@/components/money";
import { addDays, localToday } from "@/lib/budget";
import { getCategory } from "@/lib/categories";
import { removeExpense, useHouseholdExpenses, useHouseholdMembers } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import type { Expense, FixedCost, Household, Member, PaySettings } from "@/lib/model";
import { useBudget, useMemberDetail } from "@/lib/use-budget";
import { initials } from "./app-shell";
import { ExpenseForm } from "./expense-form";
import { FamilyBudgets } from "./family-budgets";
import { EmptyState, HomeSkeleton } from "@/components/loading";

type Props = {
  household: Household;
  me: Member;
  settings: PaySettings;
  fixedCosts: FixedCost[];
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

function greeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function Dashboard({ household, me, settings, fixedCosts }: Props) {
  const budget = useBudget(me.id, settings, fixedCosts);
  const detail = useMemberDetail(household.id, me.id, me.id);
  const [adding, setAdding] = useState(false);
  const recent = (useHouseholdExpenses(household.id) ?? []).slice(0, 6);
  // The "Saved" note with its undo, and when it goes away. The deadline is kept
  // with it so the note does not come back when the user returns to this screen.
  const [saved, setSaved] = useState<{ expense: Expense; until: number } | null>(null);
  const lastSaved = saved?.expense ?? null;
  const members = useHouseholdMembers(household.id) ?? [];
  const memberById = new Map(members.map((m) => [m.id, m]));
  const today = localToday();

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(null), Math.max(0, saved.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (!budget) {
    return <HomeSkeleton />;
  }

  const currency = household.currency;
  const money = (minor: number) => formatMoney(minor, currency);
  const spentShare =
    budget.availableMinor > 0 ? Math.min(100, (budget.spentMinor / budget.availableMinor) * 100) : 100;
  const byCategory = detail?.byCategory ?? [];
  const largest = byCategory[0]?.amountMinor ?? 0;
  const dateLine = new Date(`${today}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  if (adding) {
    return (
      <ExpenseForm
        household={household}
        me={me}
        onClose={() => setAdding(false)}
        onSaved={(expense) => {
          setAdding(false);
          setSaved({ expense, until: Date.now() + 6000 });
        }}
      />
    );
  }

  const actions = (
    <>
      <Link
        href="/app/scan"
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-teal-500 to-teal-700 px-5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(13,148,136,0.7)] transition hover:brightness-110 active:scale-[0.98]"
      >
        <Camera size={20} aria-hidden /> Scan receipt
      </Link>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-teal-50"
      >
        <Plus size={20} aria-hidden /> Add expense
      </button>
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 lg:max-w-6xl lg:gap-6 lg:px-10 lg:pt-10 lg:pb-12">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm opacity-60">
            <span className="lg:hidden">{household.name}</span>
            <span className="hidden lg:inline">{dateLine}</span>
          </p>
          <h1 className="truncate text-2xl font-bold tracking-tight lg:text-3xl">
            <span suppressHydrationWarning>{greeting(new Date().getHours())}</span>, {me.name.split(" ")[0]}
          </h1>
        </div>
        <div className="hidden shrink-0 gap-3 lg:flex">{actions}</div>
        <Link
          href="/app/settings"
          aria-label="Settings"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm lg:hidden"
          style={{ backgroundColor: me.color }}
        >
          {initials(me.name)}
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section
          aria-label="Your budget"
          className={`relative overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_24px_60px_-24px_rgba(13,148,136,0.65)] [container-type:inline-size] lg:col-span-7 lg:p-8 ${
            budget.overspent
              ? "bg-gradient-to-br from-red-500 via-red-600 to-red-800 shadow-red-600/30"
              : "bg-gradient-to-br from-teal-500 via-teal-700 to-teal-900"
          }`}
        >
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-white/10 blur-sm" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-amber-300/10 blur-2xl" />

          <p className="relative text-sm font-medium text-white/85">{budget.overspent ? "Over budget by" : "Left until payday"}</p>
          <p
            aria-live="polite"
            className="relative mt-1 whitespace-nowrap font-bold leading-none tracking-tight"
            style={{ fontSize: fitSize(digits(money(Math.abs(budget.leftMinor))), 4.5) }}
          >
            <Money minor={Math.abs(budget.leftMinor)} currency={currency} />
          </p>

          <div className="relative mt-6">
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

          <div className="relative mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm [container-type:inline-size]">
              <p className="text-sm text-white/80">Per day</p>
              {budget.overspent ? (
                <p className="mt-1 text-xl font-bold">Nothing left</p>
              ) : (
                <p
                  aria-live="polite"
                  className="mt-1 whitespace-nowrap font-bold leading-none tracking-tight"
                  style={{ fontSize: fitSize(digits(money(budget.perDayMinor)), 2.25) }}
                >
                  <Money minor={budget.perDayMinor} currency={currency} />
                </p>
              )}
              <p className="mt-1.5 text-xs text-white/75">{budget.overspent ? "until payday" : "to stay on budget"}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-sm text-white/80">
                <CalendarDays size={14} aria-hidden /> Payday
              </p>
              <p className="mt-1 text-[2.25rem] leading-none font-bold tracking-tight">
                <span className="tabular-nums">{budget.daysLeft}</span>
                <span className="ml-1 text-base font-semibold">{budget.daysLeft === 1 ? "day" : "days"}</span>
              </p>
              <p className="mt-1.5 text-xs text-white/75">{paydayLabel(budget.nextPayday)}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:hidden">{actions}</div>

        <section aria-labelledby="categories-title" className="card flex flex-col p-6 lg:col-span-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="categories-title" className="font-semibold">
              Where your money went
            </h2>
            <span className="text-sm tabular-nums opacity-60">since payday</span>
          </div>
          {byCategory.length === 0 ? (
            <EmptyState compact icon={<ChartPie size={20} />}>
              Your spending by category shows up here as you add expenses.
            </EmptyState>
          ) : (
            <ul className="mt-5 flex flex-col gap-3.5">
              {byCategory.slice(0, 6).map(({ category, amountMinor }) => {
                const { label, color } = getCategory(category);
                return (
                  <li key={category} className="flex items-center gap-3">
                    <span aria-hidden>
                      <CategoryBadge category={category} showLabel={false} size="sm" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{label}</span>
                        <span className="font-semibold tabular-nums">{money(amountMinor)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${largest ? (amountMinor / largest) * 100 : 0}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {budget.availableMinor < 0 ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 lg:col-span-12 dark:bg-red-950/40 dark:text-red-300">
            Your fixed costs and savings are {money(-budget.availableMinor)} more than your income. Check them in{" "}
            <Link href="/app/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        ) : budget.overspent ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 lg:col-span-12 dark:bg-red-950/40 dark:text-red-300">
            You are {money(-budget.leftMinor)} over budget. Try to hold off on spending until {paydayLabel(budget.nextPayday)}.
          </p>
        ) : budget.availableMinor === 0 ? (
          <p className="card p-4 text-sm lg:col-span-12">
            Add your income in{" "}
            <Link href="/app/settings" className="font-semibold text-brand">
              Settings
            </Link>{" "}
            to see what you can spend.
          </p>
        ) : null}

        <div className="lg:col-span-7">
          <FamilyBudgets household={household} me={me} />
        </div>

        <section aria-label="Recent expenses" className="card p-6 lg:col-span-5 lg:row-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Recent expenses</h2>
            <Link href="/app/expenses" className="text-sm font-semibold text-brand">
              See all
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState compact icon={<Receipt size={20} />}>
              Nothing yet. Scan a receipt or add an expense, and it shows up here.
            </EmptyState>
          ) : (
            <ul className="mt-3 flex flex-col">
              {recent.map((e) => {
                const payer = memberById.get(e.memberId);
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span aria-hidden={!e.note && !e.merchant}>
                      <CategoryBadge category={e.category} showLabel={false} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.note || e.merchant || getCategory(e.category).label}</span>
                      <span className="flex items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap opacity-60">
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
      </div>

      {lastSaved ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-8 lg:left-64">
          <div
            role="status"
            className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-2xl dark:bg-neutral-100 dark:text-neutral-900"
          >
            <span>Saved {money(lastSaved.amountMinor)}</span>
            <button
              type="button"
              onClick={async () => {
                const id = lastSaved.id;
                setSaved(null);
                await removeExpense(id);
              }}
              className="font-semibold text-accent"
            >
              Undo
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
