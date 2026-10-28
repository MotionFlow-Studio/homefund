"use client";

import Link from "next/link";
import { expectedShare, pace, type MemberBudget, type Pace } from "@/lib/family-budget";

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

export function paydayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * One member's budget: left, per day, pace, and a bar of spending with a mark
 * where an even pace would be today. Links to the member's page when `href`
 * is given.
 */
export function MemberBudgetCard({
  entry: { member, budget },
  isMe,
  money,
  today,
  href,
  as: Tag = "li",
  showName = true,
}: {
  entry: MemberBudget;
  isMe: boolean;
  money: (minor: number) => string;
  today: string;
  href?: string;
  as?: "li" | "div";
  /** Off on the member's own page, where the name is already the title. */
  showName?: boolean;
}) {
  const dot = showName ? (
    <span className="size-9 shrink-0 rounded-full" style={{ backgroundColor: member.color }} aria-hidden />
  ) : null;
  const name = showName ? (
    <span className="min-w-0 flex-1 truncate font-semibold">
      {member.name}
      {isMe ? <span className="font-normal opacity-60"> (you)</span> : null}
    </span>
  ) : (
    <span className="min-w-0 flex-1 font-semibold">This pay period</span>
  );

  if (!budget) {
    return (
      <Tag>
        <Frame href={href} className="flex items-center gap-3">
          {dot}
          {name}
          <span className="text-sm opacity-60">No payday set yet</span>
        </Frame>
      </Tag>
    );
  }

  const status = pace(budget, today);
  const spent = budget.availableMinor > 0 ? Math.min(100, (budget.spentMinor / budget.availableMinor) * 100) : 100;
  const expected = expectedShare(budget, today) * 100;

  return (
    <Tag>
      <Frame href={href}>
        <div className="flex items-center gap-3">
          {dot}
          {name}
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PACE_STYLE[status]}`}>
            {PACE_LABEL[status]}
          </span>
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
      </Frame>
    </Tag>
  );
}

function Frame({ href, className = "", children }: { href?: string; className?: string; children: React.ReactNode }) {
  const style = `card block p-4 ${className}`;
  return href ? (
    <Link
      href={href}
      className={`${style} transition hover:bg-black/[0.03] active:scale-[0.99] dark:hover:bg-white/[0.04]`}
    >
      {children}
    </Link>
  ) : (
    <div className={style}>{children}</div>
  );
}
