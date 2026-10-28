"use client";

import { ArrowDownLeft, ArrowUpRight, Camera, Plus, ReceiptText, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { addDays, localToday } from "@/lib/budget";
import { CATEGORY_LIST, getCategory, type CategoryId } from "@/lib/categories";
import { useCurrentUser } from "@/lib/auth-client";
import {
  removeExpense,
  removeIncome,
  restoreExpense,
  restoreIncome,
  useHouseholdExpenses,
  useHouseholdIncomes,
  useHouseholdMembers,
} from "@/lib/expenses";
import { getIncomeSource } from "@/lib/income-sources";
import { useMyHousehold } from "@/lib/household";
import { formatMoney } from "@/lib/money";
import type { Expense, Household, Income, Member } from "@/lib/model";
import { ExpenseForm } from "../expense-form";
import { IncomeForm } from "../income-form";
import { EmptyState, ListSkeleton, LoadingScreen } from "@/components/loading";

export function ExpensesScreen() {
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
  return <ExpenseList household={household.household} me={household.me} />;
}

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  });
}

type Entry =
  | { kind: "expense"; id: string; date: string; createdAt: string; amountMinor: number; memberId: string; item: Expense }
  | { kind: "income"; id: string; date: string; createdAt: string; amountMinor: number; memberId: string; item: Income };

type Kind = "all" | "expense" | "income";

