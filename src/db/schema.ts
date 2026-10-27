import {
  bigint,
  char,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { CATEGORY_IDS } from "@/lib/categories";
import { EXPENSE_SOURCES, MEMBER_ROLES } from "@/lib/model";

/*
 * Conventions
 * - Database: Supabase (Postgres). Login accounts live in Supabase Auth
 *   (auth.users); members link to them through userId.
 * - Row level security is enabled on every table with no policies, so the
 *   public Supabase keys cannot read or write anything. All data access goes
 *   through the HomeFund server, which checks household membership.
 * - IDs are UUIDs created by the client, so records can be made offline and
 *   synced later without ID clashes.
 * - Amounts are integers in the currency's smallest unit, exact to the last
 *   decimal: 49.97 EUR is stored as 4997.
 * - The currency lives on the household; every amount in it uses that currency.
 * - Timestamps are always set by the app, never by the database, so the time
 *   a change was made on a device survives sync.
 * - updatedAt drives sync (last write wins); deletedAt marks soft deletes so
 *   deletions reach every device. serverSeq orders changes for the sync cursor.
 */

const money = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, precision: 3, mode: "string" });
const syncColumns = {
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
  deletedAt: ts("deleted_at"),
  serverSeq: bigint("server_seq", { mode: "number" }).notNull().default(0),
};

export const memberRole = pgEnum("member_role", MEMBER_ROLES);
export const expenseSource = pgEnum("expense_source", EXPENSE_SOURCES);
export const category = pgEnum("category", CATEGORY_IDS);

export const households = pgTable(
  "households",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    /** ISO 4217 code, e.g. EUR, USD, HUF. */
    currency: char("currency", { length: 3 }).notNull(),
    ...syncColumns,
  },
  (t) => [index("households_seq_idx").on(t.serverSeq)],
).enableRLS();

/** A person in a household. Children have no login account (userId is null). */
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    name: varchar("name", { length: 60 }).notNull(),
    role: memberRole("role").notNull(),
    color: varchar("color", { length: 7 }).notNull(),
    birthYear: smallint("birth_year"),
    ...syncColumns,
  },
  (t) => [
    index("members_household_idx").on(t.householdId, t.serverSeq),
    index("members_user_idx").on(t.userId),
    uniqueIndex("members_household_user_unique").on(t.householdId, t.userId),
  ],
).enableRLS();

/** Payday settings, one row per member. */
export const paySettings = pgTable(
  "pay_settings",
  {
    memberId: uuid("member_id")
      .primaryKey()
      .references(() => members.id),
    /** Day of month, 1-31. Falls back to the last day in shorter months. */
    paydayDay: smallint("payday_day").notNull(),
    incomeMinor: money("income_minor").notNull(),
    savingsGoalMinor: money("savings_goal_minor").notNull().default(0),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    serverSeq: bigint("server_seq", { mode: "number" }).notNull().default(0),
  },
  (t) => [index("pay_settings_seq_idx").on(t.serverSeq)],
).enableRLS();

/** Recurring costs taken off the income every pay period (rent, utilities...). */
export const fixedCosts = pgTable(
  "fixed_costs",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    name: varchar("name", { length: 60 }).notNull(),
    amountMinor: money("amount_minor").notNull(),
    ...syncColumns,
  },
  (t) => [index("fixed_costs_member_idx").on(t.memberId, t.serverSeq)],
).enableRLS();

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    amountMinor: money("amount_minor").notNull(),
    category: category("category").notNull(),
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    merchant: varchar("merchant", { length: 120 }),
    note: varchar("note", { length: 280 }),
    source: expenseSource("source").notNull().default("manual"),
    createdByUserId: uuid("created_by_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    ...syncColumns,
  },
  (t) => [
    index("expenses_household_spent_idx").on(t.householdId, t.spentOn),
    index("expenses_household_seq_idx").on(t.householdId, t.serverSeq),
  ],
).enableRLS();

/** Line items read from a receipt. The receipt image itself is never stored. */
export const receiptItems = pgTable(
  "receipt_items",
  {
    id: uuid("id").primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),
    position: integer("position").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    /** Quantity in thousandths, so 1.5 kg -> 1500. */
    quantityMilli: integer("quantity_milli").notNull().default(1000),
    /** Unit price as printed, e.g. fuel at 1.459 per litre. Exact decimal. */
    unitPrice: numeric("unit_price", { precision: 19, scale: 6 }),
    lineTotalMinor: money("line_total_minor").notNull(),
    category: category("category").notNull(),
    ...syncColumns,
  },
  (t) => [index("receipt_items_expense_idx").on(t.expenseId, t.serverSeq)],
).enableRLS();
