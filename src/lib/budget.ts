/*
 * Budget math. Pure functions with no UI or storage, so they are easy to test.
 * Dates are "YYYY-MM-DD" strings in the user's local calendar; amounts are
 * integers in the currency's smallest unit.
 */

export type IsoDate = string;

const DAY_MS = 86_400_000;

function parse(date: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function format(y: number, m: number, d: number): IsoDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toUtc(date: IsoDate): number {
  const { y, m, d } = parse(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): IsoDate {
  const date = new Date(ms);
  return format(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The payday in a given month; a payday of 31 falls on the 30th or 28th/29th in shorter months. */
export function paydayInMonth(year: number, month: number, paydayDay: number): IsoDate {
  return format(year, month, Math.min(paydayDay, daysInMonth(year, month)));
}

/** Today's date in the device's own time zone. */
export function localToday(now: Date = new Date()): IsoDate {
  return format(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export type PayPeriod = {
  /** The last payday, on or before today. */
  start: IsoDate;
  /** The day before the next payday. */
  end: IsoDate;
  nextPayday: IsoDate;
  /** Days from today to the end of the period, counting today. */
  daysLeft: number;
};

export function payPeriod(today: IsoDate, paydayDay: number): PayPeriod {
  if (!Number.isInteger(paydayDay) || paydayDay < 1 || paydayDay > 31) {
    throw new Error(`Invalid payday: ${paydayDay}`);
  }
  const { y, m } = parse(today);
  const thisMonth = paydayInMonth(y, m, paydayDay);

  let start: IsoDate;
  let nextPayday: IsoDate;
  if (today >= thisMonth) {
    start = thisMonth;
    nextPayday = m === 12 ? paydayInMonth(y + 1, 1, paydayDay) : paydayInMonth(y, m + 1, paydayDay);
  } else {
    start = m === 1 ? paydayInMonth(y - 1, 12, paydayDay) : paydayInMonth(y, m - 1, paydayDay);
    nextPayday = thisMonth;
  }

  return {
    start,
    end: addDays(nextPayday, -1),
    nextPayday,
    daysLeft: daysBetween(today, nextPayday),
  };
}

export type BudgetInput = {
  today: IsoDate;
  paydayDay: number;
  incomeMinor: number;
  fixedCostsMinor: number[];
  savingsGoalMinor: number;
  /** Expenses of the member; only those inside the current pay period count. */
  expenses: { amountMinor: number; spentOn: IsoDate }[];
};

export type Budget = PayPeriod & {
  /** Income minus fixed costs and savings: what can be spent in the whole period. */
  availableMinor: number;
  /** Spent so far in this period. */
  spentMinor: number;
  /** Left until the next payday. Negative when overspent. */
  leftMinor: number;
  /** What can be spent per day, today included. Rounded down; 0 when overspent. */
  perDayMinor: number;
  overspent: boolean;
};

export function computeBudget(input: BudgetInput): Budget {
  const period = payPeriod(input.today, input.paydayDay);
  const fixed = input.fixedCostsMinor.reduce((sum, v) => sum + v, 0);
  const availableMinor = input.incomeMinor - fixed - input.savingsGoalMinor;
  const spentMinor = input.expenses
    .filter((e) => e.spentOn >= period.start && e.spentOn <= period.end)
    .reduce((sum, e) => sum + e.amountMinor, 0);
  const leftMinor = availableMinor - spentMinor;

  return {
    ...period,
    availableMinor,
    spentMinor,
    leftMinor,
    perDayMinor: leftMinor > 0 ? Math.floor(leftMinor / period.daysLeft) : 0,
    overspent: leftMinor < 0,
  };
}
