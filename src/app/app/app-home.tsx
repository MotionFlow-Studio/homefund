"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import { usePaySettings } from "@/lib/pay-settings";
import type { Household, Member } from "@/lib/model";
import { localDb } from "@/lib/local/db";
import { CURSOR_KEY } from "@/lib/local/sync";
import { requestSync } from "@/lib/local/sync-status";
import { CreateHousehold } from "./create-household";
import { Dashboard } from "./dashboard";
import { PaySetup } from "./pay-setup";
import { HomeSkeleton, LoadingScreen } from "@/components/loading";

export function AppHome() {
  const router = useRouter();
  const auth = useCurrentUser();

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
  }, [auth.status, router]);

  if (auth.status !== "signed_in") return <LoadingScreen />;
  return <SignedIn user={auth.user} />;
}

/** True once this device has completed a sync with the server. */
async function hasSynced() {
  return (await localDb().meta.get(CURSOR_KEY)) !== undefined;
}

function Unreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand" aria-hidden>
        <CloudOff size={26} />
      </span>
      <h1 className="text-lg font-semibold">Cannot reach HomeFund</h1>
      <p className="text-sm opacity-70">
        Your household is loaded the first time this phone connects. Check your internet connection and try again.
      </p>
      <Button onClick={onRetry} className="mt-2">
        Try again
      </Button>
    </main>
  );
}

function SignedIn({ user }: { user: CurrentUser }) {
  const household = useMyHousehold(user.id);
  const [server, setServer] = useState<"checking" | "synced" | "unreachable">("checking");

  // A household made on another device arrives with the first sync. Until
  // one sync has worked, "no household here" may just mean "not loaded yet",
  // so offering to create one could make a second household by mistake.
  const check = useCallback(async () => {
    setServer("checking");
    await requestSync();
    setServer((await hasSynced()) ? "synced" : "unreachable");
  }, []);

  useEffect(() => {
    let active = true;
    requestSync()
      .then(hasSynced)
      .then((synced) => active && setServer(synced ? "synced" : "unreachable"));
    window.addEventListener("online", check);
    return () => {
      active = false;
      window.removeEventListener("online", check);
    };
  }, [check]);

  if (household.status === "loading" || (household.status === "none" && server === "checking")) return <HomeSkeleton />;
  if (household.status === "none" && server === "unreachable") return <Unreachable onRetry={check} />;
  if (household.status === "none") return <CreateHousehold user={user} />;

  return <Ready household={household.household} me={household.me} />;
}

function Ready({ household, me }: { household: Household; me: Member }) {
  const pay = usePaySettings(me.id);

  if (pay.status === "loading") return <HomeSkeleton />;
  // First run: set the payday. Later changes are made in Settings.
  if (!pay.settings) {
    return (
      <PaySetup
        memberId={me.id}
        currency={household.currency}
        settings={null}
        fixedCosts={pay.fixedCosts}
        onDone={() => undefined}
        step={2}
      />
    );
  }

  return (
    <Dashboard
      household={household}
      me={me}
      settings={pay.settings}
      fixedCosts={pay.fixedCosts}
    />
  );
}
