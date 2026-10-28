"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { useCurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import { JoinHousehold } from "../app/join-household";
import { LoadingScreen } from "@/components/loading";

/** Opened from an invite link: /join?code=K7XQM3PA. */
export function JoinScreen() {
  const router = useRouter();
  const code = useSearchParams().get("code") ?? "";
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");
  const back = encodeURIComponent(`/join?code=${encodeURIComponent(code)}`);

  if (auth.status === "loading" || (auth.status === "signed_in" && household.status === "loading")) {
    return <LoadingScreen />;
  }

  if (auth.status === "signed_out") {
    return (
      <AuthCard title="You are invited" footer={null}>
        <p className="opacity-80">Create a HomeFund account or sign in, and you will join your family&rsquo;s household.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/signup?next=${back}`}
            className="flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-white"
          >
            Create an account
          </Link>
          <Link
            href={`/signin?next=${back}`}
            className="flex h-12 items-center justify-center rounded-xl border border-black/15 font-semibold dark:border-white/15"
          >
            I already have an account
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (household.status === "ready") {
    return (
      <AuthCard title="You are already in a household" footer={null}>
        <p className="opacity-80">An account can belong to one household. You are in {household.household.name}.</p>
        <Link href="/app" className="mt-6 flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-white">
          Open HomeFund
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Join your family" footer={null}>
      <JoinHousehold user={auth.user} initialCode={code} onJoined={() => router.replace("/app")} />
    </AuthCard>
  );
}
