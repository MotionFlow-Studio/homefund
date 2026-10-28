"use client";

import { ArrowLeft, Copy, Share2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth-client";
import { useHouseholdMembers } from "@/lib/expenses";
import { useMyHousehold } from "@/lib/household";
import { formatInviteCode, INVITE_HOURS } from "@/lib/invite-code";
import {
  createInvite,
  INVITE_ERROR_TEXT,
  inviteLink,
  listInvites,
  revokeInvite,
  type Invite,
  type NewInvite,
} from "@/lib/invites";
import type { Household, Member } from "@/lib/model";
import { LoadingScreen } from "@/components/loading";

export function HouseholdScreen() {
  const router = useRouter();
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
    else if (auth.status === "signed_in" && household.status === "none") router.replace("/app");
  }, [auth.status, household.status, router]);

  if (auth.status !== "signed_in" || household.status !== "ready") {
    return <LoadingScreen />;
  }
  return <Family household={household.household} me={household.me} />;
}

const ROLE_LABEL: Record<Member["role"], string> = { owner: "Set up the household", adult: "Adult", child: "Child" };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Family({ household, me }: { household: Household; me: Member }) {
  const members = useHouseholdMembers(household.id) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-lg font-semibold">{household.name}</h1>
      </header>

      <section aria-labelledby="members-title">
        <h2 id="members-title" className="mb-2 text-sm font-medium">
          Family members
        </h2>
        <ul className="divide-y divide-black/5 rounded-3xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {members.map((member) => (
            <li key={member.id}>
              <Link
                href={`/app/member?id=${member.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <span className="size-9 shrink-0 rounded-full" style={{ backgroundColor: member.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {member.name}
                    {member.id === me.id ? <span className="opacity-60"> (you)</span> : null}
                  </span>
                  <span className="block text-xs opacity-60">{ROLE_LABEL[member.role]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {members.length === 1 && me.role === "owner" ? (
          <p className="mt-2 text-sm opacity-70">Just you so far. Invite your partner below to budget together.</p>
        ) : null}
      </section>

      {me.role === "owner" ? (
        <Invites />
      ) : (
        <p className="text-sm opacity-70">Only the person who set up the household can invite others.</p>
      )}
    </main>
  );
}

/** Create, share and revoke invite codes. A code is shown only right after it is made. */
function Invites() {
  const [open, setOpen] = useState<Invite[] | null>(null);
  const [fresh, setFresh] = useState<NewInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const result = await listInvites();
    if (result.ok) setOpen(result.value);
    else setError(INVITE_ERROR_TEXT[result.error]);
  }, []);

  useEffect(() => {
    let current = true;
    listInvites().then((result) => {
      if (!current) return;
      if (result.ok) setOpen(result.value);
      else setError(INVITE_ERROR_TEXT[result.error]);
    });
    return () => {
      current = false;
    };
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await createInvite();
    setBusy(false);
    if (!result.ok) return setError(INVITE_ERROR_TEXT[result.error]);
    setFresh(result.value);
    await refresh();
  }

  async function revoke(id: string) {
    setError(null);
    const result = await revokeInvite(id);
    if (!result.ok && result.error !== "unknown") return setError(INVITE_ERROR_TEXT[result.error]);
    if (fresh?.id === id) setFresh(null);
    await refresh();
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(formatInviteCode(code));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function share(code: string) {
    const text = `Join our household on HomeFund with this code: ${formatInviteCode(code)}`;
    try {
      await navigator.share({ title: "HomeFund invite", text, url: inviteLink(code) });
    } catch {
      // The share sheet was closed; nothing to do.
    }
  }

  return (
    <section aria-labelledby="invite-title" className="flex flex-col gap-3">
      <h2 id="invite-title" className="text-sm font-medium">
        Invite an adult
      </h2>
      <p className="text-sm opacity-75">
        Your partner or another adult can join with a code. Each code works once and for {INVITE_HOURS} hours.
      </p>

      {fresh ? (
        <div className="rounded-3xl bg-brand p-5 text-white">
          <p className="text-sm text-white/85">Invite code</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-[0.15em]" aria-live="polite">
            {formatInviteCode(fresh.code)}
          </p>
          <p className="mt-2 text-sm text-white/85">Works once, until {when(fresh.expiresAt)}.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => copy(fresh.code)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/15 font-semibold active:bg-white/25"
            >
              <Copy size={18} aria-hidden /> {copied ? "Copied" : "Copy"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <button
                type="button"
                onClick={() => share(fresh.code)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-brand active:scale-[0.98]"
              >
                <Share2 size={18} aria-hidden /> Share
              </button>
            ) : (
              <span />
            )}
          </div>
          <p className="mt-3 text-xs text-white/75">For your safety the code is shown only now.</p>
        </div>
      ) : null}

      <Button onClick={create} loading={busy} variant={fresh ? "secondary" : "primary"}>
        <UserPlus size={20} aria-hidden className="mr-2" /> {fresh ? "Create another code" : "Create invite code"}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {open && open.length > 0 ? (
        <div>
          <h3 className="mt-2 mb-2 text-sm font-medium">Open codes</h3>
          <ul className="divide-y divide-black/5 rounded-3xl border border-black/10 dark:divide-white/10 dark:border-white/10">
            {open.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">Created {when(invite.createdAt)}</span>
                  <span className="block opacity-60">Expires {when(invite.expiresAt)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => revoke(invite.id)}
                  className="h-9 rounded-full border border-red-600/30 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
