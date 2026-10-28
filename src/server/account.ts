import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { expenses, fixedCosts, households, invites, members, paySettings, receiptItems } from "@/db/schema";
import { db } from "@/server/db";
import { lockSyncWrites } from "@/server/sync";

/*
 * Deleting an account removes everything that belongs to the person.
 *
 * - A household nobody else signs in to is deleted completely, with its
 *   members, expenses, receipt lines, budgets and invites.
 * - In a household shared with other accounts, the person's own records are
 *   removed: their member entry, budget, fixed costs and the expenses booked
 *   to them. The other phones still hold copies of those records, so each one
 *   is kept as an empty tombstone (marked deleted, every name, note and amount
 *   wiped) that tells those phones to drop it. If the person set up the
 *   household, the adult who joined first becomes the owner.
 * - Finally the login account itself is deleted, which also ends every
 *   session on every device.
 */

export type DeletionSummary = { householdsDeleted: number; householdsLeft: number };

const nextSeq = sql`nextval('sync_seq')`;
/** Placeholder text for wiped records; the shared model needs a non-empty name. */
const WIPED = "Deleted";

export async function deleteAccount(userId: string): Promise<DeletionSummary> {
  return db.transaction(async (tx) => {
    await lockSyncWrites(tx);
    const now = new Date().toISOString();
    const summary: DeletionSummary = { householdsDeleted: 0, householdsLeft: 0 };

    const mine = await tx
      .select({ id: members.id, householdId: members.householdId, role: members.role })
      .from(members)
      .where(and(eq(members.userId, userId), isNull(members.deletedAt)));

    for (const me of mine) {
      const householdId = me.householdId;
      const others = await tx
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.householdId, householdId),
            isNotNull(members.userId),
            ne(members.userId, userId),
            isNull(members.deletedAt),
          ),
        )
        .orderBy(asc(members.createdAt), asc(members.id));

      if (others.length === 0) {
        await deleteHousehold(tx, householdId);
        summary.householdsDeleted++;
        continue;
      }

      // Hand the household over before leaving it.
      if (me.role === "owner") {
        await tx
          .update(members)
          .set({ role: "owner", updatedAt: now, serverSeq: nextSeq })
          .where(eq(members.id, others[0].id));
      }

      const myExpenses = tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.memberId, me.id));
      await tx
        .update(receiptItems)
        .set({ name: WIPED, quantityMilli: 1000, unitPrice: null, lineTotalMinor: 0, category: "other", deletedAt: now, updatedAt: now, serverSeq: nextSeq })
        .where(inArray(receiptItems.expenseId, myExpenses));
      await tx
        .update(expenses)
        .set({ amountMinor: 1, category: "other", merchant: null, note: null, deletedAt: now, updatedAt: now, serverSeq: nextSeq })
        .where(eq(expenses.memberId, me.id));
      await tx
        .update(fixedCosts)
        .set({ name: WIPED, amountMinor: 0, deletedAt: now, updatedAt: now, serverSeq: nextSeq })
        .where(eq(fixedCosts.memberId, me.id));
      await tx
        .update(paySettings)
        .set({ paydayDay: 1, incomeMinor: 0, savingsGoalMinor: 0, updatedAt: now, serverSeq: nextSeq })
        .where(eq(paySettings.memberId, me.id));
      await tx
        .update(members)
        .set({ name: WIPED, userId: null, birthYear: null, deletedAt: now, updatedAt: now, serverSeq: nextSeq })
        .where(eq(members.id, me.id));
      await tx
        .delete(invites)
        .where(and(eq(invites.householdId, householdId), eq(invites.createdByUserId, userId), isNull(invites.usedAt)));
      summary.householdsLeft++;
    }

    // Removes the login account and its sessions. Links to it in records that
    // stay (who typed in an expense, who used an invite) are cleared by the
    // foreign keys.
    await tx.execute(sql`delete from auth.users where id = ${userId}`);
    return summary;
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function deleteHousehold(tx: Tx, householdId: string) {
  const memberIds = tx.select({ id: members.id }).from(members).where(eq(members.householdId, householdId));
  const expenseIds = tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.householdId, householdId));
  await tx.delete(invites).where(eq(invites.householdId, householdId));
  await tx.delete(receiptItems).where(inArray(receiptItems.expenseId, expenseIds));
  await tx.delete(expenses).where(eq(expenses.householdId, householdId));
  await tx.delete(fixedCosts).where(inArray(fixedCosts.memberId, memberIds));
  await tx.delete(paySettings).where(inArray(paySettings.memberId, memberIds));
  await tx.delete(members).where(eq(members.householdId, householdId));
  await tx.delete(households).where(eq(households.id, householdId));
}
