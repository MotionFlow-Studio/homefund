"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Household, Member } from "@/lib/model";
import { useFamilyBudgets } from "@/lib/use-budget";

/**
 * Everyone's own "left until payday" and "per day", side by side. Incomes and
 * fixed costs stay private; only these numbers are shown.
 */
export function FamilyBudgets({ household, me }: { household: Household; me: Member }) {
  const budgets = useFamilyBudgets(household.id, me.id);
  if (!budgets || budgets.length < 2) return null;
  const money = (minor: number) => formatMoney(minor, household.currency);

  return (
    <section aria-labelledby="family-title" className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
      <div className="flex items-baseline justify-between">
        <h2 id="family-title" className="font-semibold">
          Family
        </h2>
        <Link href="/app/overview" className="text-sm font-semibold text-brand">
          Overview
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-4">
        {budgets.map(({ member, budget }) => {
          const share =
            budget && budget.availableMinor > 0 ? Math.min(100, (budget.spentMinor / budget.availableMinor) * 100) : 100;
          return (
            <li key={member.id}>
              <div className="flex items-center gap-3">
                <span className="size-8 shrink-0 rounded-full" style={{ backgroundColor: member.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {member.name.split(" ")[0]}
                  {member.id === me.id ? <span className="font-normal opacity-60"> (you)</span> : null}
                </span>
                {budget ? (
                  <span
                    className={`text-right font-semibold tabular-nums ${budget.overspent ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {budget.overspent ? `${money(-budget.leftMinor)} over` : `${money(budget.leftMinor)} left`}
                  </span>
                ) : (
                  <span className="text-sm opacity-60">No payday set yet</span>
                )}
              </div>
              {budget ? (
                <div className="mt-1.5 pl-11">
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${budget.overspent ? "bg-red-500" : ""}`}
                      style={{ width: `${share}%`, backgroundColor: budget.overspent ? undefined : member.color }}
                    />
                  </div>
                  <p className="mt-1 text-xs opacity-70">
                    {budget.overspent ? "Nothing more to spend" : `${money(budget.perDayMinor)} a day`} ·{" "}
                    {budget.daysLeft === 1 ? "payday tomorrow" : `${budget.daysLeft} days to payday`}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
