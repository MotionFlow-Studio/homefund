"use client";

import { Camera, ChartPie, Home, LogOut, ReceiptText, Settings2, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut, useCurrentUser } from "@/lib/auth-client";
import { isDemoEmail } from "@/lib/demo";
import { useMyHousehold } from "@/lib/household";
import type { Member } from "@/lib/model";

/*
 * The frame around every signed-in screen: a sidebar on wide screens and a
 * tab bar on phones. It appears once the household is set up; sign-in,
 * household setup and the first payday screen stay full screen.
 */

type Item = { href: string; label: string; icon: typeof Home; match: (path: string) => boolean };

const ITEMS: Item[] = [
  { href: "/app", label: "Home", icon: Home, match: (p) => p === "/app" },
  { href: "/app/expenses", label: "Activity", icon: ReceiptText, match: (p) => p.startsWith("/app/expenses") },
  { href: "/app/scan", label: "Scan", icon: Camera, match: (p) => p.startsWith("/app/scan") },
  {
    href: "/app/overview",
    label: "Family",
    icon: ChartPie,
    match: (p) => p.startsWith("/app/overview") || p.startsWith("/app/member") || p.startsWith("/app/household"),
  },
  { href: "/app/settings", label: "Settings", icon: Settings2, match: (p) => p.startsWith("/app/settings") },
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");
  const ready = household.status === "ready";
  // The camera and the receipt check use the whole phone screen.
  const focused = path.startsWith("/app/scan");

  if (!ready) return <>{children}</>;
  const demo = auth.status === "signed_in" && isDemoEmail(auth.user.email);

  return (
    <div className="flex min-h-dvh flex-1">
      <Sidebar path={path} householdName={household.household.name} me={household.me} />
      <div className={`flex min-w-0 flex-1 flex-col lg:pl-64 ${focused ? "" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"}`}>
        {demo && !focused ? <DemoBanner /> : null}
        {children}
      </div>
      {focused ? null : <TabBar path={path} />}
    </div>
  );
}

function Sidebar({ path, householdName, me }: { path: string; householdName: string; me: Member }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-black/[0.06] bg-white/70 px-4 py-6 backdrop-blur-xl lg:flex dark:border-white/[0.07] dark:bg-white/[0.02]">
      <Link href="/app" className="flex items-center gap-2.5 px-3 text-lg font-semibold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={32} height={32} className="rounded-[9px]" />
        HomeFund
      </Link>

      <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium transition ${
                active
                  ? "bg-gradient-to-r from-teal-500 to-indigo-500 text-white shadow-md shadow-indigo-500/25"
                  : "text-black/65 hover:bg-black/[0.04] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white"
              }`}
            >
              <Icon size={19} aria-hidden />
              {label === "Scan" ? "Scan receipt" : label === "Activity" ? "Transactions" : label}
            </Link>
          );
        })}
        <Link
          href="/app/household"
          className="mt-4 flex h-11 items-center gap-3 rounded-xl border border-dashed border-black/15 px-3 text-[0.95rem] font-medium text-black/65 transition hover:border-brand hover:text-brand dark:border-white/15 dark:text-white/60 dark:hover:border-teal-300 dark:hover:text-teal-200"
        >
          <UserPlus size={19} aria-hidden /> Invite to family
        </Link>
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: me.color }}
          aria-hidden
        >
          {initials(me.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{me.name}</span>
          <span className="block truncate text-xs opacity-60">{householdName}</span>
        </span>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await signOut();
            router.replace("/signin");
          }}
          className="flex size-9 items-center justify-center rounded-full opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <LogOut size={17} aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** Shown in the demo family, with the way to a real account. */
function DemoBanner() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] lg:max-w-6xl lg:px-10 lg:pt-6">
      <div className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm text-white shadow-lg shadow-indigo-500/20">
        <Sparkles size={17} className="shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 leading-snug">
          <strong className="font-semibold">Demo family.</strong>{" "}
          <span className="opacity-90">Try anything, it resets after a day.</span>
        </p>
        <button
          type="button"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            await signOut();
            router.replace("/signup");
          }}
          className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60"
        >
          Create my own
        </button>
      </div>
    </div>
  );
}

function TabBar({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden dark:border-white/[0.08]"
    >
      <div className="mx-auto grid h-[4.5rem] max-w-md grid-cols-5 items-center px-2">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          if (label === "Scan") {
            return (
              <Link key={href} href={href} aria-label="Scan receipt" className="flex justify-center">
                <span className="-mt-7 flex size-15 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-indigo-600 text-white shadow-[0_10px_30px_-6px_rgba(13,148,136,0.7)] ring-4 ring-background transition active:scale-95">
                  <Camera size={26} aria-hidden />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 text-[0.7rem] font-semibold transition ${
                active ? "text-indigo-600 dark:text-teal-300" : "text-black/45 dark:text-white/45"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
