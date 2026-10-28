"use client";

import { ArrowLeft, ChevronRight, LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CurrencyPicker } from "@/components/currency-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DELETE_CONFIRMATION, DELETE_ERROR_TEXT } from "@/lib/account";
import { deleteAccount, signOut, useCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { useHouseholdMembers } from "@/lib/expenses";
import { changeHouseholdCurrency, renameHousehold, renameMember, useMyHousehold } from "@/lib/household";
import { requestSync } from "@/lib/local/sync-status";
import { pendingChanges } from "@/lib/local/store";
import { currencyDecimals, formatMoney } from "@/lib/money";
import type { Household, Member } from "@/lib/model";
import { usePaySettings } from "@/lib/pay-settings";
import { ordinal, PaySetup } from "../pay-setup";
import { LoadingScreen } from "@/components/loading";

export function SettingsScreen() {
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
  return <Settings user={auth.user} household={household.household} me={household.me} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="card p-5">
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 lg:max-w-2xl lg:px-10 lg:pt-10">
      <header className="flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-black/5 hidden dark:hover:bg-white/10"
        >
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-2xl font-bold tracking-tight lg:text-3xl">Settings</h1>
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

      <Section title="Appearance">
        <ThemePicker />
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

      <DeleteData household={household} me={me} />
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

/** Permanently deletes the account and its data, after spelling out what goes and what stays. */
function DeleteData({ household, me }: { household: Household; me: Member }) {
  const members = useHouseholdMembers(household.id) ?? [];
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The adult who joined first takes over the household, as on the server.
  const othersWithAccount = members
    .filter((m) => m.userId !== null && m.id !== me.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const shared = othersWithAccount.length > 0;
  const withoutAccount = members.filter((m) => m.userId === null).length;
  const confirmed = typed.trim().toUpperCase() === DELETE_CONFIRMATION;

  async function run() {
    setBusy(true);
    setError(null);
    const result = await deleteAccount();
    if (!result.ok) {
      setBusy(false);
      return setError(DELETE_ERROR_TEXT[result.error]);
    }
    // A full page load, so nothing of the old session stays in memory.
    window.location.replace("/deleted");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-2 py-2 text-sm font-medium text-red-600 dark:text-red-400"
      >
        <Trash2 size={16} aria-hidden /> Delete my data
      </button>
    );
  }

  return (
    <section
      aria-labelledby="delete-title"
      className="flex flex-col gap-4 rounded-3xl border border-red-600/30 p-5 dark:border-red-400/30"
    >
      <h2 id="delete-title" className="font-semibold text-red-700 dark:text-red-400">
        Delete my data
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
        <li>Your account is deleted and you are signed out on every device.</li>
        {shared ? (
          <>
            <li>
              Your expenses, your budget and your fixed costs are removed. {household.name} stays for the others, and
              your spending no longer counts in the family&apos;s numbers.
            </li>
            {me.role === "owner" ? <li>{othersWithAccount[0].name} will manage the household from now on.</li> : null}
          </>
        ) : (
          <li>
            {household.name} is deleted with every expense, receipt line and budget in it
            {withoutAccount > 0
              ? `, including ${withoutAccount} family ${withoutAccount === 1 ? "member" : "members"} without an account`
              : ""}
            .
          </li>
        )}
        <li>Everything HomeFund keeps on this phone is removed too.</li>
        <li className="font-medium">This cannot be undone.</li>
      </ul>
      <Field
        label={`Type ${DELETE_CONFIRMATION} to confirm`}
        name="confirm-delete"
        value={typed}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        onChange={(e) => setTyped(e.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button variant="danger" onClick={run} loading={busy} disabled={!confirmed}>
          Delete forever
        </Button>
      </div>
    </section>
  );
}

type Theme = "light" | "dark" | "system";

function readTheme(): Theme {
  try {
    const value = localStorage.getItem("hf-theme");
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

/** Light, dark or the phone's own setting; stored on this device only. */
function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  function choose(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("hf-theme", next);
    } catch {
      // Private mode: the choice lasts for this visit.
    }
    applyTheme(next);
  }

  const options: [Theme, string, typeof Sun][] = [
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
    ["system", "Auto", Monitor],
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {options.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => choose(value)}
          className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition ${
            theme === value
              ? "border-transparent bg-gradient-to-br from-teal-500 to-indigo-500 text-white shadow-md shadow-indigo-500/25"
              : "border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/5"
          }`}
        >
          <Icon size={20} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
