"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { addDays, localToday } from "@/lib/budget";
import { CATEGORY_LIST, type CategoryId } from "@/lib/categories";
import { addManualExpense } from "@/lib/expenses";
import { currencyDecimals, toMinor } from "@/lib/money";
import type { Expense, Household, Member } from "@/lib/model";

type Props = {
  household: Household;
  me: Member;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
};

export function AddExpense({ household, me, onClose, onSaved }: Props) {
  const today = localToday();
  const yesterday = addDays(today, -1);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [spentOn, setSpentOn] = useState(today);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const decimals = currencyDecimals(household.currency);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    let amountMinor: number;
    try {
      amountMinor = toMinor(amount || "x", household.currency);
    } catch {
      setError(
        decimals > 0
          ? `Enter an amount, for example 12${decimals ? "." + "5".padEnd(decimals, "0") : ""}`
          : "Enter an amount",
      );
      amountRef.current?.focus();
      return;
    }
    if (amountMinor <= 0) {
      setError("The amount must be more than zero");
      return;
    }
    if (!category) {
      setError("Choose a category");
      return;
    }
    if (spentOn > today) {
      setError("The date cannot be in the future");
      return;
    }
    setError(null);
    setSaving(true);
    const expense = await addManualExpense({
      householdId: household.id,
      memberId: me.id,
      userId: me.userId,
      amountMinor,
      category,
      spentOn,
      note,
    });
    onSaved(expense);
  }

  const dateChip = (value: string, label: string) => (
    <button
      type="button"
      onClick={() => setSpentOn(value)}
      aria-pressed={spentOn === value}
      className={`h-10 rounded-full border px-4 text-sm font-medium transition ${
        spentOn === value
          ? "border-brand bg-brand text-white"
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
      aria-labelledby="add-expense-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-background"
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      >
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 id="add-expense-title" className="text-lg font-semibold">
            Add expense
          </h1>
        </header>

        <label className="flex flex-col items-center gap-2 py-2">
          <span className="text-sm opacity-70">Amount</span>
          <span className="flex items-baseline gap-2">
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
              aria-label={`Amount in ${household.currency}`}
              className="max-w-[11ch] bg-transparent text-right text-5xl font-bold tabular-nums outline-none placeholder:opacity-30"
              style={{ width: `${Math.max(1, amount.length) + 0.4}ch` }}
            />
            <span className="font-mono text-lg opacity-60">{household.currency}</span>
          </span>
        </label>

        <fieldset>
          <legend className="mb-3 text-sm font-medium">Category</legend>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORY_LIST.map(({ id, label, icon: Icon, color }) => {
              const selected = category === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCategory(id);
                    setError(null);
                  }}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-[0.7rem] font-medium leading-tight transition ${
                    selected ? "border-transparent" : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  style={selected ? { backgroundColor: `${color}26`, borderColor: color } : undefined}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full"
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

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium">Date</legend>
          <div className="flex flex-wrap items-center gap-2">
            {dateChip(today, "Today")}
            {dateChip(yesterday, "Yesterday")}
            <input
              type="date"
              value={spentOn}
              max={today}
              onChange={(e) => e.target.value && setSpentOn(e.target.value)}
              aria-label="Pick another date"
              className="h-10 rounded-full border border-black/15 bg-transparent px-3 text-sm dark:border-white/15"
            />
          </div>
        </fieldset>

        {showNote ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="What was it for?"
              autoFocus
              className="h-12 rounded-xl border border-black/15 bg-white px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
            />
          </label>
        ) : (
          <button type="button" onClick={() => setShowNote(true)} className="self-start text-sm font-medium text-brand">
            + Add a note
          </button>
        )}

        <div className="mt-auto flex flex-col gap-3">
          {error ? (
            <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={saving}>
            Save expense
          </Button>
        </div>
      </form>
    </div>
  );
}