function ExpenseList({ household, me }: { household: Household; me: Member }) {
  const expenses = useHouseholdExpenses(household.id);
  const incomes = useHouseholdIncomes(household.id);
  const liveMembers = useHouseholdMembers(household.id);
  const members = useMemo(() => liveMembers ?? [], [liveMembers]);
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  // "/app/expenses?member=<id>" opens the list filtered to that member.
  const [memberId, setMemberId] = useState<string>(
    () => new URLSearchParams(window.location.search).get("member") ?? "all",
  );
  const [editing, setEditing] = useState<Entry | null>(null);
  const [adding, setAdding] = useState<"expense" | "income" | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const today = localToday();
  const money = (minor: number) => formatMoney(minor, household.currency);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [
      ...(expenses ?? []).map((e) => ({ kind: "expense" as const, id: e.id, date: e.spentOn, createdAt: e.createdAt, amountMinor: e.amountMinor, memberId: e.memberId, item: e })),
      ...(incomes ?? []).map((i) => ({ kind: "income" as const, id: i.id, date: i.receivedOn, createdAt: i.createdAt, amountMinor: i.amountMinor, memberId: i.memberId, item: i })),
    ];
    return out.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [expenses, incomes]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (kind === "all" || e.kind === kind) &&
          (category === "all" || (e.kind === "expense" && e.item.category === category)) &&
          (memberId === "all" || e.memberId === memberId),
      ),
    [entries, kind, category, memberId],
  );

  const days = useMemo(() => {
    const groups: { date: string; items: Entry[]; net: number }[] = [];
    for (const e of filtered) {
      const signed = e.kind === "income" ? e.amountMinor : -e.amountMinor;
      const last = groups.at(-1);
      if (last && last.date === e.date) {
        last.items.push(e);
        last.net += signed;
      } else {
        groups.push({ date: e.date, items: [e], net: signed });
      }
    }
    return groups;
  }, [filtered]);

  // This calendar month at a glance.
  const monthStart = `${today.slice(0, 8)}01`;
  const month = entries.filter((e) => e.date >= monthStart && (memberId === "all" || e.memberId === memberId));
  const monthIn = month.filter((e) => e.kind === "income").reduce((sum, e) => sum + e.amountMinor, 0);
  const monthOut = month.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amountMinor, 0);
  const monthName = new Date(`${monthStart}T12:00:00`).toLocaleDateString("en-GB", { month: "long" });

  async function onDeleteExpense(expense: Expense) {
    setEditing(null);
    await removeExpense(expense.id);
    setToast({ text: `Deleted ${money(expense.amountMinor)}`, undo: () => void restoreExpense(expense) });
  }

  async function onDeleteIncome(income: Income) {
    setEditing(null);
    await removeIncome(income.id);
    setToast({ text: `Deleted +${money(income.amountMinor)}`, undo: () => void restoreIncome(income) });
  }

  if (editing?.kind === "expense") {
    return (
      <ExpenseForm
        household={household}
        me={me}
        members={members}
        expense={editing.item}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setToast({ text: "Changes saved" });
        }}
        onDelete={onDeleteExpense}
      />
    );
  }
  if (editing?.kind === "income") {
    return (
      <IncomeForm
        household={household}
        me={me}
        members={members}
        income={editing.item}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setToast({ text: "Changes saved" });
        }}
        onDelete={onDeleteIncome}
      />
    );
  }
  if (adding === "expense") {
    return (
      <ExpenseForm
        household={household}
        me={me}
        members={members}
        onClose={() => setAdding(null)}
        onSaved={(e) => {
          setAdding(null);
          setToast({ text: `Saved ${money(e.amountMinor)}` });
        }}
        onSwitchToIncome={() => setAdding("income")}
      />
    );
  }
  if (adding === "income") {
    return (
      <IncomeForm
        household={household}
        me={me}
        members={members}
        onClose={() => setAdding(null)}
        onSaved={(i) => {
          setAdding(null);
          setToast({ text: `Added +${money(i.amountMinor)}` });
        }}
        onSwitchToExpense={() => setAdding("expense")}
      />
    );
  }

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
      active ? "border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border-black/10 bg-white/60 hover:bg-white dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-white/10"
    }`;

  const loading = expenses === undefined || incomes === undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-24 lg:max-w-4xl lg:px-10 lg:pt-10">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight lg:text-3xl">Transactions</h1>
        <button
          type="button"
          onClick={() => setAdding("income")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
        >
          <Plus size={16} aria-hidden /> Income
        </button>
        <button
          type="button"
          onClick={() => setAdding("expense")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
        >
          <Plus size={16} aria-hidden /> Expense
        </button>
      </header>

      <p className="mt-5 text-xs font-semibold tracking-wide uppercase opacity-50">{monthName}, extra income and spending</p>
      <section aria-label={`${monthName} at a glance`} className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium opacity-60">
            <ArrowDownLeft size={14} className="text-emerald-500" aria-hidden /> Money in
          </p>
          <p className="mt-1 text-[0.95rem] font-bold whitespace-nowrap sm:text-lg text-emerald-600 tabular-nums lg:text-2xl dark:text-emerald-400">+{money(monthIn)}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium opacity-60">
            <ArrowUpRight size={14} className="text-rose-500" aria-hidden /> Money out
          </p>
          <p className="mt-1 text-[0.95rem] font-bold whitespace-nowrap sm:text-lg tabular-nums lg:text-2xl">−{money(monthOut)}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs font-medium opacity-60">Balance</p>
          <p className={`mt-1 text-[0.95rem] font-bold whitespace-nowrap sm:text-lg tabular-nums lg:text-2xl ${monthIn - monthOut >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {monthIn - monthOut >= 0 ? "+" : "−"}
            {money(Math.abs(monthIn - monthOut))}
          </p>
        </div>
      </section>

      <div className="mt-5 flex gap-2" role="group" aria-label="Show">
        {(
          [
            ["all", "All"],
            ["expense", "Money out"],
            ["income", "Money in"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={chip(kind === value)}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              if (value === "income") setCategory("all");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {kind !== "income" ? (
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by category">
          {CATEGORY_LIST.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              type="button"
              className={chip(category === id)}
              aria-pressed={category === id}
              onClick={() => setCategory(category === id ? "all" : id)}
            >
              <Icon size={16} aria-hidden style={category === id ? undefined : { color }} /> {label}
            </button>
          ))}
        </div>
      ) : null}

      {members.length > 1 ? (
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by member">
          <button type="button" className={chip(memberId === "all")} aria-pressed={memberId === "all"} onClick={() => setMemberId("all")}>
            Everyone
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={chip(memberId === m.id)}
              aria-pressed={memberId === m.id}
              onClick={() => setMemberId(memberId === m.id ? "all" : m.id)}
            >
              <span className="size-3 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
              {m.name.split(" ")[0]}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <ListSkeleton rows={6} />
        </div>
      ) : filtered.length === 0 ? (
        entries.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={26} />}
            title="Nothing here yet"
            action={
              <Link
                href="/app/scan"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-strong"
              >
                <Camera size={18} aria-hidden /> Scan a receipt
              </Link>
            }
          >
            Scan a receipt, add an expense or record money you received. Everything shows up here, day by day.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<SearchX size={26} />}
            title="Nothing matches these filters"
            action={
              <button
                type="button"
                onClick={() => {
                  setKind("all");
                  setCategory("all");
                  setMemberId("all");
                }}
                className="inline-flex h-11 items-center rounded-xl border border-black/15 px-5 font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Show everything
              </button>
            }
          >
            Try another filter.
          </EmptyState>
        )
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {days.map((day) => (
            <section key={day.date} aria-label={dayLabel(day.date, today)} className="card overflow-hidden">
              <div className="flex items-baseline justify-between border-b border-black/5 px-5 py-3 dark:border-white/10">
                <h2 className="text-sm font-semibold">{dayLabel(day.date, today)}</h2>
                <span className={`text-sm font-medium tabular-nums ${day.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "opacity-60"}`}>
                  {day.net >= 0 ? "+" : "−"}
                  {money(Math.abs(day.net))}
                </span>
              </div>
              <ul className="flex flex-col px-2 py-1">
                {day.items.map((entry) => {
                  const member = memberById.get(entry.memberId);
                  if (entry.kind === "income") {
                    const src = getIncomeSource(entry.item.source);
                    const Icon = src.icon;
                    return (
                      <li key={`i-${entry.id}`}>
                        <button
                          type="button"
                          onClick={() => setEditing(entry)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/5"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${src.color}1f`, color: src.color }} aria-hidden>
                            <Icon size={20} strokeWidth={2.25} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{entry.item.note || src.label}</span>
                            <span className="block truncate text-sm opacity-60">
                              {[entry.item.note ? src.label : "Income", members.length > 1 && member ? member.name.split(" ")[0] : null].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">+{money(entry.amountMinor)}</span>
                        </button>
                      </li>
                    );
                  }
                  const e = entry.item;
                  const title = e.note || e.merchant || getCategory(e.category).label;
                  return (
                    <li key={`e-${entry.id}`}>
                      <button
                        type="button"
                        onClick={() => setEditing(entry)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/5"
                      >
                        <span aria-hidden>
                          <CategoryBadge category={e.category} showLabel={false} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{title}</span>
                          <span className="block truncate text-sm opacity-60">
                            {[
                              getCategory(e.category).label,
                              members.length > 1 && member ? member.name.split(" ")[0] : null,
                              e.source === "receipt" ? "Receipt" : e.source === "voice" ? "Voice" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">−{money(e.amountMinor)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {toast ? (
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md px-4 lg:bottom-8 lg:left-64">
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
          >
            <span>{toast.text}</span>
            {toast.undo ? (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="font-semibold text-accent"
              >
                Undo
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
