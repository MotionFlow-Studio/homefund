"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { CategoryId } from "@/lib/categories";
import { localDb } from "@/lib/local/db";
import { deleteExpense, newId, saveExpense } from "@/lib/local/store";
import type { Expense, Member } from "@/lib/model";

/** Records a manual expense on the device; it syncs in the background. */
export function addManualExpense(input: {
  householdId: string;
  memberId: string;
  userId: string | null;
  amountMinor: number;
  category: CategoryId;
  spentOn: string;
  note: string;
}): Promise<Expense> {
  return saveExpense({
    id: newId(),
    householdId: input.householdId,
    memberId: input.memberId,
    amountMinor: input.amountMinor,
    category: input.category,
    spentOn: input.spentOn,
    merchant: null,
    note: cleanNote(input.note),
    source: "manual",
    createdByUserId: input.userId,
  });
}

/** Changes the editable fields of an existing expense. */
export function updateExpense(
  expense: Expense,
  changes: { amountMinor: number; category: CategoryId; spentOn: string; note: string; memberId: string },
): Promise<Expense> {
  return saveExpense({
    id: expense.id,
    householdId: expense.householdId,
    memberId: changes.memberId,
    amountMinor: changes.amountMinor,
    category: changes.category,
    spentOn: changes.spentOn,
    merchant: expense.merchant,
    note: cleanNote(changes.note),
    source: expense.source,
    createdByUserId: expense.createdByUserId,
    createdAt: expense.createdAt,
  });
}

/** Brings back a deleted expense (used by Undo). */
export function restoreExpense(expense: Expense): Promise<Expense> {
  return saveExpense({
    id: expense.id,
    householdId: expense.householdId,
    memberId: expense.memberId,
    amountMinor: expense.amountMinor,
    category: expense.category,
    spentOn: expense.spentOn,
    merchant: expense.merchant,
    note: expense.note,
    source: expense.source,
    createdByUserId: expense.createdByUserId,
    createdAt: expense.createdAt,
  });
}

export function removeExpense(id: string) {
  return deleteExpense(id);
}

function cleanNote(note: string): string | null {
  const trimmed = note.trim();
  return trimmed ? trimmed.slice(0, 280) : null;
}

/** All live expenses of a household, newest first. */
export function useHouseholdExpenses(householdId: string): Expense[] | undefined {
  return useLiveQuery(
    async () =>
      (await localDb().expenses.where("householdId").equals(householdId).toArray())
        .filter((e) => e.deletedAt === null)
        .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt)),
    [householdId],
  );
}

/** Live members of a household, owner first. */
export function useHouseholdMembers(householdId: string): Member[] | undefined {
  return useLiveQuery(
    async () =>
      (await localDb().members.where("householdId").equals(householdId).toArray())
        .filter((m) => m.deletedAt === null)
        .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name))),
    [householdId],
  );
}
