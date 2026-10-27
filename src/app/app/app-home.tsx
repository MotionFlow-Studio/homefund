"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut, useCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import { usePaySettings } from "@/lib/pay-settings";
import { formatMoney } from "@/lib/money";
import type { Household, Member } from "@/lib/model";
import { requestSync } from "@/lib/local/sync-status";
import { CreateHousehold } from "./create-household";
import { PaySetup } from "./pay-setup";

export function AppHome() {
  const router = useRouter();
  const auth = useCurrentUser();

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
  }, [auth.status, router]);

  if (auth.status !== "signed_in") return <Loading />;
  return <SignedIn user={auth.user} />;
}

function Loading() {
  return <main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>;
}

function SignedIn({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const household = useMyHousehold(user.id);
  const [checkedServer, setCheckedServer] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // A household made on another device arrives with the first sync.
  useEffect(() => {
    requestSync().finally(() => setCheckedServer(true));
  }, []);

  if (household.status === "loading" || (household.status === "none" && !checkedServer)) return <Loading />;
  if (household.status === "none") return <CreateHousehold user={user} />;

  return <Ready household={household.household} me={household.me} onSignOut={onSignOut} signingOut={signingOut} />;

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/signin");
  }
}

function Ready({
  household,
  me,
  onSignOut,
  signingOut,
}: {
  household: Household;
  me: Member;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const pay = usePaySettings(me.id);
  const [editingPay, setEditingPay] = useState(false);

  if (pay.status === "loading") return <Loading />;
  if (!pay.settings || editingPay) {
    return (
      <PaySetup
        memberId={me.id}
        currency={household.currency}
        settings={pay.settings}
        fixedCosts={pay.fixedCosts}
        onDone={() => setEditingPay(false)}
        onCancel={pay.settings ? () => setEditingPay(false) : undefined}
      />
    );
  }

  const fixedTotal = pay.fixedCosts.reduce((sum, c) => sum + c.amountMinor, 0);
  const available = pay.settings.incomeMinor - fixedTotal - pay.settings.savingsGoalMinor;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm opacity-70">{household.name}</p>
        <h1 className="text-2xl font-semibold">Hi {me.name}</h1>
      </div>
      <div className="rounded-2xl bg-brand/10 p-4">
        <p className="text-sm opacity-80">To spend each pay period</p>
        <p className="text-2xl font-semibold tabular-nums">{formatMoney(available, household.currency)}</p>
        <p className="mt-1 text-sm opacity-70">Payday on day {pay.settings.paydayDay} of the month</p>
      </div>
      <Button variant="secondary" onClick={() => setEditingPay(true)}>
        Edit payday and costs
      </Button>
      <Button variant="secondary" onClick={onSignOut} loading={signingOut}>
        Sign out
      </Button>
    </main>
  );
}
