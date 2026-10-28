import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/categories";
import { isCurrency } from "@/lib/money";

/*
 * The shared data model. The same shapes are used in the browser, in API
 * requests and responses, and on the server, so sync is a plain exchange of
 * these records. Timestamps are ISO 8601 strings; dates are "YYYY-MM-DD".
 */

/** Colors given to members in order, so each one is easy to tell apart. */
export const MEMBER_COLORS = ["#0f766e", "#2563eb", "#db2777", "#ea580c", "#7c3aed", "#ca8a04"];

export const MEMBER_ROLES = ["owner", "adult", "child"] as const;
export const EXPENSE_SOURCES = ["manual", "receipt", "voice"] as const;
/** Where money that is not the regular pay came from. */
export const INCOME_SOURCES = ["bonus", "side_job", "refund", "gift", "sale", "benefit", "other"] as const;

/** Largest amount accepted anywhere, in the smallest unit. */
const MAX_MINOR = Number.MAX_SAFE_INTEGER;

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
  currency: z.string().refine(isCurrency, "Unknown currency"),
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

/** Money received on top of the regular pay: it adds to what can be spent in the pay period. */
export const incomeSchema = z.object({
  id: uuid,
  householdId: uuid,
  memberId: uuid,
  amountMinor: minorAmount.min(1),
  source: z.enum(INCOME_SOURCES),
  receivedOn: isoDate,
  note: optionalText(280),
  createdByUserId: uuid.nullable(),
  ...syncFields,
});

export const receiptItemSchema = z.object({
  id: uuid,
  expenseId: uuid,
  position: z.number().int().min(0).max(500),
  name: text(120),
  quantityMilli: z.number().int().min(1).max(1_000_000),
  unitPrice: z
    .string()
    .regex(/^\d{1,13}(\.\d{1,6})?$/)
    .nullable(),
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
export type Income = z.infer<typeof incomeSchema>;
export type IncomeSource = Income["source"];
