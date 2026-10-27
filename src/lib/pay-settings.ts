"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { localDb } from "@/lib/local/db";
import { deleteRecord, newId, saveRecord } from "@/lib/local/store";
import type { FixedCost, PaySettings } from "@/lib/model";

export type PayState =
  | { status: "loading" }
  | { status: "ready"; settings: PaySettings | null; fixedCosts: FixedCost[] };

/** A member's payday settings and fixed costs, read live from the device. */
export function usePaySettings(memberId: string): PayState {
  const result = useLiveQuery(async () => {
    const db = localDb();
    const settings = (await db.paySettings.get(memberId)) ?? null;
    const fixedCosts = (await db.fixedCosts.where("memberId").equals(memberId).toArray())
      .filter((c) => c.deletedAt === null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { status: "ready", settings, fixedCosts } as const;
  }, [memberId]);
  return result ?? { status: "loading" };
}

export type FixedCostDraft = { id?: string; name: string; amountMinor: number };

/** Saves payday settings and replaces the member's list of fixed costs. */
export async function savePaySettings(input: {
  memberId: string;
  paydayDay: number;
  incomeMinor: number;
  savingsGoalMinor: number;
  fixedCosts: FixedCostDraft[];
  previousFixedCosts: FixedCost[];
}) {
  await saveRecord("paySettings", {
    memberId: input.memberId,
    paydayDay: input.paydayDay,
    incomeMinor: input.incomeMinor,
    savingsGoalMinor: input.savingsGoalMinor,
  });

  const keep = new Set<string>();
  for (const cost of input.fixedCosts) {
    const id = cost.id ?? newId();
    keep.add(id);
    const previous = input.previousFixedCosts.find((c) => c.id === id);
    if (previous && previous.name === cost.name && previous.amountMinor === cost.amountMinor) continue;
    await saveRecord("fixedCosts", { id, memberId: input.memberId, name: cost.name, amountMinor: cost.amountMinor });
  }
  for (const previous of input.previousFixedCosts) {
    if (!keep.has(previous.id)) await deleteRecord("fixedCosts", previous.id);
  }
}
