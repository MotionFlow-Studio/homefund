import {
  bigint,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { CATEGORY_IDS } from "@/lib/categories";
import { CURRENCIES } from "@/lib/money";
import { EXPENSE_SOURCES, MEMBER_ROLES } from "@/lib/model";

/*
 * Conventions
 * - IDs are UUID strings created by the client, so records can be made offline
 *   and synced later without ID clashes.
 * - Amounts are integers in the minor unit (cent, ban, filler).
 * - The currency lives on the household; every amount in it uses that currency.
 * - Timestamps are always set by the app, never by the database, so the time
 *   a change was made on a device survives sync.
 * - updatedAt drives sync (last write wins); deletedAt marks soft deletes so
 *   deletions reach every device.
 */

const id = (name = "id") => varchar(name, { length: 36 });
const money = (name: string) => bigint(name, { mode: "number" });
const createdAt = () => timestamp("created_at", { fsp: 3 }).notNull();
const updatedAt = () => timestamp("updated_at", { fsp: 3 }).notNull();
const deletedAt = () => timestamp("deleted_at", { fsp: 3 });

/** A login account. A person can belong to one household through a member. */
export const users = mysqlTable(
  "users",
  {
    id: id().primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const households = mysqlTable("households", {
  id: id().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  currency: mysqlEnum("currency", CURRENCIES).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

/** A person in a household. Children have no login account (userId is null). */
export const members = mysqlTable(
  "members",
  {
    id: id().primaryKey(),
    householdId: id("household_id")
      .notNull()
      .references(() => households.id),
    userId: id("user_id").references(() => users.id),
    name: varchar("name", { length: 60 }).notNull(),
    role: mysqlEnum("role", MEMBER_ROLES).notNull(),
    color: varchar("color", { length: 7 }).notNull(),
    birthYear: int("birth_year"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("members_household_idx").on(t.householdId),
    uniqueIndex("members_household_user_unique").on(t.householdId, t.userId),
  ],
);

/** Payday settings, one row per member. */
export const paySettings = mysqlTable("pay_settings", {
  memberId: id("member_id")
    .primaryKey()
    .references(() => members.id),
  /** Day of month, 1-31. Falls back to the last day in shorter months. */
  paydayDay: tinyint("payday_day", { unsigned: true }).notNull(),
  incomeMinor: money("income_minor").notNull(),
  savingsGoalMinor: money("savings_goal_minor").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Recurring costs taken off the income every pay period (rent, utilities...). */
export const fixedCosts = mysqlTable(
  "fixed_costs",
  {
    id: id().primaryKey(),
    memberId: id("member_id")
      .notNull()
      .references(() => members.id),
    name: varchar("name", { length: 60 }).notNull(),
    amountMinor: money("amount_minor").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("fixed_costs_member_idx").on(t.memberId)],
);

export const expenses = mysqlTable(
  "expenses",
  {
    id: id().primaryKey(),
    householdId: id("household_id")
      .notNull()
      .references(() => households.id),
    memberId: id("member_id")
      .notNull()
      .references(() => members.id),
    amountMinor: money("amount_minor").notNull(),
    category: mysqlEnum("category", CATEGORY_IDS).notNull(),
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    merchant: varchar("merchant", { length: 120 }),
    note: varchar("note", { length: 280 }),
    source: mysqlEnum("source", EXPENSE_SOURCES).notNull().default("manual"),
    createdByUserId: id("created_by_user_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("expenses_household_spent_idx").on(t.householdId, t.spentOn),
    index("expenses_member_spent_idx").on(t.memberId, t.spentOn),
    index("expenses_household_updated_idx").on(t.householdId, t.updatedAt),
  ],
);

/** Line items read from a receipt. The receipt image itself is never stored. */
export const receiptItems = mysqlTable(
  "receipt_items",
  {
    id: id().primaryKey(),
    expenseId: id("expense_id")
      .notNull()
      .references(() => expenses.id),
    position: int("position").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    /** Quantity in thousandths, so 1.5 kg -> 1500. */
    quantityMilli: int("quantity_milli").notNull().default(1000),
    unitPriceMinor: money("unit_price_minor"),
    lineTotalMinor: money("line_total_minor").notNull(),
    category: mysqlEnum("category", CATEGORY_IDS).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("receipt_items_expense_idx").on(t.expenseId)],
);
