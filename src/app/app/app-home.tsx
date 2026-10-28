"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import { usePaySettings } from "@/lib/pay-settings";
import type { Household, Member } from "@/lib/model";
import { requestSync } from "@/lib/local/sync-status";
import { CreateHousehold } from "./create-household";
import { Dashboard } from "./dashboard";
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

  if (pay.status === "loading") return <Loading />;
  // First run: set the payday. Later changes are made in Settings.
  if (!pay.settings) {
    return (
      <PaySetup
        memberId={me.id}
        currency={household.currency}
        settings={null}
        fixedCosts={pay.fixedCosts}
        onDone={() => undefined}
      />
    );
  }

  return (
    <Dashboard
      household={household}
      me={me}
      settings={pay.settings}
      fixedCosts={pay.fixedCosts}
      onSignOut={onSignOut}
      signingOut={signingOut}
    />
  );
}
