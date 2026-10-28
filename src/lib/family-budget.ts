import { computeBudget, daysBetween, type Budget } from "@/lib/budget";
import type { CategoryId } from "@/lib/categories";
import type { Expense, FixedCost, Income, Member, PaySettings, ReceiptItem } from "@/lib/model";

export type MemberBudget = { member: Member; budget: Budget | null };

/**
 * Every member's own budget: their income, fixed costs and savings, their
 * payday, and only the expenses they paid. Members who have not set up a
 * payday get null. You come first, then the rest by name.
 */
export function familyBudgets(input: {
  today: string;
  meId: string;
  members: Member[];
  paySettings: PaySettings[];
  fixedCosts: FixedCost[];
  expenses: Expense[];
  incomes?: Income[];
}): MemberBudget[] {
  const settingsOf = new Map(input.paySettings.map((s) => [s.memberId, s]));
  return input.members
    .filter((member) => member.deletedAt === null)
    .sort((a, b) => (a.id === input.meId ? -1 : b.id === input.meId ? 1 : a.name.localeCompare(b.name)))
    .map((member) => {
      const settings = settingsOf.get(member.id);
      if (!settings) return { member, budget: null };
      return {
        member,
        budget: computeBudget({
          today: input.today,
          paydayDay: settings.paydayDay,
          incomeMinor: settings.incomeMinor,
          savingsGoalMinor: settings.savingsGoalMinor,
          fixedCostsMinor: input.fixedCosts
            .filter((c) => c.memberId === member.id && c.deletedAt === null)
            .map((c) => c.amountMinor),
          expenses: input.expenses.filter((e) => e.memberId === member.id && e.deletedAt === null),
          incomes: (input.incomes ?? []).filter((i) => i.memberId === member.id && i.deletedAt === null),
        }),
      };
    });
}

export type Pace = "on_track" | "spending_fast" | "over_budget";

/** Spending up to this much ahead of an even pace still counts as on track. */
const PACE_SLACK = 0.1;

/**
 * Where the member should be by the end of today if they spread their money
 * evenly over the pay period, as a share (0-1) of what they can spend.
 */
export function expectedShare(budget: Budget, today: string): number {
  const total = daysBetween(budget.start, budget.nextPayday);
  const elapsed = daysBetween(budget.start, today) + 1;
  return Math.min(1, Math.max(0, elapsed / total));
}

/** Is the member keeping to an even pace through the pay period? */
export function pace(budget: Budget, today: string): Pace {
  if (budget.overspent) return "over_budget";
  if (budget.availableMinor <= 0) return budget.spentMinor > 0 ? "over_budget" : "on_track";
  const spentShare = budget.spentMinor / budget.availableMinor;
  return spentShare > expectedShare(budget, today) + PACE_SLACK ? "spending_fast" : "on_track";
}

export type HouseholdTotals = {
  /** Members who have set a payday. */
  withBudget: number;
  availableMinor: number;
  spentMinor: number;
  /** What everyone has left together; overspending reduces it. */
  leftMinor: number;
  /** What everyone can spend per day together. */
  perDayMinor: number;
};

/** The family's numbers added up, each member counted in their own pay period. */
export function householdTotals(budgets: MemberBudget[]): HouseholdTotals {
  const totals: HouseholdTotals = { withBudget: 0, availableMinor: 0, spentMinor: 0, leftMinor: 0, perDayMinor: 0 };
  for (const { budget } of budgets) {
    if (!budget) continue;
    totals.withBudget++;
    totals.availableMinor += budget.availableMinor;
    totals.spentMinor += budget.spentMinor;
    totals.leftMinor += budget.leftMinor;
    totals.perDayMinor += budget.perDayMinor;
  }
  return totals;
}

export type CategoryTotal = { category: CategoryId; amountMinor: number };

/**
 * Spending per category, largest first. A receipt counts by its lines, so a
 * shop run with food and soap shows under both groceries and household.
 */
export function categoryTotals(
  expenses: Pick<Expense, "id" | "amountMinor" | "category" | "deletedAt">[],
  receiptItems: Pick<ReceiptItem, "expenseId" | "lineTotalMinor" | "category" | "deletedAt">[],
): CategoryTotal[] {
  const linesOf = new Map<string, typeof receiptItems>();
  for (const item of receiptItems) {
    if (item.deletedAt !== null) continue;
    linesOf.set(item.expenseId, [...(linesOf.get(item.expenseId) ?? []), item]);
  }

  const totals = new Map<CategoryId, number>();
  const add = (category: CategoryId, amount: number) => totals.set(category, (totals.get(category) ?? 0) + amount);
  for (const expense of expenses) {
    if (expense.deletedAt !== null) continue;
    const lines = linesOf.get(expense.id);
    const linesSum = lines?.reduce((sum, line) => sum + line.lineTotalMinor, 0) ?? 0;
    // Lines are only trusted while they still add up to the expense (it may have been edited since).
    if (lines && linesSum === expense.amountMinor) for (const line of lines) add(line.category, line.lineTotalMinor);
    else add(expense.category, expense.amountMinor);
  }
  return [...totals]
    .map(([category, amountMinor]) => ({ category, amountMinor }))
    .filter((total) => total.amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor);
}
