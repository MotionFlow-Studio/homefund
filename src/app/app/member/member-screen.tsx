"use client";

import { ArrowLeft, ChartPie, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { useCurrentUser } from "@/lib/auth-client";
import { addDays, localToday } from "@/lib/budget";
import { getCategory } from "@/lib/categories";
import { useMyHousehold } from "@/lib/household";
import { formatMoney } from "@/lib/money";
import type { Household, Member } from "@/lib/model";
import { useMemberDetail } from "@/lib/use-budget";
import { MemberBudgetCard, paydayLabel } from "../member-budget-card";
import { EmptyState, LoadingScreen } from "@/components/loading";

const ROLE_LABEL: Record<Member["role"], string> = { owner: "Set up the household", adult: "Adult", child: "Child" };

export function MemberScreen() {
  const router = useRouter();
  const memberId = useSearchParams().get("id") ?? "";
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
    else if (auth.status === "signed_in" && household.status === "none") router.replace("/app");
  }, [auth.status, household.status, router]);

  if (auth.status !== "signed_in" || household.status !== "ready") {
    return <LoadingScreen />;
  }
  return <MemberDetails household={household.household} me={household.me} memberId={memberId} />;
}

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function MemberDetails({ household, me, memberId }: { household: Household; me: Member; memberId: string }) {
  const detail = useMemberDetail(household.id, me.id, memberId);
  const money = (minor: number) => formatMoney(minor, household.currency);
  const today = localToday();

  const back = (
    <Link
      href="/app"
      aria-label="Back"
      className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
    >
      <ArrowLeft size={22} />
    </Link>
  );

  // While switching between members the previous answer may still be in hand.
  if (detail === undefined || (detail && detail.entry.member.id !== memberId)) {
    return <LoadingScreen />;
  }
  if (detail === null) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-2">{back}</header>
        <p className="opacity-70">This person is not in your household.</p>
      </main>
    );
  }

  const { entry, byCategory, recent, expenseCount } = detail;
  const { member, budget } = entry;
  const isMe = member.id === me.id;
  const periodTotal = byCategory.reduce((sum, c) => sum + c.amountMinor, 0);
  const largest = byCategory[0]?.amountMinor ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center gap-3">
        {back}
        <span className="size-10 shrink-0 rounded-full" style={{ backgroundColor: member.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">
            {member.name}
            {isMe ? <span className="font-normal opacity-60"> (you)</span> : null}
          </h1>
          <p className="text-sm opacity-60">{ROLE_LABEL[member.role]}</p>
        </div>
      </header>

      <section aria-label="Budget">
        <MemberBudgetCard as="div" showName={false} entry={entry} isMe={isMe} money={money} today={today} />
        {!budget && isMe ? (
          <p className="mt-2 text-sm opacity-70">
            Set your payday in{" "}
            <Link href="/app/settings" className="font-semibold text-brand">
              Settings
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section aria-labelledby="spending-title" className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="spending-title" className="font-semibold">
            {budget ? `Since payday, ${paydayLabel(budget.start)}` : "This month"}
          </h2>
          <span className="text-sm tabular-nums opacity-70">{money(periodTotal)}</span>
        </div>
        {byCategory.length === 0 ? (
          <EmptyState compact icon={<ChartPie size={20} />}>
            {isMe ? "Nothing spent yet in this period." : `${member.name.split(" ")[0]} has not spent anything yet in this period.`}
          </EmptyState>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {byCategory.map(({ category, amountMinor }) => {
              const { label, color } = getCategory(category);
              return (
                <li key={category} className="flex items-center gap-3">
                  <span aria-hidden>
                    <CategoryBadge category={category} showLabel={false} size="sm" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{label}</span>
                      <span className="tabular-nums">{money(amountMinor)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${largest ? (amountMinor / largest) * 100 : 0}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-title" className="rounded-3xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between">
          <h2 id="recent-title" className="font-semibold">
            Latest expenses
          </h2>
          {expenseCount > 0 ? (
            <Link href={`/app/expenses?member=${member.id}`} className="text-sm font-semibold text-brand">
              See all {expenseCount}
            </Link>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <EmptyState compact icon={<Receipt size={20} />}>
            No expenses recorded yet.
          </EmptyState>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-1.5">
                <span aria-hidden={!e.note && !e.merchant}>
                  <CategoryBadge category={e.category} showLabel={false} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.note || e.merchant || getCategory(e.category).label}</span>
                  <span className="block text-xs opacity-60">
                    {dayLabel(e.spentOn, today)}
                    {e.source === "receipt" ? " · Receipt" : ""}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{money(e.amountMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
