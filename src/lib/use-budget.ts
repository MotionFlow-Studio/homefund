"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { computeBudget, localToday, payPeriod, type Budget } from "@/lib/budget";
import { localDb } from "@/lib/local/db";
import type { FixedCost, PaySettings } from "@/lib/model";

/** The member's live budget for the current pay period. */
export function useBudget(memberId: string, settings: PaySettings, fixedCosts: FixedCost[]): Budget | null {
  const today = localToday();
  const period = payPeriod(today, settings.paydayDay);

  const expenses = useLiveQuery(
    async () =>
      (await localDb().expenses.where("memberId").equals(memberId).toArray()).filter(
        (e) => e.deletedAt === null && e.spentOn >= period.start && e.spentOn <= period.end,
      ),
    [memberId, period.start, period.end],
  );

  if (!expenses) return null;
  return computeBudget({
    today,
    paydayDay: settings.paydayDay,
    incomeMinor: settings.incomeMinor,
    fixedCostsMinor: fixedCosts.map((c) => c.amountMinor),
    savingsGoalMinor: settings.savingsGoalMinor,
    expenses,
  });
}
