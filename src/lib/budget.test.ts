import { describe, expect, it } from "vitest";
import { computeBudget, daysInMonth, localToday, payPeriod } from "@/lib/budget";

describe("payPeriod", () => {
  it("before payday in the month: period started last month", () => {
    expect(payPeriod("2026-10-20", 25)).toEqual({
      start: "2026-09-25",
      end: "2026-10-24",
      nextPayday: "2026-10-25",
      daysLeft: 5,
    });
  });

  it("after payday: period runs to next month", () => {
    expect(payPeriod("2026-10-27", 25)).toMatchObject({
      start: "2026-10-25",
      nextPayday: "2026-11-25",
      daysLeft: 29,
    });
  });

  it("today is payday: a new period starts today", () => {
    expect(payPeriod("2026-10-25", 25)).toMatchObject({
      start: "2026-10-25",
      nextPayday: "2026-11-25",
      daysLeft: 31,
    });
  });

  it("the day before payday counts as 1 day left", () => {
    expect(payPeriod("2026-11-24", 25).daysLeft).toBe(1);
  });

  it("payday on the 31st falls on the last day of shorter months", () => {
    expect(payPeriod("2026-11-15", 31)).toMatchObject({
      start: "2026-10-31",
      nextPayday: "2026-11-30",
      daysLeft: 15,
    });
    expect(payPeriod("2026-11-30", 31)).toMatchObject({
      start: "2026-11-30",
      nextPayday: "2026-12-31",
    });
  });

  it("handles February, including leap years", () => {
    expect(payPeriod("2027-02-10", 30)).toMatchObject({ start: "2027-01-30", nextPayday: "2027-02-28" });
    expect(payPeriod("2028-02-10", 30)).toMatchObject({ start: "2028-01-30", nextPayday: "2028-02-29" });
    expect(payPeriod("2027-02-28", 30)).toMatchObject({ start: "2027-02-28", nextPayday: "2027-03-30" });
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it("rolls over the year in both directions", () => {
    expect(payPeriod("2026-12-28", 25)).toMatchObject({ start: "2026-12-25", nextPayday: "2027-01-25" });
    expect(payPeriod("2027-01-05", 10)).toMatchObject({ start: "2026-12-10", nextPayday: "2027-01-10" });
  });

  it("payday on the 1st", () => {
    expect(payPeriod("2026-10-01", 1)).toMatchObject({ start: "2026-10-01", end: "2026-10-31", daysLeft: 31 });
    expect(payPeriod("2026-10-31", 1).daysLeft).toBe(1);
  });

  it("rejects invalid paydays", () => {
    expect(() => payPeriod("2026-10-27", 0)).toThrow();
    expect(() => payPeriod("2026-10-27", 32)).toThrow();
  });
});

describe("computeBudget", () => {
  const base = {
    today: "2026-10-27",
    paydayDay: 25,
    incomeMinor: 500_000,
    fixedCostsMinor: [150_000, 4_997],
    savingsGoalMinor: 50_000,
  };

  it("left = income - fixed - savings - spent; per day includes today", () => {
    const b = computeBudget({
      ...base,
      expenses: [
        { amountMinor: 10_507, spentOn: "2026-10-25" },
        { amountMinor: 4_997, spentOn: "2026-10-27" },
      ],
    });
    expect(b.availableMinor).toBe(295_003);
    expect(b.spentMinor).toBe(15_504);
    expect(b.leftMinor).toBe(279_499);
    expect(b.daysLeft).toBe(29);
    expect(b.perDayMinor).toBe(Math.floor(279_499 / 29));
    expect(b.overspent).toBe(false);
  });

  it("ignores expenses outside the current period", () => {
    const b = computeBudget({
      ...base,
      expenses: [
        { amountMinor: 99_999, spentOn: "2026-10-24" },
        { amountMinor: 99_999, spentOn: "2026-11-25" },
        { amountMinor: 100, spentOn: "2026-11-24" },
      ],
    });
    expect(b.spentMinor).toBe(100);
  });

  it("overspent: negative left, zero per day", () => {
    const b = computeBudget({ ...base, expenses: [{ amountMinor: 300_000, spentOn: "2026-10-26" }] });
    expect(b.leftMinor).toBe(-4_997);
    expect(b.perDayMinor).toBe(0);
    expect(b.overspent).toBe(true);
  });

  it("exactly zero left is not overspent", () => {
    const b = computeBudget({ ...base, expenses: [{ amountMinor: 295_003, spentOn: "2026-10-26" }] });
    expect(b.leftMinor).toBe(0);
    expect(b.perDayMinor).toBe(0);
    expect(b.overspent).toBe(false);
  });

  it("rounds per day down so the daily figure never overspends", () => {
    const b = computeBudget({ ...base, today: "2026-11-22", incomeMinor: 100, fixedCostsMinor: [], savingsGoalMinor: 0, expenses: [] });
    expect(b.daysLeft).toBe(3);
    expect(b.perDayMinor).toBe(33);
  });
});

describe("localToday", () => {
  it("uses the device's calendar date", () => {
    expect(localToday(new Date(2026, 9, 27, 23, 59))).toBe("2026-10-27");
  });
});
