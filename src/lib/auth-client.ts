"use client";

import { useEffect, useState } from "react";
import { localDb, SYNCED_TABLES } from "@/lib/local/db";
import { DELETE_CONFIRMATION, type DeleteAccountError } from "@/lib/account";
import type { SignInInput, SignUpInput } from "@/lib/auth-schema";

/*
 * The session itself is an HttpOnly cookie the browser script cannot read.
 * The device keeps a copy of who is signed in (no tokens) so the app can
 * open offline.
 */

export type CurrentUser = { id: string; email: string; name: string };

const USER_KEY = "currentUser";

export type AuthError =
  | "invalid_input"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "weak_password"
  | "too_many_requests"
  | "offline"
  | "unknown";

type Result<T> = { ok: true; value: T } | { ok: false; error: AuthError };

async function post<T>(path: string, body?: unknown): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: (data.error as AuthError) ?? "unknown" };
  }
  return { ok: true, value: data as T };
}

async function rememberUser(user: CurrentUser) {
  await localDb().meta.put({ key: USER_KEY, value: JSON.stringify(user) });
}

/** Who used the device last, kept after their session ends so another person's sign-in starts clean. */
const PREVIOUS_USER_KEY = "previousUserId";

async function forgetUser() {
  const user = await cachedUser();
  if (user) await localDb().meta.put({ key: PREVIOUS_USER_KEY, value: user.id });
  await localDb().meta.delete(USER_KEY);
}

export async function cachedUser(): Promise<CurrentUser | null> {
  const entry = await localDb().meta.get(USER_KEY);
  return entry ? (JSON.parse(entry.value) as CurrentUser) : null;
}

/** Keeps the device's data only if it belongs to the person signing in. */
async function startSession(user: CurrentUser) {
  const previous = (await cachedUser())?.id ?? (await localDb().meta.get(PREVIOUS_USER_KEY))?.value;
  if (previous && previous !== user.id) await clearDeviceData();
  await localDb().meta.delete(PREVIOUS_USER_KEY);
  await rememberUser(user);
}

export async function signUp(
  input: SignUpInput,
): Promise<Result<{ status: "signed_in" | "check_email" }>> {
  const result = await post<{ status: "signed_in" | "check_email"; user?: CurrentUser }>(
    "/api/auth/signup",
    input,
  );
  if (result.ok && result.value.user) await startSession(result.value.user);
  return result.ok ? { ok: true, value: { status: result.value.status } } : result;
}

export async function signIn(input: SignInInput): Promise<Result<CurrentUser>> {
  const result = await post<{ user: CurrentUser }>("/api/auth/signin", input);
  if (!result.ok) return result;
  await startSession(result.value.user);
  return { ok: true, value: result.value.user };
}

/** Signs in to a fresh demo family, made for this visit only. */
export async function startDemo(): Promise<Result<CurrentUser>> {
  const result = await post<{ user: CurrentUser }>("/api/demo");
  if (!result.ok) return result;
  await startSession(result.value.user);
  return { ok: true, value: result.value.user };
}

/** Signs out and removes all HomeFund data from this device. */
export async function signOut(): Promise<void> {
  await post("/api/auth/signout");
  await clearDeviceData();
}

/**
 * Deletes the account and all its data on the server, then everything
 * HomeFund keeps on this device. The device is only cleared once the server
 * confirmed, so a failed attempt can simply be tried again.
 */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; error: DeleteAccountError }> {
  let response: Response;
  try {
    response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ confirm: DELETE_CONFIRMATION }),
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  if (response.status === 401) return { ok: false, error: "unauthorized" };
  if (!response.ok) return { ok: false, error: "unknown" };
  await clearDeviceData();
  return { ok: true };
}

/** Removes everything HomeFund keeps on this device. */
async function clearDeviceData() {
  const db = localDb();
  await db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
    await Promise.all([...SYNCED_TABLES.map((t) => db.table(t).clear()), db.outbox.clear(), db.meta.clear()]);
  });
}

/**
 * Checks the session with the server. Online: the server decides.
 * Offline: the copy on the device is used.
 */
export async function loadCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      const { error } = await response.json().catch(() => ({ error: null }));
      if (error === "account_gone") await clearDeviceData();
      else await forgetUser();
      return null;
    }
    if (response.ok) {
      const { user } = (await response.json()) as { user: CurrentUser };
      await rememberUser(user);
      return user;
    }
  } catch {
    // Offline: fall through to the device copy.
  }
  return cachedUser();
}

export type AuthState = { status: "loading" } | { status: "signed_out" } | { status: "signed_in"; user: CurrentUser };

export function useCurrentUser(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    loadCurrentUser().then((user) => {
      if (active) setState(user ? { status: "signed_in", user } : { status: "signed_out" });
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export const AUTH_ERROR_TEXT: Record<AuthError, string> = {
  invalid_input: "Please check the fields and try again.",
  invalid_credentials: "Wrong email or password.",
  email_not_confirmed: "Please confirm your email first. Check your inbox.",
  weak_password: "This password is too easy to guess. Try a longer one.",
  too_many_requests: "Too many attempts. Please wait a few minutes and try again.",
  offline: "You are offline. Connect to the internet to continue.",
  unknown: "Something went wrong. Please try again.",
};
