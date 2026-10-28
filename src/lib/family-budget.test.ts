import { describe, expect, it } from "vitest";
import { familyBudgets } from "./family-budget";
import type { Expense, FixedCost, Member, PaySettings } from "./model";

const stamp = { createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", deletedAt: null };
const member = (id: string, name: string): Member => ({
  id,
  householdId: "h",
  userId: null,
  name,
  role: "adult",
  color: "#000000",
  birthYear: null,
  ...stamp,
});
const expense = (memberId: string, amountMinor: number, spentOn: string): Expense => ({
  id: `${memberId}-${amountMinor}-${spentOn}`,
  householdId: "h",
  memberId,
  amountMinor,
  category: "groceries",
  spentOn,
  merchant: null,
  note: null,
  source: "manual",
  createdByUserId: null,
  ...stamp,
});

describe("family budgets", () => {
  const members = [member("bob", "Bogdan"), member("anna", "Anna"), member("mia", "Mia")];
  const paySettings: PaySettings[] = [
    { memberId: "anna", paydayDay: 10, incomeMinor: 600_000, savingsGoalMinor: 50_000, ...stamp },
    { memberId: "bob", paydayDay: 25, incomeMinor: 450_000, savingsGoalMinor: 0, ...stamp },
  ];
  const fixedCosts: FixedCost[] = [
    { id: "rent", memberId: "anna", name: "Rent", amountMinor: 200_000, ...stamp },
    { id: "phone", memberId: "bob", name: "Phone", amountMinor: 5_000, ...stamp },
  ];
  const expenses = [
    expense("anna", 10_000, "2026-10-27"),
    expense("bob", 30_000, "2026-10-26"),
    expense("bob", 99_999, "2026-10-20"), // before Bob's payday on the 25th
  ];
  const result = familyBudgets({ today: "2026-10-28", meId: "anna", members, paySettings, fixedCosts, expenses });

  it("lists you first, then the others by name", () => {
    expect(result.map((r) => r.member.name)).toEqual(["Anna", "Bogdan", "Mia"]);
  });

  it("gives each member their own numbers, period and expenses", () => {
    const [anna, bob, mia] = result;
    // Anna: 6000 - 2000 - 500 = 3500 available, 100 spent, 13 days to 10 Nov
    expect(anna.budget).toMatchObject({ availableMinor: 340_000 + 10_000, spentMinor: 10_000, leftMinor: 340_000, daysLeft: 13 });
    expect(anna.budget?.perDayMinor).toBe(Math.floor(340_000 / 13));
    // Bob: 4500 - 50 = 4450, only spending since the 25th counts, 28 days to 25 Nov
    expect(bob.budget).toMatchObject({ availableMinor: 445_000, spentMinor: 30_000, leftMinor: 415_000, daysLeft: 28 });
    expect(mia.budget).toBeNull();
  });
});
