"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut, useCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import { usePaySettings } from "@/lib/pay-settings";
import { useBudget } from "@/lib/use-budget";
import { formatMoney } from "@/lib/money";
import type { FixedCost, Household, Member, PaySettings } from "@/lib/model";
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

  return (
    <Dashboard
      household={household}
      me={me}
      settings={pay.settings}
      fixedCosts={pay.fixedCosts}
      onEditPay={() => setEditingPay(true)}
      onSignOut={onSignOut}
      signingOut={signingOut}
    />
  );
}

function Dashboard({
  household,
  me,
  settings,
  fixedCosts,
  onEditPay,
  onSignOut,
  signingOut,
}: {
  household: Household;
  me: Member;
  settings: PaySettings;
  fixedCosts: FixedCost[];
  onEditPay: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const budget = useBudget(me.id, settings, fixedCosts);
  if (!budget) return <Loading />;
  const money = (minor: number) => formatMoney(minor, household.currency);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm opacity-70">{household.name}</p>
        <h1 className="text-2xl font-semibold">Hi {me.name}</h1>
      </div>
      <section
        aria-label="Budget"
        className={`rounded-3xl p-6 ${budget.overspent ? "bg-red-50 dark:bg-red-950/40" : "bg-brand/10"}`}
      >
        <p className="text-sm opacity-80">Left until payday</p>
        <p
          className={`text-4xl font-semibold tabular-nums ${budget.overspent ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {money(budget.leftMinor)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm opacity-80">Per day</p>
            {budget.overspent ? (
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">Over budget</p>
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{money(budget.perDayMinor)}</p>
            )}
          </div>
          <div>
            <p className="text-sm opacity-80">Days to payday</p>
            <p className="text-2xl font-semibold tabular-nums">{budget.daysLeft}</p>
          </div>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          role="progressbar"
          aria-label="Spent this period"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={budget.availableMinor > 0 ? Math.min(100, Math.round((budget.spentMinor / budget.availableMinor) * 100)) : 100}
        >
          <div
            className={`h-full rounded-full ${budget.overspent ? "bg-red-500" : "bg-brand"}`}
            style={{
              width: `${budget.availableMinor > 0 ? Math.min(100, (budget.spentMinor / budget.availableMinor) * 100) : 100}%`,
            }}
          />
        </div>
        <p className="mt-2 text-sm opacity-70">
          {budget.availableMinor > 0
            ? `${money(budget.spentMinor)} spent of ${money(budget.availableMinor)}`
            : `${money(budget.spentMinor)} spent`}
        </p>
        {budget.availableMinor < 0 ? (
          <p role="alert" className="mt-4 rounded-xl bg-white/70 p-3 text-sm font-medium text-red-700 dark:bg-black/30 dark:text-red-300">
            Your fixed costs and savings are {money(-budget.availableMinor)} more than your income. Check them with
            “Edit payday and costs”.
          </p>
        ) : budget.overspent ? (
          <p role="alert" className="mt-4 rounded-xl bg-white/70 p-3 text-sm font-medium text-red-700 dark:bg-black/30 dark:text-red-300">
            You are {money(-budget.leftMinor)} over budget for this pay period. Try to hold off on spending until{" "}
            {new Date(`${budget.nextPayday}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
          </p>
        ) : budget.availableMinor === 0 ? (
          <p className="mt-4 text-sm opacity-80">Add your income to see what you can spend.</p>
        ) : null}
      </section>
      <Button variant="secondary" onClick={onEditPay}>
        Edit payday and costs
      </Button>
      <Button variant="secondary" onClick={onSignOut} loading={signingOut}>
        Sign out
      </Button>
    </main>
  );
}
