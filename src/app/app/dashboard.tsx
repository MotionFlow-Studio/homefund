"use client";

import { BarChart3, CalendarDays, Camera, ChartPie, Plus, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Money } from "@/components/money";
import { addDays, localToday } from "@/lib/budget";
import { getCategory } from "@/lib/categories";
import { removeExpense, useHouseholdExpenses, useHouseholdIncomes, useHouseholdMembers } from "@/lib/expenses";
import { getIncomeSource } from "@/lib/income-sources";
import { formatMoney } from "@/lib/money";
import type { Expense, FixedCost, Household, Member, PaySettings } from "@/lib/model";
import { useBudget, useMemberDetail, usePeriodExpenses } from "@/lib/use-budget";
import { dailySpending, forecast } from "@/lib/forecast";
import { DailyBars, Donut, PaceChart, useCountUp } from "@/components/charts";
import { initials } from "./app-shell";
import { ExpenseForm } from "./expense-form";
import { IncomeForm } from "./income-form";
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
  const today0 = localToday();
  const periodExpenses = usePeriodExpenses(me.id, addDays(today0, -40), today0);
  const shownLeft = useCountUp(budget ? Math.abs(budget.leftMinor) : 0);
  const detail = useMemberDetail(household.id, me.id, me.id);
  const [adding, setAdding] = useState<"expense" | "income" | null>(null);
  const expensesLive = useHouseholdExpenses(household.id);
  const incomesLive = useHouseholdIncomes(household.id);
  const recent = [
    ...(expensesLive ?? []).slice(0, 8).map((e) => ({ kind: "expense" as const, date: e.spentOn, createdAt: e.createdAt, e })),
    ...(incomesLive ?? []).slice(0, 8).map((i) => ({ kind: "income" as const, date: i.receivedOn, createdAt: i.createdAt, i })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7);
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
  const fc = forecast(budget, periodExpenses ?? [], today);
  const lastTwoWeeks = dailySpending(periodExpenses ?? [], addDays(today, -13), today);
  const dateLine = new Date(`${today}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  if (adding === "expense") {
    return (
      <ExpenseForm
        household={household}
        me={me}
        members={members}
        onClose={() => setAdding(null)}
        onSaved={(expense) => {
          setAdding(null);
          setSaved({ expense, until: Date.now() + 6000 });
        }}
        onSwitchToIncome={() => setAdding("income")}
      />
    );
  }
  if (adding === "income") {
    return (
      <IncomeForm
        household={household}
        me={me}
        members={members}
        onClose={() => setAdding(null)}
        onSaved={() => setAdding(null)}
        onSwitchToExpense={() => setAdding("expense")}
      />
    );
  }

  const actions = (
    <>
      <Link
        href="/app/scan"
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-500 px-5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(13,148,136,0.7)] transition hover:brightness-110 active:scale-[0.98]"
      >
        <Camera size={20} aria-hidden /> Scan receipt
      </Link>
      <button
        type="button"
        onClick={() => setAdding("expense")}
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
          className={`relative overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_28px_60px_-24px_rgba(79,70,229,0.55)] [container-type:inline-size] lg:col-span-7 lg:p-8 ${
            budget.overspent
              ? "bg-gradient-to-br from-red-500 via-red-600 to-red-800 shadow-red-600/30"
              : "bg-gradient-to-br from-teal-400 via-cyan-600 to-indigo-600"
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
            <Money minor={shownLeft} currency={currency} />
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
              {budget.extraIncomeMinor > 0 ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  +{money(budget.extraIncomeMinor)} extra income
                </span>
              ) : null}
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

        <section aria-labelledby="forecast-title" className="card flex flex-col p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="forecast-title" className="flex items-center gap-2 font-semibold">
              <TrendingUp size={18} className="text-teal-500" aria-hidden /> Payday forecast
            </h2>
            <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-medium dark:bg-white/10">
              day {fc.daysElapsed} of {fc.periodDays}
            </span>
          </div>
          {fc.runsOutOn ? (
            <p className="mt-3 text-lg leading-snug font-semibold text-rose-600 dark:text-rose-400">
              At this pace your money runs out on {paydayLabel(fc.runsOutOn)}.
            </p>
          ) : (
            <p className="mt-3 text-lg leading-snug font-semibold">
              At this pace you&apos;ll have{" "}
              <span className="text-emerald-600 dark:text-emerald-400">{money(Math.max(0, fc.projectedLeftMinor))}</span> left on payday.
            </p>
          )}
          <p className="mt-1 text-sm opacity-60">
            You spend about {money(fc.averagePerDayMinor)} a day
            {fc.aheadOfPaceMinor > 0 ? `, ${money(fc.aheadOfPaceMinor)} ahead of an even pace.` : `, ${money(-fc.aheadOfPaceMinor)} under an even pace.`}
          </p>
          <div className="mt-auto pt-4 text-black/70 dark:text-white/70">
            <PaceChart
              cumulative={fc.cumulative}
              even={fc.even}
              projectedEnd={fc.projectedSpentMinor}
              budget={Math.max(0, budget.availableMinor)}
              over={fc.runsOutOn !== null}
            />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-70">
              <span className="flex items-center gap-1.5"><span className={`h-0.5 w-4 rounded ${fc.runsOutOn ? "bg-rose-500" : "bg-teal-500"}`} aria-hidden /> Spent so far</span>
              <span className="flex items-center gap-1.5"><span className={`h-0.5 w-4 rounded border-t-2 border-dashed ${fc.runsOutOn ? "border-rose-500" : "border-teal-500"}`} aria-hidden /> Your pace</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-current opacity-40" aria-hidden /> Even pace</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="daily-title" className="card p-6 lg:col-span-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="daily-title" className="flex items-center gap-2 font-semibold">
              <BarChart3 size={18} className="text-cyan-500" aria-hidden /> Last 14 days
            </h2>
            <span className="text-sm opacity-60">dashed line: even daily amount</span>
          </div>
          <div className="mt-5 text-black/70 dark:text-white/70">
            <DailyBars
              days={lastTwoWeeks}
              allowance={Math.max(0, Math.round(budget.availableMinor / fc.periodDays))}
              labels={(d) => (d ? dayLabel(d, today) : "")}
              money={money}
            />
          </div>
        </section>

        <section aria-labelledby="categories-title" className="card flex flex-col p-6 lg:col-span-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="categories-title" className="flex items-center gap-2 font-semibold">
              <ChartPie size={18} className="text-violet-500" aria-hidden /> Where your money went
            </h2>
            <span className="text-sm opacity-60">since payday</span>
          </div>
          {byCategory.length === 0 ? (
            <EmptyState compact icon={<ChartPie size={20} />}>
              Your spending by category shows up here as you add expenses.
            </EmptyState>
          ) : (
            <div className="mt-4 flex items-center gap-5">
              <Donut
                parts={byCategory.map((c) => ({ color: getCategory(c.category).color, value: c.amountMinor, label: c.category }))}
                center={money(byCategory.reduce((sum, c) => sum + c.amountMinor, 0))}
                caption="spent"
              />
              <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                {byCategory.slice(0, 5).map(({ category, amountMinor }) => {
                  const { label, color } = getCategory(category);
                  return (
                    <li key={category} className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <span className="font-semibold tabular-nums">{money(amountMinor)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
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
            <h2 className="font-semibold">Recent activity</h2>
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
              {recent.map((entry) => {
                if (entry.kind === "income") {
                  const src = getIncomeSource(entry.i.source);
                  const Icon = src.icon;
                  const payer = memberById.get(entry.i.memberId);
                  return (
                    <li key={`i-${entry.i.id}`} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${src.color}1f`, color: src.color }} aria-hidden>
                        <Icon size={20} strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{entry.i.note || src.label}</span>
                        <span className="flex items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap opacity-60">
                          {dayLabel(entry.date, today)} · Income
                          {payer && members.length > 1 ? ` · ${payer.id === me.id ? "You" : payer.name.split(" ")[0]}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">+{money(entry.i.amountMinor)}</span>
                    </li>
                  );
                }
                const e = entry.e;
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
                    <span className="shrink-0 font-semibold tabular-nums">−{money(e.amountMinor)}</span>
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
