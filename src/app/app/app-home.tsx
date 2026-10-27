"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut, useCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import { requestSync } from "@/lib/local/sync-status";
import { CreateHousehold } from "./create-household";

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

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/signin");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm opacity-70">{household.household.name}</p>
        <h1 className="text-2xl font-semibold">Hi {household.me.name}</h1>
      </div>
      <p className="opacity-80">
        Household currency: <span className="font-semibold">{household.household.currency}</span>
      </p>
      <Button variant="secondary" onClick={onSignOut} loading={signingOut}>
        Sign out
      </Button>
    </main>
  );
}
