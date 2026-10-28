"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { localDb } from "@/lib/local/db";
import { newId, saveHousehold, saveMember, saveRecord } from "@/lib/local/store";
import { currencyDecimals, rescaleMinor } from "@/lib/money";
import { MEMBER_COLORS, type Household, type Member } from "@/lib/model";

export { MEMBER_COLORS };


export type HouseholdState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; household: Household; me: Member };

/** The signed-in user's household, read live from the device. */
export function useMyHousehold(userId: string): HouseholdState {
  const result = useLiveQuery(async () => {
    if (!userId) return { userId, state: { status: "loading" } as HouseholdState };
    const db = localDb();
    const me = (await db.members.where("userId").equals(userId).toArray()).find((m) => m.deletedAt === null);
    const household = me ? await db.households.get(me.householdId) : undefined;
    const state: HouseholdState =
      me && household && household.deletedAt === null ? { status: "ready", household, me } : { status: "none" };
    return { userId, state };
  }, [userId]);
  // While the query re-runs for a new user, the previous answer must not be used.
  return result && result.userId === userId ? result.state : { status: "loading" };
}

/** Creates a household with the user as its owner, on the device first. */
export async function createHousehold(input: {
  userId: string;
  householdName: string;
  currency: string;
  memberName: string;
}) {
  const household = await saveHousehold({
    id: newId(),
    name: input.householdName.trim(),
    currency: input.currency,
  });
  const me = await saveMember({
    id: newId(),
    householdId: household.id,
    userId: input.userId,
    name: input.memberName.trim(),
    role: "owner",
    color: MEMBER_COLORS[0],
    birthYear: null,
  });
  return { household, me };
}

/** Renames the household. */
export function renameHousehold(household: Household, name: string) {
  return saveHousehold({ id: household.id, name: name.trim(), currency: household.currency, createdAt: household.createdAt });
}

/** Changes the name the family sees for a member. */
export function renameMember(member: Member, name: string) {
  return saveMember({
    id: member.id,
    householdId: member.householdId,
    userId: member.userId,
    name: name.trim(),
    role: member.role,
    color: member.color,
    birthYear: member.birthYear,
    createdAt: member.createdAt,
  });
}

/**
 * Corrects the household currency. Amounts keep their numbers (100.00 RON
 * becomes 100.00 EUR); when the new currency has different decimals, every
 * stored amount of the household is re-expressed so the numbers stay the same.
 * Returns how many amounts were rewritten.
 */
export async function changeHouseholdCurrency(household: Household, currency: string): Promise<number> {
  const from = household.currency;
  let rewritten = 0;
  if (currencyDecimals(from) !== currencyDecimals(currency)) {
    const db = localDb();
    const rescale = (minor: number) => rescaleMinor(minor, from, currency);
    const members = await db.members.where("householdId").equals(household.id).toArray();
    const memberIds = members.map((m) => m.id);

    for (const settings of (await db.paySettings.bulkGet(memberIds)).filter((s) => s !== undefined)) {
      await saveRecord("paySettings", {
        memberId: settings.memberId,
        paydayDay: settings.paydayDay,
        incomeMinor: rescale(settings.incomeMinor),
        savingsGoalMinor: rescale(settings.savingsGoalMinor),
        createdAt: settings.createdAt,
      });
      rewritten += 2;
    }
    for (const cost of await db.fixedCosts.where("memberId").anyOf(memberIds).toArray()) {
      if (cost.deletedAt !== null) continue;
      await saveRecord("fixedCosts", { id: cost.id, memberId: cost.memberId, name: cost.name, amountMinor: rescale(cost.amountMinor), createdAt: cost.createdAt });
      rewritten++;
    }
    const expenses = (await db.expenses.where("householdId").equals(household.id).toArray()).filter((e) => e.deletedAt === null);
    for (const expense of expenses) {
      // saveRecord stamps a new updatedAt, so the change wins on every device.
      await saveRecord("expenses", { ...expense, amountMinor: Math.max(1, rescale(expense.amountMinor)) });
      rewritten++;
    }
    for (const item of await db.receiptItems.where("expenseId").anyOf(expenses.map((e) => e.id)).toArray()) {
      if (item.deletedAt !== null) continue;
      await saveRecord("receiptItems", { ...item, lineTotalMinor: rescale(item.lineTotalMinor) });
      rewritten++;
    }
  }
  await saveHousehold({ id: household.id, name: household.name, currency, createdAt: household.createdAt });
  return rewritten;
}
