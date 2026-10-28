"use client";

import { useSyncExternalStore } from "react";
import { localDb } from "@/lib/local/db";
import { CHANGED_EVENT, pendingChanges } from "@/lib/local/store";
import { OfflineError, syncOnce } from "@/lib/local/sync";

/*
 * Keeps the device in sync automatically: on start, when the connection
 * comes back, when the app returns to the foreground, a second after local
 * changes, and every 10 seconds while the app is on screen, so what one
 * family member adds shows up on the others' phones within seconds.
 */

export type SyncState = "idle" | "syncing" | "offline" | "error";

type Status = { state: SyncState; pending: number; lastSyncedAt: string | null };

let status: Status = { state: "idle", pending: 0, lastSyncedAt: null };
const listeners = new Set<() => void>();

function setStatus(next: Partial<Status>) {
  status = { ...status, ...next };
  listeners.forEach((listener) => listener());
}

let running: Promise<void> | null = null;
let again = false;

/** Starts a sync round, or schedules one more if a round is already running. */
export function requestSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      // Nothing to sync until someone is signed in on this device.
      if (!(await localDb().meta.get("currentUser"))) break;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus({ state: "offline", pending: await pendingChanges() });
        break;
      }
      setStatus({ state: "syncing" });
      try {
        await syncOnce();
        setStatus({ state: "idle", lastSyncedAt: new Date().toISOString() });
      } catch (error) {
        setStatus({ state: error instanceof OfflineError ? "offline" : "error" });
        break;
      } finally {
        setStatus({ pending: await pendingChanges() });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let started = false;

/** Wires up the automatic sync triggers. Call once in the browser. */
export function startAutoSync(intervalMs = 10_000): () => void {
  if (started) return () => {};
  started = true;

  const onOnline = () => void requestSync();
  const onOffline = () => setStatus({ state: "offline" });
  const onVisible = () => {
    if (document.visibilityState === "visible") void requestSync();
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  let debounce: number | undefined;
  const onChanged = () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void requestSync(), 1_000);
  };
  window.addEventListener(CHANGED_EVENT, onChanged);
  // Only while on screen: a phone in a pocket should not keep calling home.
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") void requestSync();
  }, intervalMs);
  void requestSync();

  return () => {
    started = false;
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener(CHANGED_EVENT, onChanged);
    window.clearTimeout(debounce);
    window.clearInterval(timer);
  };
}

/** Current sync status for the UI. */
export function useSyncStatus(): Status {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => status,
  );
}
