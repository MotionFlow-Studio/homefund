"use client";

import { UserPlus } from "lucide-react";
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
  if (!budgets) return null;
  if (budgets.length < 2) {
    // Alone in the household: point the owner to inviting their partner.
    if (me.role !== "owner") return null;
    return (
      <Link
        href="/app/household"
        className="flex items-center gap-4 rounded-3xl border border-dashed border-brand/40 p-5 transition hover:bg-brand/5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand" aria-hidden>
          <UserPlus size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Budget together</span>
          <span className="block text-sm opacity-70">Invite your partner to see each other&apos;s numbers.</span>
        </span>
      </Link>
    );
  }
  const money = (minor: number) => formatMoney(minor, household.currency);

  return (
    <section aria-labelledby="family-title" className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="family-title" className="font-semibold">
          Family
        </h2>
        <Link href="/app/overview" className="text-sm font-semibold text-brand">
          Overview
        </Link>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {budgets.map(({ member, budget }) => {
          const share =
            budget && budget.availableMinor > 0
              ? Math.min(100, (budget.spentMinor / budget.availableMinor) * 100)
              : 100;
          return (
            <li key={member.id}>
              <Link
                href={`/app/member?id=${member.id}`}
                className="-mx-2 block rounded-2xl px-2 py-1.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="size-8 shrink-0 rounded-full"
                    style={{ backgroundColor: member.color }}
                    aria-hidden
                  />
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
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
