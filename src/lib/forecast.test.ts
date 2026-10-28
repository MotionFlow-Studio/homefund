import { describe, expect, it } from "vitest";
import { computeBudget } from "@/lib/budget";
import { dailySpending, forecast } from "@/lib/forecast";

const budgetFor = (expenses: { amountMinor: number; spentOn: string }[], today = "2026-10-19") =>
  computeBudget({ today, paydayDay: 10, incomeMinor: 310_000, fixedCostsMinor: [], savingsGoalMinor: 0, expenses });

describe("dailySpending", () => {
  it("adds up each day and fills the gaps with zero", () => {
    const days = dailySpending(
      [
        { amountMinor: 500, spentOn: "2026-10-10" },
        { amountMinor: 250, spentOn: "2026-10-10" },
        { amountMinor: 900, spentOn: "2026-10-12" },
        { amountMinor: 100, spentOn: "2026-10-09" },
      ],
      "2026-10-10",
      "2026-10-12",
    );
    expect(days).toEqual([
      { date: "2026-10-10", spentMinor: 750 },
      { date: "2026-10-11", spentMinor: 0 },
      { date: "2026-10-12", spentMinor: 900 },
    ]);
  });
});

describe("forecast", () => {
  it("projects what is left on payday at the current pace", () => {
    // 31-day period (Oct 10 - Nov 9), 10 days in, $1,000 spent: $100 a day.
    const expenses = Array.from({ length: 10 }, (_, i) => ({ amountMinor: 10_000, spentOn: `2026-10-${String(10 + i)}` }));
    const result = forecast(budgetFor(expenses), expenses, "2026-10-19");
    expect(result.periodDays).toBe(31);
    expect(result.daysElapsed).toBe(10);
    expect(result.averagePerDayMinor).toBe(10_000);
    expect(result.projectedLeftMinor).toBe(310_000 - 310_000);
    expect(result.runsOutOn).toBeNull();
    expect(result.cumulative.at(-1)).toBe(100_000);
    expect(result.even.at(-1)).toBe(310_000);
  });

  it("says when the money runs out", () => {
    const expenses = [{ amountMinor: 200_000, spentOn: "2026-10-12" }];
    const result = forecast(budgetFor(expenses), expenses, "2026-10-19");
    // $2,000 in 10 days is $200 a day; $1,100 left lasts 6 more days.
    expect(result.averagePerDayMinor).toBe(20_000);
    expect(result.runsOutOn).toBe("2026-10-25");
    expect(result.projectedLeftMinor).toBeLessThan(0);
    expect(result.aheadOfPaceMinor).toBeGreaterThan(0);
  });

  it("is calm at the start of a period", () => {
    const result = forecast(budgetFor([], "2026-10-10"), [], "2026-10-10");
    expect(result.daysElapsed).toBe(1);
    expect(result.projectedLeftMinor).toBe(310_000);
    expect(result.runsOutOn).toBeNull();
  });
});
