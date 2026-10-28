"use client";

import { ArrowLeft, Mic, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { addDays, localToday } from "@/lib/budget";
import { saveIncome } from "@/lib/expenses";
import { INCOME_SOURCE_LIST } from "@/lib/income-sources";
import { currencyDecimals, formatAmountInput, toMinor } from "@/lib/money";
import type { Household, Income, IncomeSource, Member } from "@/lib/model";
import { KindSwitch } from "./expense-form";

type Props = {
  household: Household;
  me: Member;
  members?: Member[];
  /** When given, the form edits this income instead of adding a new one. */
  income?: Income;
  onClose: () => void;
  onSaved: (income: Income) => void;
  onDelete?: (income: Income) => void;
  /** Shown when adding: switches the form back to an expense. */
  onSwitchToExpense?: () => void;
  /** Values understood from speech, to confirm. */
  initial?: { amountMinor: number | null; source: IncomeSource | null; note: string | null; date: string | null };
  /** What was said, shown above the form. */
  heard?: string;
};

/** Records money received on top of the pay. It adds to what can be spent until payday. */
export function IncomeForm({ household, me, members = [], income, onClose, onSaved, onDelete, onSwitchToExpense, initial, heard }: Props) {
  const today = localToday();
  const [amount, setAmount] = useState(() =>
    income
      ? formatAmountInput(income.amountMinor, household.currency)
      : initial?.amountMinor
        ? formatAmountInput(initial.amountMinor, household.currency)
        : "",
  );
  const [source, setSource] = useState<IncomeSource | null>(income?.source ?? initial?.source ?? null);
  const [receivedOn, setReceivedOn] = useState(income?.receivedOn ?? (initial?.date && initial.date <= today ? initial.date : today));
  const [memberId, setMemberId] = useState(income?.memberId ?? me.id);
  const [note, setNote] = useState(income?.note ?? initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const decimals = currencyDecimals(household.currency);

  useEffect(() => {
    if (!income) amountRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, income]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    let amountMinor: number;
    try {
      amountMinor = toMinor(amount || "x", household.currency);
    } catch {
      setError("Enter an amount");
      amountRef.current?.focus();
      return;
    }
    if (amountMinor <= 0) return setError("The amount must be more than zero");
    if (!source) return setError("Choose where the money came from");
    if (receivedOn > today) return setError("The date cannot be in the future");
    setError(null);
    setSaving(true);
    const saved = await saveIncome({
      id: income?.id,
      householdId: household.id,
      memberId,
      userId: income?.createdByUserId ?? me.userId,
      amountMinor,
      source,
      receivedOn,
      note,
      createdAt: income?.createdAt,
    });
    onSaved(saved);
  }

  const dateChip = (value: string, label: string) => (
    <button
      type="button"
      onClick={() => setReceivedOn(value)}
      aria-pressed={receivedOn === value}
      className={`h-10 rounded-full border px-4 text-sm font-medium transition ${
        receivedOn === value
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="income-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-background lg:bg-black/50 lg:py-12 lg:backdrop-blur-sm"
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:min-h-0 lg:rounded-3xl lg:bg-background lg:p-8 lg:shadow-2xl"
      >
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 id="income-title" className="flex-1 text-lg font-semibold">
            {income ? "Edit income" : "Add income"}
          </h1>
          {income && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(income)}
              aria-label="Delete income"
              className="flex size-11 items-center justify-center rounded-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 size={20} />
            </button>
          ) : null}
        </header>

        {onSwitchToExpense ? <KindSwitch kind="income" onSwitch={onSwitchToExpense} /> : null}
        {heard ? (
          <p className="flex items-start gap-2 rounded-2xl bg-indigo-500/10 px-4 py-3 text-sm">
            <Mic size={16} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden />
            <span>
              <span className="opacity-60">Heard: </span>“{heard}”
            </span>
          </p>
        ) : null}


        <label className="flex flex-col items-center gap-2 py-2">
          <span className="text-sm opacity-70">Amount received</span>
          <span className="flex items-baseline gap-2 text-emerald-600 dark:text-emerald-400">
            <span className="text-4xl font-bold">+</span>
            <input
              ref={amountRef}
              inputMode={decimals > 0 ? "decimal" : "numeric"}
              autoComplete="off"
              enterKeyHint="done"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d.,]/g, ""));
                setError(null);
              }}
              placeholder="0"
              aria-label={`Amount received in ${household.currency}`}
              className="max-w-[11ch] bg-transparent text-right text-5xl font-bold tabular-nums outline-none placeholder:opacity-30"
              style={{ width: `${Math.max(1, amount.length) + 0.4}ch` }}
            />
            <span className="font-mono text-lg opacity-70">{household.currency}</span>
          </span>
          <span className="text-center text-xs opacity-60">Adds to what you can spend until payday.</span>
        </label>

        <fieldset>
          <legend className="mb-3 text-sm font-medium">Where it came from</legend>
          <div className="grid grid-cols-4 gap-2">
            {INCOME_SOURCE_LIST.map(({ id, label, icon: Icon, color }) => {
              const selected = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSource(id);
                    setError(null);
                  }}
                  aria-pressed={selected}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-transparent p-2 text-[0.7rem] leading-tight font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
                  style={selected ? { backgroundColor: `${color}26`, borderColor: color } : undefined}
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: selected ? color : `${color}1f`, color: selected ? "#fff" : color }}
                  >
                    <Icon size={20} strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="text-center">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-medium">Date</legend>
          <div className="flex flex-wrap items-center gap-2">
            {dateChip(today, "Today")}
            {dateChip(addDays(today, -1), "Yesterday")}
            <input
              type="date"
              value={receivedOn}
              max={today}
              onChange={(e) => e.target.value && setReceivedOn(e.target.value)}
              aria-label="Pick another date"
              className="h-10 rounded-full border border-black/15 bg-transparent px-3 text-sm dark:border-white/15"
            />
          </div>
        </fieldset>

        {members.length > 1 ? (
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Who received it</legend>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMemberId(m.id)}
                  aria-pressed={memberId === m.id}
                  className={`flex h-10 items-center gap-2 rounded-full border pr-4 pl-1 text-sm font-medium transition ${
                    memberId === m.id ? "border-emerald-500 bg-emerald-500/10" : "border-black/15 dark:border-white/15"
                  }`}
                >
                  <span className="size-8 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
                  {m.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="For example: sold the old bike"
            className="h-12 rounded-xl border border-black/15 bg-white px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-white/15 dark:bg-white/5"
          />
        </label>

        <div className="mt-auto flex flex-col gap-3">
          {error ? (
            <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={saving} variant="success">
            {income ? "Save changes" : "Add income"}
          </Button>
        </div>
      </form>
    </div>
  );
}
