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

/**
 * A small label at the top while offline. It lets taps through and sits
 * above the screen's own buttons, so saving keeps working underneath it.
 */
function ConnectionBanner() {
  const { state, pending } = useSyncStatus();
  if (state !== "offline") return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-[max(0.375rem,env(safe-area-inset-top))]"
    >
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100">
        Offline ·{" "}
        {pending > 0 ? `${pending} change${pending === 1 ? "" : "s"} will sync later` : "changes will sync later"}
      </span>
    </div>
  );
}
