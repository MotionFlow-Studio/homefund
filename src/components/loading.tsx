import type { ReactNode } from "react";

/*
 * Loading and empty states shared by every screen. Loading indicators fade in
 * after a short delay, so data that is already on the device (the usual case)
 * shows up without a flash.
 */

/** A whole screen that is still loading: the app mark, gently pulsing. */
export function LoadingScreen() {
  return (
    <main className="flex flex-1 items-center justify-center" role="status" aria-live="polite">
      <span className="loading-appear flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={56} height={56} className="animate-pulse rounded-[1rem]" />
        <span className="text-sm opacity-60">Loading…</span>
      </span>
    </main>
  );
}

/** A grey placeholder in the shape of content that is on its way. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-xl bg-black/[0.07] dark:bg-white/[0.09] ${className}`} />;
}

/** Placeholder rows for a list of expenses. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="loading-appear flex flex-col gap-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="size-10 rounded-full" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </span>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** The home screen's layout while its numbers are being worked out. */
export function HomeSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading"
      className="loading-appear mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]"
    >
      <div className="flex items-center justify-between">
        <span className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-32" />
        </span>
        <Skeleton className="size-11 rounded-full" />
      </div>
      <Skeleton className="h-72 rounded-[2rem]" />
      <div className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
        <Skeleton className="mb-4 h-4 w-36" />
        <ListSkeleton rows={3} />
      </div>
    </main>
  );
}

/** A friendly note where content will appear once there is some. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  compact = false,
}: {
  icon: ReactNode;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? "mt-3 gap-2 rounded-2xl bg-black/[0.03] px-4 py-5 dark:bg-white/[0.04]" : "mt-14 gap-3"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-brand/10 text-brand ${compact ? "size-10" : "size-14"}`}
        aria-hidden
      >
        {icon}
      </span>
      {title ? <p className="font-semibold">{title}</p> : null}
      <p className={`max-w-xs text-sm ${compact ? "opacity-75" : "opacity-70"}`}>{children}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
