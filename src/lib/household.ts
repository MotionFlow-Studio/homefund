"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { localDb } from "@/lib/local/db";
import { newId, saveHousehold, saveMember } from "@/lib/local/store";
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
