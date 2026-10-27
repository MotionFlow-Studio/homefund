"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut, useCurrentUser } from "@/lib/auth-client";

export function AppHome() {
  const router = useRouter();
  const auth = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
  }, [auth.status, router]);

  if (auth.status !== "signed_in") {
    return <main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>;
  }

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/signin");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Hi {auth.user.name || auth.user.email}</h1>
      <p className="opacity-80">You are signed in as {auth.user.email}.</p>
      <Button variant="secondary" onClick={onSignOut} loading={signingOut}>
        Sign out
      </Button>
    </main>
  );
}
