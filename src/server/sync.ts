import "server-only";
import { and, eq, getTableColumns, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import {
  expenses,
  fixedCosts,
  households,
  members,
  paySettings,
  receiptItems,
} from "@/db/schema";
import type { ChangeSet, SyncResponse } from "@/lib/local/sync";
import {
  expenseSchema,
  fixedCostSchema,
  householdSchema,
  memberSchema,
  paySettingsSchema,
  receiptItemSchema,
} from "@/lib/model";
import { db, type Db } from "@/server/db";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Changes stamped further in the future than this are rejected. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
/** Most records returned in one pull. */
const PULL_LIMIT = 5_000;

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
  return db.transaction(async (tx) => {
    let applied = 0;
    const allowed = await householdsOf(tx, userId);

    const incomingMembers = valid(memberSchema, changes.members);
    const createdHouseholds = new Set<string>();

    // Households: existing ones the user belongs to, or brand-new ones the user creates as owner.
    for (const household of valid(householdSchema, changes.households)) {
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
    const ownerOf = new Set(
      (
        await tx
          .select({ householdId: members.householdId })
          .from(members)
          .where(and(eq(members.userId, userId), eq(members.role, "owner"), isNull(members.deletedAt)))
      ).map((r) => r.householdId),
    );
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

    const memberHousehold = async (memberId: string) => {
      const [row] = await tx.select({ householdId: members.householdId }).from(members).where(eq(members.id, memberId));
      return row?.householdId;
    };

    for (const settings of valid(paySettingsSchema, changes.paySettings)) {
      const householdId = await memberHousehold(settings.memberId);
      if (!householdId || !allowed.has(householdId)) continue;
      await upsertLatest(tx, paySettings, "memberId", settings);
      applied++;
    }

    for (const cost of valid(fixedCostSchema, changes.fixedCosts)) {
      const householdId = await memberHousehold(cost.memberId);
      if (!householdId || !allowed.has(householdId)) continue;
      const [existing] = await tx.select({ memberId: fixedCosts.memberId }).from(fixedCosts).where(eq(fixedCosts.id, cost.id));
      if (existing && existing.memberId !== cost.memberId) continue;
      await upsertLatest(tx, fixedCosts, "id", cost);
      applied++;
    }

    for (const expense of valid(expenseSchema, changes.expenses)) {
      if (!allowed.has(expense.householdId)) continue;
      if ((await memberHousehold(expense.memberId)) !== expense.householdId) continue;
      const [existing] = await tx.select({ householdId: expenses.householdId }).from(expenses).where(eq(expenses.id, expense.id));
      if (existing && existing.householdId !== expense.householdId) continue;
      await upsertLatest(tx, expenses, "id", expense);
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
  const allowed = [...(await householdsOf(db, userId))];
  if (allowed.length === 0) {
    return { cursor: String(cursor), changes: {} };
  }

  const memberIds = db.select({ id: members.id }).from(members).where(inArray(members.householdId, allowed));
  const expenseIds = db.select({ id: expenses.id }).from(expenses).where(inArray(expenses.householdId, allowed));

  const [h, m, p, f, e, r] = await Promise.all([
    db.select().from(households).where(and(inArray(households.id, allowed), gt(households.serverSeq, cursor))).limit(PULL_LIMIT),
    db.select().from(members).where(and(inArray(members.householdId, allowed), gt(members.serverSeq, cursor))).limit(PULL_LIMIT),
    db.select().from(paySettings).where(and(inArray(paySettings.memberId, memberIds), gt(paySettings.serverSeq, cursor))).limit(PULL_LIMIT),
    db.select().from(fixedCosts).where(and(inArray(fixedCosts.memberId, memberIds), gt(fixedCosts.serverSeq, cursor))).limit(PULL_LIMIT),
    db.select().from(expenses).where(and(inArray(expenses.householdId, allowed), gt(expenses.serverSeq, cursor))).limit(PULL_LIMIT),
    db.select().from(receiptItems).where(and(inArray(receiptItems.expenseId, expenseIds), gt(receiptItems.serverSeq, cursor))).limit(PULL_LIMIT),
  ]);

  const all = [h, m, p, f, e, r].flat() as { serverSeq: number }[];
  const nextCursor = all.reduce((max, row) => Math.max(max, row.serverSeq), cursor);

  return {
    cursor: String(nextCursor),
    changes: {
      households: h.map(toRecord),
      members: m.map(toRecord),
      paySettings: p.map(toRecord),
      fixedCosts: f.map(toRecord),
      expenses: e.map(toRecord),
      receiptItems: r.map(toRecord),
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
