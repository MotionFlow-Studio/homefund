"use client";

import type { CategoryId } from "@/lib/categories";
import { deleteExpense, newId, saveExpense } from "@/lib/local/store";
import type { Expense } from "@/lib/model";

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
  const note = input.note.trim();
  return saveExpense({
    id: newId(),
    householdId: input.householdId,
    memberId: input.memberId,
    amountMinor: input.amountMinor,
    category: input.category,
    spentOn: input.spentOn,
    merchant: null,
    note: note ? note.slice(0, 280) : null,
    source: "manual",
    createdByUserId: input.userId,
  });
}

export function undoExpense(id: string) {
  return deleteExpense(id);
}
