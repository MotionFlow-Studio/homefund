import { z } from "zod";
import { addDays, type Budget } from "@/lib/budget";
import { CATEGORY_IDS, getCategory, type CategoryId } from "@/lib/categories";
import type { Forecast } from "@/lib/forecast";
import type { CategoryTotal } from "@/lib/family-budget";
import { isCurrency } from "@/lib/money";

/*
 * What the money coach (Muse Spark 1.3) is told about the user's budget.
 * Only totals leave the phone: no names of people, no notes and no receipt
 * lines; shop names are included so tips can be concrete.
 */

const minor = z.number().int().min(-1e13).max(1e13);
const date = z.iso.date();

export const financeContextSchema = z.object({
  currency: z.string().refine(isCurrency),
  today: date,
  nextPayday: date,
  daysLeft: z.number().int().min(0).max(62),
  daysElapsed: z.number().int().min(0).max(62),
  periodDays: z.number().int().min(1).max(62),
  availableMinor: minor,
  extraIncomeMinor: minor,
  spentMinor: minor,
  leftMinor: minor,
  perDayMinor: minor,
  averagePerDayMinor: minor,
  projectedLeftMinor: minor,
  runsOutOn: date.nullable(),
  categories: z.array(z.object({ category: z.enum(CATEGORY_IDS), minor })).max(12),
  lastWeek: z.array(z.object({ category: z.enum(CATEGORY_IDS), minor })).max(12),
  weekBefore: z.array(z.object({ category: z.enum(CATEGORY_IDS), minor })).max(12),
  topShops: z.array(z.object({ name: z.string().max(60), minor, visits: z.number().int().min(1).max(500) })).max(5),
});

export type FinanceContext = z.infer<typeof financeContextSchema>;

export const INSIGHT_TONES = ["good", "watch", "tip"] as const;

export type Insight = { tone: (typeof INSIGHT_TONES)[number]; title: string; body: string };
export type AskAnswer = { verdict: "yes" | "careful" | "no" | "info"; answer: string };

/** Builds the context from the budget, the forecast and the member's recent expenses. */
export function buildFinanceContext(input: {
  currency: string;
  today: string;
  budget: Budget;
  forecast: Forecast;
  byCategory: CategoryTotal[];
  expenses: { amountMinor: number; spentOn: string; category: CategoryId; merchant: string | null }[];
}): FinanceContext {
  const { budget, forecast: fc, today } = input;
  const week = (from: string, to: string) => {
    const totals = new Map<CategoryId, number>();
    for (const e of input.expenses) {
      if (e.spentOn < from || e.spentOn > to) continue;
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountMinor);
    }
    return [...totals].map(([category, minor]) => ({ category, minor })).sort((a, b) => b.minor - a.minor);
  };
  const shops = new Map<string, { minor: number; visits: number }>();
  for (const e of input.expenses) {
    if (!e.merchant || e.spentOn < budget.start) continue;
    const name = e.merchant.trim().slice(0, 60);
    const entry = shops.get(name) ?? { minor: 0, visits: 0 };
    entry.minor += e.amountMinor;
    entry.visits += 1;
    shops.set(name, entry);
  }
  return {
    currency: input.currency,
    today,
    nextPayday: budget.nextPayday,
    daysLeft: budget.daysLeft,
    daysElapsed: fc.daysElapsed,
    periodDays: fc.periodDays,
    availableMinor: budget.availableMinor,
    extraIncomeMinor: budget.extraIncomeMinor,
    spentMinor: budget.spentMinor,
    leftMinor: budget.leftMinor,
    perDayMinor: budget.perDayMinor,
    averagePerDayMinor: fc.averagePerDayMinor,
    projectedLeftMinor: fc.projectedLeftMinor,
    runsOutOn: fc.runsOutOn,
    categories: input.byCategory.slice(0, 12).map((c) => ({ category: c.category, minor: c.amountMinor })),
    lastWeek: week(addDays(today, -6), today),
    weekBefore: week(addDays(today, -13), addDays(today, -7)),
    topShops: [...shops]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.minor - a.minor)
      .slice(0, 5),
  };
}

/** The context as plain sentences for the model, with amounts written out. */
export function describeContext(c: FinanceContext, money: (minor: number) => string): string {
  const list = (items: { category: CategoryId; minor: number }[]) =>
    items.length ? items.map((i) => `${getCategory(i.category).label} ${money(i.minor)}`).join(", ") : "nothing";
  return [
    `Today is ${c.today}. Next payday: ${c.nextPayday} (${c.daysLeft} days left, day ${c.daysElapsed} of ${c.periodDays}).`,
    `Can spend this pay period: ${money(c.availableMinor)} (after rent, bills and savings${c.extraIncomeMinor > 0 ? `, including ${money(c.extraIncomeMinor)} extra income` : ""}).`,
    `Spent so far: ${money(c.spentMinor)}. Left: ${money(c.leftMinor)}. Can spend per day from now: ${money(c.perDayMinor)}.`,
    `Average spending so far: ${money(c.averagePerDayMinor)} a day. At this pace, left on payday: ${money(c.projectedLeftMinor)}${c.runsOutOn ? `; the money runs out on ${c.runsOutOn}` : ""}.`,
    `This pay period by category: ${list(c.categories)}.`,
    `Last 7 days by category: ${list(c.lastWeek)}. The 7 days before: ${list(c.weekBefore)}.`,
    `Top shops this period: ${c.topShops.length ? c.topShops.map((s) => `${s.name} ${money(s.minor)} (${s.visits} visits)`).join(", ") : "none recorded"}.`,
  ].join("\n");
}
