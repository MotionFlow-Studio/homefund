"use client";

import { ArrowLeft, Camera, ReceiptText, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { addDays, localToday } from "@/lib/budget";
import { CATEGORY_LIST, getCategory, type CategoryId } from "@/lib/categories";
import { useCurrentUser } from "@/lib/auth-client";
import { removeExpense, restoreExpense, useHouseholdExpenses, useHouseholdMembers } from "@/lib/expenses";
import { useMyHousehold } from "@/lib/household";
import { formatMoney } from "@/lib/money";
import type { Expense, Household, Member } from "@/lib/model";
import { ExpenseForm } from "../expense-form";
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

function ExpenseList({ household, me }: { household: Household; me: Member }) {
  const expenses = useHouseholdExpenses(household.id);
  const liveMembers = useHouseholdMembers(household.id);
  const members = useMemo(() => liveMembers ?? [], [liveMembers]);
  const [category, setCategory] = useState<CategoryId | "all">("all");
  // "/app/expenses?member=<id>" opens the list filtered to that member.
  const [memberId, setMemberId] = useState<string>(
    () => new URLSearchParams(window.location.search).get("member") ?? "all",
  );
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const today = localToday();
  const money = (minor: number) => formatMoney(minor, household.currency);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(
    () =>
      (expenses ?? []).filter(
        (e) => (category === "all" || e.category === category) && (memberId === "all" || e.memberId === memberId),
      ),
    [expenses, category, memberId],
  );

  const days = useMemo(() => {
    const groups: { date: string; items: Expense[]; total: number }[] = [];
    for (const e of filtered) {
      const last = groups.at(-1);
      if (last && last.date === e.spentOn) {
        last.items.push(e);
        last.total += e.amountMinor;
      } else {
        groups.push({ date: e.spentOn, items: [e], total: e.amountMinor });
      }
    }
    return groups;
  }, [filtered]);

  const filteredTotal = filtered.reduce((sum, e) => sum + e.amountMinor, 0);

  async function onDelete(expense: Expense) {
    setEditing(null);
    await removeExpense(expense.id);
    setToast({ text: `Deleted ${money(expense.amountMinor)}`, undo: () => void restoreExpense(expense) });
  }

  if (editing) {
    return (
      <ExpenseForm
        household={household}
        me={me}
        members={members}
        expense={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setToast({ text: "Changes saved" });
        }}
        onDelete={onDelete}
      />
    );
  }

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
      active ? "border-brand bg-brand text-white" : "border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
    }`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] lg:max-w-4xl lg:px-10 lg:pt-10">
      <header className="flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back to home"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 hidden dark:hover:bg-white/10"
        >
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-2xl font-bold tracking-tight lg:text-3xl">Expenses</h1>
      </header>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by category">
        <button type="button" className={chip(category === "all")} aria-pressed={category === "all"} onClick={() => setCategory("all")}>
          All
        </button>
        {CATEGORY_LIST.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={chip(category === id)}
            aria-pressed={category === id}
            onClick={() => setCategory(category === id ? "all" : id)}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>

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
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
              {m.name.split(" ")[0]}
            </button>
          ))}
        </div>
      ) : null}

      {expenses === undefined ? (
        <div className="mt-6">
          <ListSkeleton rows={6} />
        </div>
      ) : filtered.length === 0 ? (
        expenses.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={26} />}
            title="No expenses yet"
            action={
              <Link
                href="/app/scan"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-strong"
              >
                <Camera size={18} aria-hidden /> Scan a receipt
              </Link>
            }
          >
            Scan a receipt or add an expense on the home screen. Everything the family spends shows up here, day by day.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<SearchX size={26} />}
            title="Nothing matches these filters"
            action={
              <button
                type="button"
                onClick={() => {
                  setCategory("all");
                  setMemberId("all");
                }}
                className="inline-flex h-11 items-center rounded-xl border border-black/15 px-5 font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Show all expenses
              </button>
            }
          >
            No expenses in this category{memberId !== "all" ? " for this person" : ""} yet.
          </EmptyState>
        )
      ) : (
        <>
          <p className="mt-4 text-sm opacity-70">
            {filtered.length} {filtered.length === 1 ? "expense" : "expenses"} · {money(filteredTotal)}
          </p>
          <div className="mt-2 flex flex-col gap-5">
            {days.map((day) => (
              <section key={day.date} aria-label={dayLabel(day.date, today)}>
                <div className="sticky top-0 z-10 -mx-4 flex items-baseline justify-between bg-background/95 px-4 py-2 backdrop-blur">
                  <h2 className="text-sm font-semibold">{dayLabel(day.date, today)}</h2>
                  <span className="text-sm tabular-nums opacity-70">{money(day.total)}</span>
                </div>
                <ul className="flex flex-col">
                  {day.items.map((e) => {
                    const member = memberById.get(e.memberId);
                    const title = e.note || e.merchant || getCategory(e.category).label;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setEditing(e)}
                          className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <span aria-hidden>
                            <CategoryBadge category={e.category} showLabel={false} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{title}</span>
                            <span className="block truncate text-sm opacity-60">
                              {[
                                title !== getCategory(e.category).label ? getCategory(e.category).label : null,
                                members.length > 1 && member ? member.name.split(" ")[0] : null,
                                e.source === "receipt" ? "Receipt" : e.source === "voice" ? "Voice" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "\u00a0"}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">{money(e.amountMinor)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
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
