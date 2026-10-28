import "server-only";
import { createHash, randomInt } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { invites, members } from "@/db/schema";
import { INVITE_ALPHABET, INVITE_CODE_LENGTH, INVITE_HOURS, isInviteCode, normalizeInviteCode } from "@/lib/invite-code";
import { MEMBER_COLORS } from "@/lib/model";
import { db } from "@/server/db";

/** Most codes a household can have open at once. */
const MAX_OPEN_INVITES = 5;

export type InviteSummary = { id: string; createdAt: string; expiresAt: string };

export class InviteError extends Error {
  constructor(readonly code: "not_owner" | "too_many" | "invalid_code" | "already_in_household") {
    super(code);
  }
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function newCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

/** The household the user owns, or null. */
async function ownedHousehold(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: members.householdId })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.role, "owner"), isNull(members.deletedAt)));
  return row?.householdId ?? null;
}

const openInvite = (householdId: string, now: string) =>
  and(
    eq(invites.householdId, householdId),
    isNull(invites.usedAt),
    isNull(invites.revokedAt),
    gt(invites.expiresAt, now),
  );

/** Creates a code for the owner's household. The code is returned once and only its hash is kept. */
export async function createInvite(userId: string): Promise<InviteSummary & { code: string }> {
  const householdId = await ownedHousehold(userId);
  if (!householdId) throw new InviteError("not_owner");

  const now = new Date();
  const [{ open }] = await db
    .select({ open: sql<number>`count(*)::int` })
    .from(invites)
    .where(openInvite(householdId, now.toISOString()));
  if (open >= MAX_OPEN_INVITES) throw new InviteError("too_many");

  const code = newCode();
  const [row] = await db
    .insert(invites)
    .values({
      householdId,
      codeHash: hashCode(code),
      createdByUserId: userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INVITE_HOURS * 3_600_000).toISOString(),
    })
    .returning({ id: invites.id, createdAt: invites.createdAt, expiresAt: invites.expiresAt });
  return { ...row, code };
}

/** Codes of the owner's household that can still be used. */
export async function listInvites(userId: string): Promise<InviteSummary[]> {
  const householdId = await ownedHousehold(userId);
  if (!householdId) throw new InviteError("not_owner");
  return db
    .select({ id: invites.id, createdAt: invites.createdAt, expiresAt: invites.expiresAt })
    .from(invites)
    .where(openInvite(householdId, new Date().toISOString()))
    .orderBy(invites.createdAt);
}

/** Stops a code from working. Returns false if there was no such open code. */
export async function revokeInvite(userId: string, inviteId: string): Promise<boolean> {
  const householdId = await ownedHousehold(userId);
  if (!householdId) throw new InviteError("not_owner");
  const revoked = await db
    .update(invites)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(invites.id, inviteId), eq(invites.householdId, householdId), isNull(invites.usedAt), isNull(invites.revokedAt)))
    .returning({ id: invites.id });
  return revoked.length > 0;
}

/**
 * Adds the user to the household of a code, as an adult. The code is locked
 * while it is checked, so two people can never use it at the same time.
 * Wrong, expired, used and revoked codes all give the same answer.
 */
export async function joinWithCode(userId: string, typedCode: string, name: string): Promise<{ householdId: string }> {
  const code = normalizeInviteCode(typedCode);
  if (!isInviteCode(code)) throw new InviteError("invalid_code");

  return db.transaction(async (tx) => {
    // One join at a time per user, so two codes used at once cannot add them twice.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [mine] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, userId), isNull(members.deletedAt)));
    if (mine) throw new InviteError("already_in_household");

    const now = new Date().toISOString();
    const [invite] = await tx
      .select({ id: invites.id, householdId: invites.householdId })
      .from(invites)
      .where(and(eq(invites.codeHash, hashCode(code)), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, now)))
      .for("update");
    if (!invite) throw new InviteError("invalid_code");

    const taken = await tx
      .select({ color: members.color })
      .from(members)
      .where(and(eq(members.householdId, invite.householdId), isNull(members.deletedAt)));
    const used = new Set(taken.map((m) => m.color));
    const color = MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[taken.length % MEMBER_COLORS.length];

    await tx.insert(members).values({
      id: crypto.randomUUID(),
      householdId: invite.householdId,
      userId,
      name,
      role: "adult",
      color,
      birthYear: null,
      createdAt: now,
      updatedAt: now,
      serverSeq: sql`nextval('sync_seq')`,
    });
    await tx.update(invites).set({ usedAt: now, usedByUserId: userId }).where(eq(invites.id, invite.id));
    return { householdId: invite.householdId };
  });
}
