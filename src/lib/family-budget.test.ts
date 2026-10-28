import { describe, expect, it } from "vitest";
import { categoryTotals, expectedShare, familyBudgets, householdTotals, pace } from "./family-budget";
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

describe("pace", () => {
  const base = { start: "2026-10-10", end: "2026-11-09", nextPayday: "2026-11-10", daysLeft: 13, perDayMinor: 0 };
  const budget = (spentMinor: number, availableMinor = 310_000) => ({
    ...base,
    availableMinor,
    extraIncomeMinor: 0,
    spentMinor,
    leftMinor: availableMinor - spentMinor,
    overspent: availableMinor - spentMinor < 0,
  });

  it("knows where an even pace would be today", () => {
    // 31-day period, 28 October is day 19
    expect(expectedShare(budget(0), "2026-10-28")).toBeCloseTo(19 / 31);
  });

  it("is on track up to a little ahead of an even pace", () => {
    expect(pace(budget(150_000), "2026-10-28")).toBe("on_track"); // 48% spent, 61% of the time
    expect(pace(budget(215_000), "2026-10-28")).toBe("on_track"); // 69%, within slack
  });

  it("warns when spending runs ahead, and when over budget", () => {
    expect(pace(budget(240_000), "2026-10-28")).toBe("spending_fast"); // 77%
    expect(pace(budget(320_000), "2026-10-28")).toBe("over_budget");
    expect(pace(budget(100, 0), "2026-10-28")).toBe("over_budget");
  });
});

describe("household totals", () => {
  it("adds up everyone with a budget, overspending included", () => {
    const mk = (availableMinor: number, spentMinor: number, perDayMinor: number) => ({
      member: member("x", "X"),
      budget: {
        start: "2026-10-10", end: "2026-11-09", nextPayday: "2026-11-10", daysLeft: 13,
        availableMinor, extraIncomeMinor: 0, spentMinor, leftMinor: availableMinor - spentMinor, perDayMinor, overspent: spentMinor > availableMinor,
      },
    });
    expect(householdTotals([mk(350_000, 10_000, 26_153), mk(100_000, 120_000, 0), { member: member("m", "Mia"), budget: null }])).toEqual({
      withBudget: 2,
      availableMinor: 450_000,
      spentMinor: 130_000,
      leftMinor: 320_000,
      perDayMinor: 26_153,
    });
  });
});

describe("category totals", () => {
  it("splits receipts by their lines and keeps other expenses whole", () => {
    const expenses = [
      { ...expense("anna", 10_507, "2026-10-27"), id: "lidl", category: "groceries" as const },
      { ...expense("bob", 3_500, "2026-10-26"), id: "bolt", category: "transport" as const },
      { ...expense("bob", 999, "2026-10-26"), id: "gone", category: "fun" as const, deletedAt: "2026-10-27T00:00:00.000Z" },
    ];
    const items = [
      { expenseId: "lidl", lineTotalMinor: 8_258, category: "groceries" as const, deletedAt: null },
      { expenseId: "lidl", lineTotalMinor: 999, category: "household" as const, deletedAt: null },
      { expenseId: "lidl", lineTotalMinor: 1_250, category: "health" as const, deletedAt: null },
    ];
    expect(categoryTotals(expenses, items)).toEqual([
      { category: "groceries", amountMinor: 8_258 },
      { category: "transport", amountMinor: 3_500 },
      { category: "health", amountMinor: 1_250 },
      { category: "household", amountMinor: 999 },
    ]);
  });

  it("falls back to the expense when its lines no longer add up", () => {
    const edited = [{ ...expense("anna", 12_000, "2026-10-27"), id: "lidl" }];
    const items = [{ expenseId: "lidl", lineTotalMinor: 10_507, category: "household" as const, deletedAt: null }];
    expect(categoryTotals(edited, items)).toEqual([{ category: "groceries", amountMinor: 12_000 }]);
  });
});
