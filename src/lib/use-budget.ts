"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, computeBudget, localToday, payPeriod, type Budget } from "@/lib/budget";
import { categoryTotals, familyBudgets, type CategoryTotal, type MemberBudget } from "@/lib/family-budget";
import { localDb } from "@/lib/local/db";
import type { Expense, FixedCost, PaySettings } from "@/lib/model";

/** Live extra incomes of a household received between two dates. */
async function recentIncomes(householdId: string, from: string, to: string) {
  return localDb()
    .incomes.where("[householdId+receivedOn]")
    .between([householdId, from], [householdId, to], true, true)
    .toArray();
}

/** The member's live budget for the current pay period. */
export function useBudget(memberId: string, settings: PaySettings, fixedCosts: FixedCost[]): Budget | null {
  const today = localToday();
  const period = payPeriod(today, settings.paydayDay);

  const entries = useLiveQuery(
    async () => ({
      expenses: (await localDb().expenses.where("memberId").equals(memberId).toArray()).filter(
        (e) => e.deletedAt === null && e.spentOn >= period.start && e.spentOn <= period.end,
      ),
      incomes: (await localDb().incomes.where("memberId").equals(memberId).toArray()).filter(
        (i) => i.deletedAt === null && i.receivedOn >= period.start && i.receivedOn <= period.end,
      ),
    }),
    [memberId, period.start, period.end],
  );

  if (!entries) return null;
  const { expenses, incomes } = entries;
  return computeBudget({
    today,
    paydayDay: settings.paydayDay,
    incomeMinor: settings.incomeMinor,
    fixedCostsMinor: fixedCosts.map((c) => c.amountMinor),
    savingsGoalMinor: settings.savingsGoalMinor,
    expenses,
    incomes,
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
    const incomes = await recentIncomes(householdId, addDays(today, -31), today);
    return familyBudgets({ today, meId, members, paySettings, fixedCosts, expenses, incomes });
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
      budgets: familyBudgets({ today, meId, members, paySettings, fixedCosts, expenses, incomes: await recentIncomes(householdId, from, today) }),
      monthStart,
      monthSpentMinor: month.reduce((sum, e) => sum + e.amountMinor, 0),
      monthByCategory: categoryTotals(month, receiptItems),
    };
  }, [householdId, meId, today, monthStart]);
}

export type MemberDetail = {
  entry: MemberBudget;
  /** Spending in the member's current pay period by category, or this month without a payday. */
  byCategory: CategoryTotal[];
  /** The member's latest expenses, newest first. */
  recent: Expense[];
  expenseCount: number;
};

/** One member's budget, spending and latest expenses; null if the member is not in the household. */
export function useMemberDetail(householdId: string, meId: string, memberId: string): MemberDetail | null | undefined {
  const today = localToday();
  return useLiveQuery(async () => {
    const db = localDb();
    const member = await db.members.get(memberId);
    if (!member || member.householdId !== householdId || member.deletedAt !== null) return null;
    const settings = await db.paySettings.get(memberId);
    const fixedCosts = await db.fixedCosts.where("memberId").equals(memberId).toArray();
    const expenses = (await db.expenses.where("memberId").equals(memberId).toArray())
      .filter((e) => e.deletedAt === null)
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
    const incomes = (await db.incomes.where("memberId").equals(memberId).toArray()).filter((i) => i.deletedAt === null);
    const [entry] = familyBudgets({
      today,
      meId,
      members: [member],
      paySettings: settings ? [settings] : [],
      fixedCosts,
      expenses,
      incomes,
    });
    const from = entry.budget?.start ?? `${today.slice(0, 8)}01`;
    const inPeriod = expenses.filter((e) => e.spentOn >= from && e.spentOn <= today);
    const receiptItems = await db.receiptItems
      .where("expenseId")
      .anyOf(inPeriod.filter((e) => e.source === "receipt").map((e) => e.id))
      .toArray();
    return {
      entry,
      byCategory: categoryTotals(inPeriod, receiptItems),
      recent: expenses.slice(0, 8),
      expenseCount: expenses.length,
    };
  }, [householdId, meId, memberId, today]);
}

/** The member's live expenses between two dates, for charts. */
export function usePeriodExpenses(memberId: string, from: string, to: string): Expense[] | undefined {
  return useLiveQuery(
    async () =>
      (await localDb().expenses.where("memberId").equals(memberId).toArray()).filter(
        (e) => e.deletedAt === null && e.spentOn >= from && e.spentOn <= to,
      ),
    [memberId, from, to],
  );
}
