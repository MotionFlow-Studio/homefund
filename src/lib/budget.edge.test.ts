import { describe, expect, it } from "vitest";
import { addDays, computeBudget, payPeriod } from "@/lib/budget";

const budget = (overrides: Partial<Parameters<typeof computeBudget>[0]> = {}) =>
  computeBudget({
    today: "2026-10-27",
    paydayDay: 25,
    incomeMinor: 300_000,
    fixedCostsMinor: [100_000],
    savingsGoalMinor: 0,
    expenses: [],
    ...overrides,
  });

describe("edge case: end of month", () => {
  it("last day of a 31-day month", () => {
    expect(payPeriod("2026-10-31", 25)).toMatchObject({ start: "2026-10-25", nextPayday: "2026-11-25", daysLeft: 25 });
  });

  it("last day of a 30-day month, payday on the 1st: one day left", () => {
    expect(payPeriod("2026-11-30", 1)).toMatchObject({ start: "2026-11-01", nextPayday: "2026-12-01", daysLeft: 1 });
  });

  it("New Year's Eve", () => {
    expect(payPeriod("2026-12-31", 15)).toMatchObject({ start: "2026-12-15", nextPayday: "2027-01-15", daysLeft: 15 });
  });

  it("an expense on the last day of the period counts, the payday itself starts a new period", () => {
    const b = budget({
      today: "2026-11-24",
      expenses: [
        { amountMinor: 1_000, spentOn: "2026-11-24" },
        { amountMinor: 9_999, spentOn: "2026-11-25" },
      ],
    });
    expect(b.spentMinor).toBe(1_000);
    expect(b.daysLeft).toBe(1);
  });
});

describe("edge case: February", () => {
  it("normal year: payday 29-31 falls on Feb 28", () => {
    for (const day of [29, 30, 31]) {
      expect(payPeriod("2027-02-15", day).nextPayday).toBe("2027-02-28");
    }
  });

  it("leap year: payday 29-31 falls on Feb 29", () => {
    for (const day of [29, 30, 31]) {
      expect(payPeriod("2028-02-15", day).nextPayday).toBe("2028-02-29");
    }
  });

  it("leap day itself is a valid today", () => {
    expect(payPeriod("2028-02-29", 10)).toMatchObject({ start: "2028-02-10", nextPayday: "2028-03-10", daysLeft: 10 });
  });

  it("the period that ends in February has the right length", () => {
    const p = payPeriod("2027-02-27", 28);
    expect(p).toMatchObject({ start: "2027-01-28", nextPayday: "2027-02-28", daysLeft: 1 });
  });
});

describe("edge case: payday on the 31st", () => {
  it("uses the last day of every shorter month", () => {
    const expected: Record<string, string> = {
      "2026-02-10": "2026-02-28",
      "2026-04-10": "2026-04-30",
      "2026-06-10": "2026-06-30",
      "2026-09-10": "2026-09-30",
      "2026-11-10": "2026-11-30",
      "2026-12-10": "2026-12-31",
    };
    for (const [today, payday] of Object.entries(expected)) {
      expect(payPeriod(today, 31).nextPayday).toBe(payday);
    }
  });

  it("the day after a short-month payday is inside the new period", () => {
    expect(payPeriod("2026-12-01", 31)).toMatchObject({ start: "2026-11-30", nextPayday: "2026-12-31" });
  });
});

describe("edge case: payday is today", () => {
  it("today starts a fresh period with the full budget", () => {
    const b = budget({ today: "2026-10-25", expenses: [{ amountMinor: 50_000, spentOn: "2026-10-24" }] });
    expect(b.start).toBe("2026-10-25");
    expect(b.spentMinor).toBe(0);
    expect(b.leftMinor).toBe(200_000);
    expect(b.daysLeft).toBe(31);
  });

  it("payday on the 31st is today in a short month", () => {
    expect(payPeriod("2026-11-30", 31)).toMatchObject({ start: "2026-11-30", daysLeft: 31 });
  });
});

describe("edge case: overspending", () => {
  it("negative left, per day is 0 (never negative), flagged as overspent", () => {
    const b = budget({ expenses: [{ amountMinor: 250_000, spentOn: "2026-10-26" }] });
    expect(b.leftMinor).toBe(-50_000);
    expect(b.perDayMinor).toBe(0);
    expect(b.overspent).toBe(true);
  });

  it("fixed costs alone exceed income", () => {
    const b = budget({ incomeMinor: 50_000 });
    expect(b.availableMinor).toBe(-50_000);
    expect(b.overspent).toBe(true);
    expect(b.perDayMinor).toBe(0);
  });

  it("per day is never negative for any input", () => {
    let seed = 42;
    const rand = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed % max;
    };
    for (let i = 0; i < 2_000; i++) {
      const today = addDays("2026-01-01", rand(1_500));
      const b = computeBudget({
        today,
        paydayDay: 1 + rand(31),
        incomeMinor: rand(1_000_000),
        fixedCostsMinor: [rand(500_000), rand(500_000)],
        savingsGoalMinor: rand(200_000),
        expenses: [{ amountMinor: rand(800_000), spentOn: today }],
      });
      expect(b.perDayMinor).toBeGreaterThanOrEqual(0);
      expect(b.daysLeft).toBeGreaterThanOrEqual(1);
      expect(b.daysLeft).toBeLessThanOrEqual(31);
      expect(b.overspent).toBe(b.leftMinor < 0);
    }
  });
});

describe("edge case: zero income", () => {
  it("nothing to spend, not overspent", () => {
    const b = budget({ incomeMinor: 0, fixedCostsMinor: [] });
    expect(b.availableMinor).toBe(0);
    expect(b.leftMinor).toBe(0);
    expect(b.perDayMinor).toBe(0);
    expect(b.overspent).toBe(false);
  });

  it("zero income with spending is overspent", () => {
    const b = budget({ incomeMinor: 0, fixedCostsMinor: [], expenses: [{ amountMinor: 1, spentOn: "2026-10-27" }] });
    expect(b.leftMinor).toBe(-1);
    expect(b.overspent).toBe(true);
  });
});
