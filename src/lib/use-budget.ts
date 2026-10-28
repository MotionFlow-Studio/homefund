"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, computeBudget, localToday, payPeriod, type Budget } from "@/lib/budget";
import { familyBudgets, type MemberBudget } from "@/lib/family-budget";
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

/** Every member's live budget in the household; see familyBudgets. */
export function useFamilyBudgets(householdId: string, meId: string): MemberBudget[] | undefined {
  const today = localToday();
  return useLiveQuery(async () => {
    const db = localDb();
    const members = await db.members.where("householdId").equals(householdId).toArray();
    const ids = members.map((m) => m.id);
    const paySettings = (await db.paySettings.bulkGet(ids)).filter((s) => s !== undefined);
    const fixedCosts = await db.fixedCosts.where("memberId").anyOf(ids).toArray();
    // A pay period is at most 31 days, so this window covers every member's.
    const expenses = await db.expenses
      .where("[householdId+spentOn]")
      .between([householdId, addDays(today, -31)], [householdId, today], true, true)
      .toArray();
    return familyBudgets({ today, meId, members, paySettings, fixedCosts, expenses });
  }, [householdId, meId, today]);
}
