import { addDays, daysBetween, type Budget, type IsoDate } from "@/lib/budget";

/*
 * Where the pay period is heading. Pure functions, like budget.ts: they take
 * the budget and the member's expenses and say how spending compares with an
 * even pace and how much will be left on payday at the current pace.
 */

export type DaySpend = { date: IsoDate; spentMinor: number };

/** Spending per day from `from` to `to`, both included; days without expenses are 0. */
export function dailySpending(expenses: { amountMinor: number; spentOn: IsoDate }[], from: IsoDate, to: IsoDate): DaySpend[] {
  const days = Math.max(0, daysBetween(from, to) + 1);
  const totals = new Map<IsoDate, number>();
  for (const e of expenses) {
    if (e.spentOn < from || e.spentOn > to) continue;
    totals.set(e.spentOn, (totals.get(e.spentOn) ?? 0) + e.amountMinor);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, spentMinor: totals.get(date) ?? 0 };
  });
}

export type Forecast = {
  /** Days in the whole pay period. */
  periodDays: number;
  /** Days of the period so far, today included. */
  daysElapsed: number;
  /** Average spent per day so far. */
  averagePerDayMinor: number;
  /** Spent so far, day by day, added up: one value per elapsed day. */
  cumulative: number[];
  /** An even pace through the period, added up: one value per period day. */
  even: number[];
  /** Spent by the end of the period if the average holds. */
  projectedSpentMinor: number;
  /** Left on payday if the average holds; negative when the money runs out first. */
  projectedLeftMinor: number;
  /** The day the money runs out at this pace, or null when it lasts. */
  runsOutOn: IsoDate | null;
  /** Spent so far compared with an even pace up to today: above 0 means ahead of it. */
  aheadOfPaceMinor: number;
};

export function forecast(budget: Budget, expenses: { amountMinor: number; spentOn: IsoDate }[], today: IsoDate): Forecast {
  const periodDays = daysBetween(budget.start, budget.end) + 1;
  const daysElapsed = Math.min(periodDays, daysBetween(budget.start, today) + 1);
  const days = dailySpending(expenses, budget.start, today);

  const cumulative: number[] = [];
  let running = 0;
  for (const day of days) cumulative.push((running += day.spentMinor));

  const available = Math.max(0, budget.availableMinor);
  const even = Array.from({ length: periodDays }, (_, i) => Math.round((available * (i + 1)) / periodDays));

  const averagePerDayMinor = Math.round(budget.spentMinor / daysElapsed);
  const remainingDays = periodDays - daysElapsed;
  const projectedSpentMinor = budget.spentMinor + averagePerDayMinor * remainingDays;
  const projectedLeftMinor = budget.availableMinor - projectedSpentMinor;

  let runsOutOn: IsoDate | null = null;
  if (budget.leftMinor <= 0) {
    runsOutOn = today;
  } else if (projectedLeftMinor < 0 && averagePerDayMinor > 0) {
    runsOutOn = addDays(today, Math.ceil(budget.leftMinor / averagePerDayMinor));
  }

  return {
    periodDays,
    daysElapsed,
    averagePerDayMinor,
    cumulative,
    even,
    projectedSpentMinor,
    projectedLeftMinor,
    runsOutOn,
    aheadOfPaceMinor: budget.spentMinor - (even[daysElapsed - 1] ?? 0),
  };
}
