"use client";

import { ArrowLeft, ChartPie, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Money } from "@/components/money";
import { useCurrentUser } from "@/lib/auth-client";
import { localToday } from "@/lib/budget";
import { getCategory } from "@/lib/categories";
import { householdTotals } from "@/lib/family-budget";
import { useMyHousehold } from "@/lib/household";
import { formatMoney } from "@/lib/money";
import type { Household, Member } from "@/lib/model";
import { useHouseholdOverview } from "@/lib/use-budget";
import { MemberBudgetCard } from "../member-budget-card";
import { EmptyState, LoadingScreen } from "@/components/loading";

export function OverviewScreen() {
  const router = useRouter();
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
    else if (auth.status === "signed_in" && household.status === "none") router.replace("/app");
  }, [auth.status, household.status, router]);

  if (auth.status !== "signed_in" || household.status !== "ready") {
    return <LoadingScreen />;
  }
  return <Overview household={household.household} me={household.me} />;
}

function Overview({ household, me }: { household: Household; me: Member }) {
  const overview = useHouseholdOverview(household.id, me.id);
  const currency = household.currency;
  const money = (minor: number) => formatMoney(minor, currency);

  if (!overview) return <LoadingScreen />;

  const totals = householdTotals(overview.budgets);
  const today = localToday();
  const monthName = new Date(`${overview.monthStart}T00:00:00`).toLocaleDateString("en-GB", { month: "long" });
  const largest = overview.monthByCategory[0]?.amountMinor ?? 0;
  const overspent = totals.leftMinor < 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 lg:max-w-5xl lg:px-10 lg:pt-10">
      <header className="flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-black/5 hidden dark:hover:bg-white/10"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Family overview</h1>
          <p className="truncate text-sm opacity-60">{household.name}</p>
        </div>
        <Link
          href="/app/household"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-black/[0.05] px-4 text-sm font-semibold hover:bg-black/[0.08] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
        >
          <UserPlus size={16} aria-hidden /> Members
        </Link>
      </header>

      <section
        aria-label="The whole family"
        className={`rounded-[2rem] p-6 text-white shadow-[0_24px_60px_-24px_rgba(13,148,136,0.65)] lg:p-8 ${
          overspent ? "bg-gradient-to-br from-red-500 via-red-600 to-red-800" : "bg-gradient-to-br from-teal-500 via-teal-700 to-teal-900"
        }`}
      >
        <p className="text-sm font-medium text-white/85">{overspent ? "The family is over budget by" : "Left for the whole family"}</p>
        <p className="mt-1 text-5xl leading-none font-bold tracking-tight whitespace-nowrap">
          <Money minor={Math.abs(totals.leftMinor)} currency={currency} />
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/12 p-3">
            <p className="text-white/80">Per day, together</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{money(totals.perDayMinor)}</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-3">
            <p className="text-white/80">Spent this period</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{money(totals.spentMinor)}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-white/80">
          {totals.withBudget === overview.budgets.length
            ? `Everyone's own pay period, ${totals.withBudget} ${totals.withBudget === 1 ? "person" : "people"}.`
            : `${totals.withBudget} of ${overview.budgets.length} members have set a payday.`}
        </p>
      </section>

      <section aria-labelledby="members-title">
        <h2 id="members-title" className="mb-2 font-semibold">
          Where everyone is
        </h2>
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {overview.budgets.map((entry) => (
            <MemberBudgetCard
              key={entry.member.id}
              entry={entry}
              isMe={entry.member.id === me.id}
              money={money}
              today={today}
              href={`/app/member?id=${entry.member.id}`}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="categories-title" className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="categories-title" className="font-semibold">
            {monthName} by category
          </h2>
          <span className="text-sm tabular-nums opacity-70">{money(overview.monthSpentMinor)}</span>
        </div>
        {overview.monthByCategory.length === 0 ? (
          <EmptyState compact icon={<ChartPie size={20} />}>
            No spending this month yet. Each category shows up here as the family records expenses.
          </EmptyState>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {overview.monthByCategory.map(({ category, amountMinor }) => {
              const { label, color } = getCategory(category);
              const share = overview.monthSpentMinor > 0 ? (amountMinor / overview.monthSpentMinor) * 100 : 0;
              return (
                <li key={category} className="flex items-center gap-3">
                  <span aria-hidden>
                    <CategoryBadge category={category} showLabel={false} size="sm" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{label}</span>
                      <span className="tabular-nums">
                        {money(amountMinor)} <span className="opacity-60">· {share < 1 ? "<1" : Math.round(share)}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
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
    </main>
  );
}
