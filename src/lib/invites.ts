"use client";

import { requestSync } from "@/lib/local/sync-status";

/*
 * Invites live only on the server, so these calls need a connection.
 */

export type Invite = { id: string; createdAt: string; expiresAt: string };
export type NewInvite = Invite & { code: string };

export type InviteError =
  | "not_owner"
  | "too_many"
  | "invalid_code"
  | "already_in_household"
  | "rate_limited"
  | "invalid_input"
  | "unauthorized"
  | "offline"
  | "unknown";

type Result<T> = { ok: true; value: T } | { ok: false; error: InviteError };

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  const data = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, value: data as T } : { ok: false, error: (data.error as InviteError) ?? "unknown" };
}

export function createInvite() {
  return call<NewInvite>("/api/invites", { method: "POST" });
}

export async function listInvites(): Promise<Result<Invite[]>> {
  const result = await call<{ invites: Invite[] }>("/api/invites");
  return result.ok ? { ok: true, value: result.value.invites } : result;
}

export function revokeInvite(id: string) {
  return call<{ revoked: true }>(`/api/invites/${id}`, { method: "DELETE" });
}

/** Joins a household with a code, then brings its data onto this device. */
export async function joinHousehold(code: string, name: string): Promise<Result<{ householdId: string }>> {
  const result = await call<{ householdId: string }>("/api/invites/join", { method: "POST", body: { code, name } });
  if (result.ok) await requestSync();
  return result;
}

export const INVITE_ERROR_TEXT: Record<InviteError, string> = {
  not_owner: "Only the person who set up the household can invite others.",
  too_many: "You already have 5 open codes. Revoke one before creating another.",
  invalid_code: "This code does not work. It may be mistyped, used, revoked or expired. Ask for a new one.",
  already_in_household: "You are already in a household.",
  rate_limited: "Too many tries. Please wait a while and try again.",
  invalid_input: "Enter the code and your name.",
  unauthorized: "Please sign in again.",
  offline: "You are offline. Invites need a connection.",
  unknown: "Something went wrong. Please try again.",
};

/** A link that opens HomeFund with the code filled in. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
}
