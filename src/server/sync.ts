import "server-only";
import { and, eq, getTableColumns, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import {
  expenses,
  fixedCosts,
  households,
  incomes,
  members,
  paySettings,
  receiptItems,
} from "@/db/schema";
import type { ChangeSet, SyncResponse } from "@/lib/local/sync";
import {
  expenseSchema,
  fixedCostSchema,
  householdSchema,
  incomeSchema,
  memberSchema,
  paySettingsSchema,
  receiptItemSchema,
} from "@/lib/model";
import { db, type Db } from "@/server/db";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Changes stamped further in the future than this are rejected. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
/** Most records per table returned in one pull; the client asks again while `more` is set. */
const PULL_LIMIT = Number(process.env.SYNC_PULL_LIMIT) || 5_000;

/**
 * Every write that hands out sync sequence numbers takes this lock first, so
 * writes commit in the order of their numbers. Without it, a write that took
 * number 10 could commit after one that took 11, and a device that already
 * pulled up to 11 would never see number 10.
 */
export async function lockSyncWrites(tx: { execute: Db["execute"] }) {
  await tx.execute(sql`select pg_advisory_xact_lock(${SYNC_WRITE_LOCK})`);
}
const SYNC_WRITE_LOCK = 7_340_001;

const nextSeq = sql`nextval('sync_seq')`;

function toIso(value: string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

/** Converts a database row to the shared model shape. */
function toRecord<T extends Record<string, unknown>>(row: T) {
  const out: Record<string, unknown> = { ...row };
  delete out.serverSeq;
  for (const key of ["createdAt", "updatedAt", "deletedAt"]) {
    if (key in out) out[key] = toIso(out[key] as string | null);
  }
  return out;
}

/** Inserts or updates a row, keeping whichever version was changed last. */
async function upsertLatest(
  tx: Tx,
  table: PgTable,
  key: keyof ReturnType<typeof getTableColumns>,
  record: Record<string, unknown>,
) {
  const columns = getTableColumns(table);
  const set: Record<string, SQL> = {};
  for (const [name, column] of Object.entries(columns)) {
    if (name === key) continue;
    set[name] = sql.raw(`excluded."${column.name}"`);
  }
  const updatedAt = columns.updatedAt;
  await tx
    .insert(table)
    .values({ ...record, serverSeq: nextSeq })
    .onConflictDoUpdate({
      target: columns[key as string],
      set: { ...set, serverSeq: nextSeq },
      setWhere: sql`excluded.updated_at >= ${updatedAt}`,
    });
}

function valid<T extends z.ZodType>(schema: T, records: unknown[] | undefined): z.infer<T>[] {
  const now = Date.now();
  return (records ?? []).flatMap((record) => {
    const parsed = schema.safeParse(record);
    if (!parsed.success) return [];
    const updatedAt = Date.parse((parsed.data as { updatedAt: string }).updatedAt);
    return updatedAt - now > MAX_CLOCK_SKEW_MS ? [] : [parsed.data];
  });
}

async function householdsOf(tx: Tx | Db, userId: string): Promise<Set<string>> {
  const rows = await tx
    .select({ householdId: members.householdId })
    .from(members)
    .where(and(eq(members.userId, userId), isNull(members.deletedAt)));
  return new Set(rows.map((r) => r.householdId));
}

/** Applies the client's changes the user is allowed to make. Returns the number applied. */
async function push(userId: string, changes: ChangeSet): Promise<number> {
  if (!Object.values(changes).some((records) => records && records.length > 0)) return 0;
  return db.transaction(async (tx) => {
    await lockSyncWrites(tx);
    let applied = 0;
    const allowed = await householdsOf(tx, userId);

    const incomingMembers = valid(memberSchema, changes.members);
    const createdHouseholds = new Set<string>();

    const ownerOf = new Set(
      (
        await tx
          .select({ householdId: members.householdId })
          .from(members)
          .where(and(eq(members.userId, userId), eq(members.role, "owner"), isNull(members.deletedAt)))
      ).map((r) => r.householdId),
    );

    // Households: brand-new ones the user creates as owner, or changes (name,
    // currency) by the owner. Other members cannot change the household.
    for (const household of valid(householdSchema, changes.households)) {
      if (allowed.has(household.id) && !ownerOf.has(household.id)) continue;
      if (!allowed.has(household.id)) {
        const [existing] = await tx.select({ id: households.id }).from(households).where(eq(households.id, household.id));
        const createsAsOwner = incomingMembers.some(
          (m) => m.householdId === household.id && m.userId === userId && m.role === "owner",
        );
        if (existing || !createsAsOwner) continue;
        allowed.add(household.id);
        createdHouseholds.add(household.id);
      }
      await upsertLatest(tx, households, "id", household);
      applied++;
    }

    // Members: only inside the user's households and never moved between them.
    // Roles never change through sync: owners exist only by creating a
    // household, adults only by joining with an invite. A member's account
    // link can only be set to the user's own account, and only the owner may
    // unlink or remove someone else's account.
    for (const member of incomingMembers) {
      if (!allowed.has(member.householdId)) continue;
      const [existing] = await tx
        .select({ householdId: members.householdId, userId: members.userId, role: members.role })
        .from(members)
        .where(eq(members.id, member.id));
      if (existing) {
        if (existing.householdId !== member.householdId || existing.role !== member.role) continue;
        const othersAccount = existing.userId !== null && existing.userId !== userId;
        const touchesAccount = existing.userId !== member.userId || member.deletedAt !== null;
        if (othersAccount && touchesAccount && !ownerOf.has(member.householdId)) continue;
        if (member.userId !== null && member.userId !== existing.userId && member.userId !== userId) continue;
      } else {
        // New members: the owner of a household created in this push, or
        // people without an account (they cannot sign in).
        const ownsNewHousehold =
          member.role === "owner" && member.userId === userId && createdHouseholds.has(member.householdId);
        if (!ownsNewHousehold && (member.role === "owner" || member.userId !== null)) continue;
      }
      await upsertLatest(tx, members, "id", member);
      applied++;
    }

    // Records of a removed member can still be deleted, but nothing new can
    // be booked to them (a phone that was offline might try).
    const memberHousehold = async (memberId: string, record: { deletedAt?: string | null }) => {
      const [row] = await tx
        .select({ householdId: members.householdId, deletedAt: members.deletedAt })
        .from(members)
        .where(eq(members.id, memberId));
      if (!row || (row.deletedAt !== null && !record.deletedAt)) return undefined;
      return row.householdId;
    };

    for (const settings of valid(paySettingsSchema, changes.paySettings)) {
      const householdId = await memberHousehold(settings.memberId, {});
      if (!householdId || !allowed.has(householdId)) continue;
      await upsertLatest(tx, paySettings, "memberId", settings);
      applied++;
    }

    for (const cost of valid(fixedCostSchema, changes.fixedCosts)) {
      const householdId = await memberHousehold(cost.memberId, cost);
      if (!householdId || !allowed.has(householdId)) continue;
      const [existing] = await tx.select({ memberId: fixedCosts.memberId }).from(fixedCosts).where(eq(fixedCosts.id, cost.id));
      if (existing && existing.memberId !== cost.memberId) continue;
      await upsertLatest(tx, fixedCosts, "id", cost);
      applied++;
    }

    for (const expense of valid(expenseSchema, changes.expenses)) {
      if (!allowed.has(expense.householdId)) continue;
      if ((await memberHousehold(expense.memberId, expense)) !== expense.householdId) continue;
      const [existing] = await tx.select({ householdId: expenses.householdId }).from(expenses).where(eq(expenses.id, expense.id));
      if (existing && existing.householdId !== expense.householdId) continue;
      await upsertLatest(tx, expenses, "id", expense);
      applied++;
    }

    for (const income of valid(incomeSchema, changes.incomes)) {
      if (!allowed.has(income.householdId)) continue;
      if ((await memberHousehold(income.memberId, income)) !== income.householdId) continue;
      const [existing] = await tx.select({ householdId: incomes.householdId }).from(incomes).where(eq(incomes.id, income.id));
      if (existing && existing.householdId !== income.householdId) continue;
      await upsertLatest(tx, incomes, "id", income);
      applied++;
    }

    for (const item of valid(receiptItemSchema, changes.receiptItems)) {
      const [expense] = await tx.select({ householdId: expenses.householdId }).from(expenses).where(eq(expenses.id, item.expenseId));
      if (!expense || !allowed.has(expense.householdId)) continue;
      const [existing] = await tx.select({ expenseId: receiptItems.expenseId }).from(receiptItems).where(eq(receiptItems.id, item.id));
      if (existing && existing.expenseId !== item.expenseId) continue;
      await upsertLatest(tx, receiptItems, "id", item);
      applied++;
    }

    return applied;
  });
}

/** Everything changed in the user's households since the cursor. */
async function pull(userId: string, cursor: number): Promise<SyncResponse> {
  // All tables are read from one snapshot. Read separately, a write that
  // commits in between could show up in one table and not yet in another,
  // and the cursor would move past the part that was missed.
  return db.transaction((tx) => pullSnapshot(tx, userId, cursor), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

async function pullSnapshot(tx: Tx, userId: string, cursor: number): Promise<SyncResponse> {
  const allowed = [...(await householdsOf(tx, userId))];
  if (allowed.length === 0) {
    return { cursor: String(cursor), more: false, changes: {} };
  }

  const memberIds = tx.select({ id: members.id }).from(members).where(inArray(members.householdId, allowed));
  const expenseIds = tx.select({ id: expenses.id }).from(expenses).where(inArray(expenses.householdId, allowed));

  const since = (serverSeq: AnyPgColumn) => gt(serverSeq, cursor);
  const h = await tx.select().from(households).where(and(inArray(households.id, allowed), since(households.serverSeq))).orderBy(households.serverSeq).limit(PULL_LIMIT);
  const m = await tx.select().from(members).where(and(inArray(members.householdId, allowed), since(members.serverSeq))).orderBy(members.serverSeq).limit(PULL_LIMIT);
  const p = await tx.select().from(paySettings).where(and(inArray(paySettings.memberId, memberIds), since(paySettings.serverSeq))).orderBy(paySettings.serverSeq).limit(PULL_LIMIT);
  const f = await tx.select().from(fixedCosts).where(and(inArray(fixedCosts.memberId, memberIds), since(fixedCosts.serverSeq))).orderBy(fixedCosts.serverSeq).limit(PULL_LIMIT);
  const e = await tx.select().from(expenses).where(and(inArray(expenses.householdId, allowed), since(expenses.serverSeq))).orderBy(expenses.serverSeq).limit(PULL_LIMIT);
  const r = await tx.select().from(receiptItems).where(and(inArray(receiptItems.expenseId, expenseIds), since(receiptItems.serverSeq))).orderBy(receiptItems.serverSeq).limit(PULL_LIMIT);
  const i = await tx.select().from(incomes).where(and(inArray(incomes.householdId, allowed), since(incomes.serverSeq))).orderBy(incomes.serverSeq).limit(PULL_LIMIT);

  // A table that hit the limit may have more rows after its last one. The new
  // cursor must not pass that row, or the rest would never be sent; rows of
  // other tables above it simply come again next time (merging is idempotent).
  const tables = [h, m, p, f, e, r, i] as { serverSeq: number }[][];
  const cut = tables.filter((rows) => rows.length >= PULL_LIMIT).map((rows) => rows[rows.length - 1].serverSeq);
  const highest = tables.flat().reduce((max, row) => Math.max(max, row.serverSeq), cursor);
  const nextCursor = cut.length > 0 ? Math.min(...cut) : highest;

  return {
    cursor: String(nextCursor),
    more: cut.length > 0,
    changes: {
      households: h.map(toRecord),
      members: m.map(toRecord),
      paySettings: p.map(toRecord),
      fixedCosts: f.map(toRecord),
      expenses: e.map(toRecord),
      receiptItems: r.map(toRecord),
      incomes: i.map(toRecord),
    } as ChangeSet,
  };
}

export async function syncForUser(
  userId: string,
  cursor: string | null,
  changes: ChangeSet,
): Promise<SyncResponse & { applied: number }> {
  const applied = await push(userId, changes);
  const parsedCursor = Number(cursor ?? 0);
  const response = await pull(userId, Number.isSafeInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0);
  return { ...response, applied };
}
