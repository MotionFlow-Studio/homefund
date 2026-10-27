"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { localDb } from "@/lib/local/db";
import { newId, saveHousehold, saveMember } from "@/lib/local/store";
import type { Household, Member } from "@/lib/model";

export const MEMBER_COLORS = ["#0f766e", "#2563eb", "#db2777", "#ea580c", "#7c3aed", "#ca8a04"];

export type HouseholdState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; household: Household; me: Member };

/** The signed-in user's household, read live from the device. */
export function useMyHousehold(userId: string): HouseholdState {
  const result = useLiveQuery(async () => {
    const db = localDb();
    const me = (await db.members.where("userId").equals(userId).toArray()).find((m) => m.deletedAt === null);
    if (!me) return { status: "none" } as const;
    const household = await db.households.get(me.householdId);
    if (!household || household.deletedAt !== null) return { status: "none" } as const;
    return { status: "ready", household, me } as const;
  }, [userId]);
  return result ?? { status: "loading" };
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
