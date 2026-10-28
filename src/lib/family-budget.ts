import { computeBudget, type Budget } from "@/lib/budget";
import type { Expense, FixedCost, Member, PaySettings } from "@/lib/model";

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
        }),
      };
    });
}
