"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, computeBudget, localToday, payPeriod, type Budget } from "@/lib/budget";
import { categoryTotals, familyBudgets, type CategoryTotal, type MemberBudget } from "@/lib/family-budget";
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

export type HouseholdOverview = {
  budgets: MemberBudget[];
  /** First day of the current calendar month. */
  monthStart: string;
  monthSpentMinor: number;
  monthByCategory: CategoryTotal[];
};

/** Everything the household overview shows, read live from the device. */
export function useHouseholdOverview(householdId: string, meId: string): HouseholdOverview | undefined {
  const today = localToday();
  const monthStart = `${today.slice(0, 8)}01`;
  return useLiveQuery(async () => {
    const db = localDb();
    const members = await db.members.where("householdId").equals(householdId).toArray();
    const ids = members.map((m) => m.id);
    const paySettings = (await db.paySettings.bulkGet(ids)).filter((s) => s !== undefined);
    const fixedCosts = await db.fixedCosts.where("memberId").anyOf(ids).toArray();
    const from = [monthStart, addDays(today, -31)].sort()[0];
    const expenses = await db.expenses
      .where("[householdId+spentOn]")
      .between([householdId, from], [householdId, today], true, true)
      .toArray();
    const month = expenses.filter((e) => e.spentOn >= monthStart && e.deletedAt === null);
    const receiptItems = await db.receiptItems
      .where("expenseId")
      .anyOf(month.filter((e) => e.source === "receipt").map((e) => e.id))
      .toArray();
    return {
      budgets: familyBudgets({ today, meId, members, paySettings, fixedCosts, expenses }),
      monthStart,
      monthSpentMinor: month.reduce((sum, e) => sum + e.amountMinor, 0),
      monthByCategory: categoryTotals(month, receiptItems),
    };
  }, [householdId, meId, today, monthStart]);
}
