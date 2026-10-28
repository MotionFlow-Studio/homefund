"use client";

import { ArrowLeft, ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CurrencyPicker } from "@/components/currency-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { signOut, useCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { changeHouseholdCurrency, renameHousehold, renameMember, useMyHousehold } from "@/lib/household";
import { requestSync } from "@/lib/local/sync-status";
import { pendingChanges } from "@/lib/local/store";
import { currencyDecimals, formatMoney } from "@/lib/money";
import type { Household, Member } from "@/lib/model";
import { usePaySettings } from "@/lib/pay-settings";
import { ordinal, PaySetup } from "../pay-setup";

export function SettingsScreen() {
  const router = useRouter();
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
    else if (auth.status === "signed_in" && household.status === "none") router.replace("/app");
  }, [auth.status, household.status, router]);

  if (auth.status !== "signed_in" || household.status !== "ready") {
    return <main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>;
  }
  return <Settings user={auth.user} household={household.household} me={household.me} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Saved({ show }: { show: boolean }) {
  return show ? (
    <span role="status" className="text-sm font-medium text-brand">
      Saved
    </span>
  ) : null;
}

function Settings({ user, household, me }: { user: CurrentUser; household: Household; me: Member }) {
  const router = useRouter();
  const pay = usePaySettings(me.id);
  const [editingPay, setEditingPay] = useState(false);
  const isOwner = me.role === "owner";

  if (editingPay && pay.status === "ready") {
    return (
      <PaySetup
        memberId={me.id}
        currency={household.currency}
        settings={pay.settings}
        fixedCosts={pay.fixedCosts}
        onDone={() => setEditingPay(false)}
        onCancel={() => setEditingPay(false)}
      />
    );
  }

  const money = (minor: number) => formatMoney(minor, household.currency);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Settings</h1>
      </header>

      <Section title="Profile">
        <NameForm label="Your name" initial={me.name} max={60} onSave={(name) => renameMember(me, name)} />
        <p className="mt-4 text-sm">
          <span className="opacity-60">Signed in as </span>
          <span className="font-medium break-all">{user.email}</span>
        </p>
      </Section>

      <Section title="Your budget">
        <button
          type="button"
          onClick={() => setEditingPay(true)}
          disabled={pay.status !== "ready"}
          className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Payday, income and costs</span>
            <span className="block text-sm opacity-70">
              {pay.status === "ready" && pay.settings
                ? `Payday on the ${ordinal(pay.settings.paydayDay)} · income ${money(pay.settings.incomeMinor)}` +
                  (pay.fixedCosts.length > 0
                    ? ` · ${pay.fixedCosts.length} fixed ${pay.fixedCosts.length === 1 ? "cost" : "costs"}`
                    : "")
                : "Not set yet"}
            </span>
          </span>
          <ChevronRight size={20} aria-hidden className="opacity-50" />
        </button>
      </Section>

      <Section title="Household">
        {isOwner ? (
          <>
            <NameForm label="Household name" initial={household.name} max={80} onSave={(name) => renameHousehold(household, name)} />
            <CurrencySetting household={household} />
          </>
        ) : (
          <div className="text-sm">
            <p className="font-medium">{household.name}</p>
            <p className="mt-1 opacity-70">
              Currency {household.currency}. Only the person who set up the household can change these.
            </p>
          </div>
        )}
        <Link href="/app/household" className="mt-4 inline-block text-sm font-semibold text-brand">
          Family members and invites
        </Link>
      </Section>

      <SignOut onSignedOut={() => router.replace("/signin")} />
    </main>
  );
}

/** A single name field that saves on demand. */
function NameForm({
  label,
  initial,
  max,
  onSave,
}: {
  label: string;
  initial: string;
  max: number;
  onSave: (name: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const changed = value.trim() !== initial;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return setError("Enter a name");
    setError(undefined);
    await onSave(value);
    setSaved(true);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Field
        label={label}
        name={label.toLowerCase().replace(/\W+/g, "-")}
        value={value}
        maxLength={max}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        error={error}
      />
      <div className="flex items-center gap-3">
        {changed ? (
          <Button type="submit" variant="secondary" className="h-10 px-4 text-sm">
            Save
          </Button>
        ) : null}
        <Saved show={saved && !changed} />
      </div>
    </form>
  );
}

/** Corrects the household currency, after saying what will happen to the amounts. */
function CurrencySetting({ household }: { household: Household }) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(household.currency);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  const decimalsChange = currencyDecimals(currency) !== currencyDecimals(household.currency);

  async function apply() {
    setSaving(true);
    await changeHouseholdCurrency(household, currency);
    void requestSync();
    setSaving(false);
    setOpen(false);
    setDone(true);
  }

  if (!open) {
    return (
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">Currency</p>
          <p className="opacity-70">
            {names.of(household.currency)} ({household.currency})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Saved show={done} />
          <Button
            variant="secondary"
            className="h-10 px-4 text-sm"
            onClick={() => {
              setCurrency(household.currency);
              setDone(false);
              setOpen(true);
            }}
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <CurrencyPicker value={currency} onChange={setCurrency} />
      {currency !== household.currency ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          All amounts keep their numbers: {formatMoney(10_000 * 10 ** (currencyDecimals(household.currency) - 2), household.currency)} becomes{" "}
          {formatMoney(10_000 * 10 ** (currencyDecimals(currency) - 2), currency)}. Nothing is converted at an exchange rate, so
          use this to fix a wrong choice.
          {decimalsChange ? ` ${currency} uses ${currencyDecimals(currency)} decimals, so amounts are rounded to fit.` : ""}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={apply} loading={saving} disabled={currency === household.currency}>
          Use {currency}
        </Button>
      </div>
    </div>
  );
}

/** Signs out. Unsynced changes would be lost, so it tries to send them first and warns if it cannot. */
function SignOut({ onSignedOut }: { onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [unsynced, setUnsynced] = useState(0);

  async function run(force = false) {
    setBusy(true);
    if (!force) {
      await requestSync();
      const pending = await pendingChanges();
      if (pending > 0) {
        setUnsynced(pending);
        setBusy(false);
        return;
      }
    }
    await signOut();
    onSignedOut();
  }

  return (
    <section aria-label="Account" className="flex flex-col gap-3">
      {unsynced > 0 ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {unsynced} {unsynced === 1 ? "change has" : "changes have"} not reached the server yet, probably because you are
          offline. Signing out now would lose {unsynced === 1 ? "it" : "them"}.
        </p>
      ) : null}
      <Button variant="secondary" onClick={() => run(unsynced > 0)} loading={busy} className="text-red-600 dark:text-red-400">
        <LogOut size={18} aria-hidden className="mr-2" />
        {unsynced > 0 ? "Sign out anyway" : "Sign out"}
      </Button>
    </section>
  );
}
