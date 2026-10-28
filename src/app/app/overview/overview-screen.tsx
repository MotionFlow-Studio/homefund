"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Money } from "@/components/money";
import { useCurrentUser } from "@/lib/auth-client";
import { localToday } from "@/lib/budget";
import { getCategory } from "@/lib/categories";
import { expectedShare, householdTotals, pace, type MemberBudget, type Pace } from "@/lib/family-budget";
import { useMyHousehold } from "@/lib/household";
import { formatMoney } from "@/lib/money";
import type { Household, Member } from "@/lib/model";
import { useHouseholdOverview } from "@/lib/use-budget";

export function OverviewScreen() {
  const router = useRouter();
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
    else if (auth.status === "signed_in" && household.status === "none") router.replace("/app");
  }, [auth.status, household.status, router]);

  if (auth.status !== "signed_in" || household.status !== "ready") {
    return <main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>;
  }
  return <Overview household={household.household} me={household.me} />;
}

const PACE_LABEL: Record<Pace, string> = {
  on_track: "On track",
  spending_fast: "Spending fast",
  over_budget: "Over budget",
};

const PACE_STYLE: Record<Pace, string> = {
  on_track: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  spending_fast: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  over_budget: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
};

function paydayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function Overview({ household, me }: { household: Household; me: Member }) {
  const overview = useHouseholdOverview(household.id, me.id);
  const currency = household.currency;
  const money = (minor: number) => formatMoney(minor, currency);

  if (!overview) return <main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>;

  const totals = householdTotals(overview.budgets);
  const today = localToday();
  const monthName = new Date(`${overview.monthStart}T00:00:00`).toLocaleDateString("en-GB", { month: "long" });
  const largest = overview.monthByCategory[0]?.amountMinor ?? 0;
  const overspent = totals.leftMinor < 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Family overview</h1>
          <p className="truncate text-sm opacity-60">{household.name}</p>
        </div>
      </header>

      <section
        aria-label="The whole family"
        className={`rounded-[2rem] p-6 text-white shadow-sm ${
          overspent ? "bg-gradient-to-br from-red-600 to-red-700" : "bg-gradient-to-br from-brand to-brand-strong"
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
        <ul className="flex flex-col gap-3">
          {overview.budgets.map((entry) => (
            <MemberCard key={entry.member.id} entry={entry} isMe={entry.member.id === me.id} money={money} today={today} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="categories-title" className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="categories-title" className="font-semibold">
            {monthName} by category
          </h2>
          <span className="text-sm tabular-nums opacity-70">{money(overview.monthSpentMinor)}</span>
        </div>
        {overview.monthByCategory.length === 0 ? (
          <p className="mt-3 text-sm opacity-70">No spending this month yet.</p>
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

function MemberCard({
  entry: { member, budget },
  isMe,
  money,
  today,
}: {
  entry: MemberBudget;
  isMe: boolean;
  money: (minor: number) => string;
  today: string;
}) {
  const name = (
    <span className="min-w-0 flex-1 truncate font-semibold">
      {member.name}
      {isMe ? <span className="font-normal opacity-60"> (you)</span> : null}
    </span>
  );

  if (!budget) {
    return (
      <li className="flex items-center gap-3 rounded-3xl border border-black/10 p-4 dark:border-white/10">
        <span className="size-9 shrink-0 rounded-full" style={{ backgroundColor: member.color }} aria-hidden />
        {name}
        <span className="text-sm opacity-60">No payday set yet</span>
      </li>
    );
  }

  const status = pace(budget, today);
  const spent = budget.availableMinor > 0 ? Math.min(100, (budget.spentMinor / budget.availableMinor) * 100) : 100;
  const expected = expectedShare(budget, today) * 100;

  return (
    <li className="rounded-3xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center gap-3">
        <span className="size-9 shrink-0 rounded-full" style={{ backgroundColor: member.color }} aria-hidden />
        {name}
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PACE_STYLE[status]}`}>{PACE_LABEL[status]}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs opacity-60">{budget.overspent ? "Over by" : "Left"}</p>
          <p className={`font-semibold tabular-nums ${budget.overspent ? "text-red-600 dark:text-red-400" : ""}`}>
            {money(Math.abs(budget.leftMinor))}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-60">Per day</p>
          <p className="font-semibold tabular-nums">{money(budget.perDayMinor)}</p>
        </div>
      </div>
      <div
        className="relative mt-3 h-2 rounded-full bg-black/10 dark:bg-white/10"
        role="img"
        aria-label={`Spent ${Math.round(spent)}% of the budget, ${Math.round(expected)}% of the pay period has passed`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${spent}%`, backgroundColor: budget.overspent ? "#dc2626" : member.color }}
        />
        <span
          className="absolute -top-1 h-4 w-0.5 rounded-full bg-neutral-900 dark:bg-neutral-100"
          style={{ left: `calc(${expected}% - 1px)` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-xs opacity-70">
        {money(budget.spentMinor)} of {money(budget.availableMinor)} spent · payday {paydayLabel(budget.nextPayday)} (
        {budget.daysLeft} {budget.daysLeft === 1 ? "day" : "days"})
      </p>
    </li>
  );
}
