"use client";

import { useEffect } from "react";
import { startAutoSync, useSyncStatus } from "@/lib/local/sync-status";

/** Registers the service worker and keeps local data in sync. */
export function OfflineProvider() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
    return startAutoSync();
  }, []);

  return <ConnectionBanner />;
}

function ConnectionBanner() {
  const { state, pending } = useSyncStatus();
  if (state !== "offline") return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      You are offline. Everything still works
      {pending > 0 ? ` and ${pending} change${pending === 1 ? "" : "s"} will sync` : " and changes will sync"}{" "}
      when you are back online.
    </div>
  );
}
