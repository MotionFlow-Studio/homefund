import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/categories";
import { CURRENCIES } from "@/lib/money";

/*
 * The shared data model. The same shapes are used in the browser, in API
 * requests and responses, and on the server, so sync is a plain exchange of
 * these records. Timestamps are ISO 8601 strings; dates are "YYYY-MM-DD".
 */

export const MEMBER_ROLES = ["owner", "adult", "child"] as const;
export const EXPENSE_SOURCES = ["manual", "receipt", "voice"] as const;

/** Largest amount accepted anywhere: 100 million in major units. */
const MAX_MINOR = 100_000_000 * 100;

const uuid = z.uuid();
const isoTimestamp = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const minorAmount = z.number().int().min(0).max(MAX_MINOR);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable();

const syncFields = {
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  deletedAt: isoTimestamp.nullable(),
};

export const householdSchema = z.object({
  id: uuid,
  name: text(80),
  currency: z.enum(CURRENCIES),
  ...syncFields,
});

export const memberSchema = z.object({
  id: uuid,
  householdId: uuid,
  userId: uuid.nullable(),
  name: text(60),
  role: z.enum(MEMBER_ROLES),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  birthYear: z.number().int().min(1900).max(2100).nullable(),
  ...syncFields,
});

export const paySettingsSchema = z.object({
  memberId: uuid,
  paydayDay: z.number().int().min(1).max(31),
  incomeMinor: minorAmount,
  savingsGoalMinor: minorAmount,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export const fixedCostSchema = z.object({
  id: uuid,
  memberId: uuid,
  name: text(60),
  amountMinor: minorAmount,
  ...syncFields,
});

export const expenseSchema = z.object({
  id: uuid,
  householdId: uuid,
  memberId: uuid,
  amountMinor: minorAmount.min(1),
  category: z.enum(CATEGORY_IDS),
  spentOn: isoDate,
  merchant: optionalText(120),
  note: optionalText(280),
  source: z.enum(EXPENSE_SOURCES),
  createdByUserId: uuid.nullable(),
  ...syncFields,
});

export const receiptItemSchema = z.object({
  id: uuid,
  expenseId: uuid,
  position: z.number().int().min(0).max(500),
  name: text(120),
  quantityMilli: z.number().int().min(1).max(1_000_000),
  unitPriceMinor: minorAmount.nullable(),
  lineTotalMinor: minorAmount,
  category: z.enum(CATEGORY_IDS),
  ...syncFields,
});

export type Household = z.infer<typeof householdSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberRole = Member["role"];
export type PaySettings = z.infer<typeof paySettingsSchema>;
export type FixedCost = z.infer<typeof fixedCostSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseSource = Expense["source"];
export type ReceiptItem = z.infer<typeof receiptItemSchema>;
