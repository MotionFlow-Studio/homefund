"use client";

import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Money } from "@/components/money";
import { ReceiptCheckNotice } from "@/components/receipt-check-notice";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { addDays, localToday } from "@/lib/budget";
import { CATEGORY_LIST, getCategory, type CategoryId } from "@/lib/categories";
import { useHouseholdMembers } from "@/lib/expenses";
import { newId, saveExpenseWithItems } from "@/lib/local/store";
import { amountPlaceholder, currencyDecimals, formatAmountInput, formatMoney, moneyLocale, toMinor } from "@/lib/money";
import type { Expense, Household, Member } from "@/lib/model";
import type { ReceiptScan } from "@/lib/receipt";
import { checkReceipt } from "@/lib/receipt-check";
import { categorySplit, mainCategory, scaleToTotal } from "@/lib/receipt-review";

type Line = {
  key: string;
  name: string;
  amount: string;
  category: CategoryId;
  quantityMilli: number;
  unitPrice: string | null;
  discountMinor: number;
};

function parseAmount(value: string, currency: string): number | null {
  try {
    const minor = toMinor(value || "x", currency);
    return minor >= 0 ? minor : null;
  } catch {
    return null;
  }
}

/**
 * Lets the user check a read receipt before it is saved: fix names, amounts
 * and categories, remove or add lines, pick the date and who paid. The
 * warnings update while lines are corrected. Saved as one expense with its
 * lines, filed under the category with the most money.
 */
export function ReceiptReview({
  receipt,
  household,
  me,
  onSaved,
  onDiscard,
}: {
  receipt: ReceiptScan;
  household: Household;
  me: Member;
  onSaved: (expense: Expense) => void;
  onDiscard: () => void;
}) {
  const currency = receipt.currency;
  const decimals = currencyDecimals(currency);
  const foreign = currency !== household.currency;
  const today = localToday();
  const members = useHouseholdMembers(household.id) ?? [];

  const [merchant, setMerchant] = useState(receipt.merchant ?? "");
  const [spentOn, setSpentOn] = useState(receipt.spentOn && receipt.spentOn <= today ? receipt.spentOn : today);
  const [dateChosen, setDateChosen] = useState(false);
  const [memberId, setMemberId] = useState(me.id);
  const [paid, setPaid] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<Line[]>(() =>
    receipt.items.map((item) => ({
      key: newId(),
      name: item.name,
      amount: formatAmountInput(item.lineTotalMinor, currency),
      category: item.category,
      quantityMilli: item.quantityMilli,
      unitPrice: item.unitPrice,
      discountMinor: item.discountMinor,
    })),
  );

  const amounts = lines.map((line) => parseAmount(line.amount, currency));
  const linesTotal = amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const check = checkReceipt(
    {
      currency,
      currencyDetected: receipt.currencyDetected,
      spentOn: receipt.spentOn || dateChosen ? spentOn : null,
      totalMinor: receipt.totalMinor,
      items: lines.map((line, index) => ({
        quantityMilli: line.quantityMilli,
        unitPrice: line.unitPrice,
        lineTotalMinor: amounts[index] ?? 0,
        discountMinor: line.discountMinor,
      })),
    },
    household.currency,
  );
  const money = (minor: number) => formatMoney(minor, currency);
  const number = new Intl.NumberFormat(moneyLocale(currency), { maximumFractionDigits: 6 });
  const split = categorySplit(lines.map((line, index) => ({ category: line.category, amountMinor: amounts[index] ?? 0 })));

  function update(key: string, changes: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
    setError(null);
  }

  function addLine() {
    const key = newId();
    setLines((current) => [
      ...current,
      {
        key,
        name: "",
        amount: "",
        category: current.at(-1)?.category ?? "other",
        quantityMilli: 1000,
        unitPrice: null,
        discountMinor: 0,
      },
    ]);
    requestAnimationFrame(() => document.getElementById(`line-${key}-name`)?.focus());
  }

  function chooseDate(value: string) {
    setSpentOn(value);
    setDateChosen(true);
  }

  async function save() {
    if (lines.length === 0) return setError("Add at least one item");
    const badLine = amounts.findIndex((amount) => amount === null);
    if (badLine >= 0) {
      document.getElementById(`line-${lines[badLine].key}-amount`)?.focus();
      return setError(`Item ${badLine + 1}: enter an amount`);
    }
    if (linesTotal <= 0) return setError("The items must add up to more than zero");

    const lineMinors = amounts as number[];
    let householdAmounts = lineMinors;
    if (foreign) {
      const paidMinor = parseAmount(paid, household.currency);
      if (!paidMinor) return setError(`Enter what you paid in ${household.currency}`);
      householdAmounts = scaleToTotal(lineMinors, paidMinor);
    }

    setError(null);
    setSaving(true);
    const expenseId = newId();
    const saved = await saveExpenseWithItems(
      {
        id: expenseId,
        householdId: household.id,
        memberId,
        amountMinor: householdAmounts.reduce((a, b) => a + b, 0),
        category: mainCategory(lines.map((line, index) => ({ category: line.category, amountMinor: householdAmounts[index] }))),
        spentOn,
        merchant: merchant.trim().slice(0, 120) || null,
        note: foreign ? `Receipt total ${money(linesTotal)}` : null,
        source: "receipt",
        createdByUserId: me.userId,
      },
      lines.map((line, index) => ({
        id: newId(),
        expenseId,
        position: index,
        name: line.name.trim().slice(0, 120) || "Item",
        quantityMilli: line.quantityMilli,
        unitPrice: line.unitPrice,
        lineTotalMinor: householdAmounts[index],
        category: line.category,
      })),
    );
    onSaved(saved);
  }

  const dateChip = (value: string, label: string) => (
    <button
      type="button"
      onClick={() => chooseDate(value)}
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-32">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Discard this receipt?")) onDiscard();
          }}
          aria-label="Discard receipt"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Check receipt</h1>
      </header>

      <section
        aria-label="Receipt summary"
        className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
      >
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Shop name"
          aria-label="Shop name"
          maxLength={120}
          className="w-full truncate rounded-md bg-transparent text-sm font-semibold tracking-wide opacity-70 outline-none focus:opacity-100"
        />
        <p className="mt-1 text-4xl font-bold tracking-tight">
          <Money minor={linesTotal} currency={currency} />
        </p>
        {receipt.totalMinor !== null ? (
          <p
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              check.totalsMatch ? "bg-brand/10 text-brand" : "bg-black/5 dark:bg-white/10"
            }`}
          >
            {check.totalsMatch ? <Check size={14} aria-hidden /> : null}
            Receipt total {money(receipt.totalMinor)}
            {check.totalsMatch ? " · matches" : ""}
          </p>
        ) : null}
        {receipt.savedMinor > 0 ? (
          <p className="mt-2 text-sm font-medium text-brand">Discounts {money(receipt.savedMinor)} already taken off</p>
        ) : null}

        {split.length > 0 && linesTotal > 0 ? (
          <div className="mt-5">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {split.map(({ category, amountMinor }) => (
                <div
                  key={category}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(amountMinor / linesTotal) * 100}%`, backgroundColor: getCategory(category).color }}
                />
              ))}
            </div>
            <ul aria-label="By category" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {split.map(({ category, amountMinor }) => (
                <li key={category} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: getCategory(category).color }} aria-hidden />
                  <span className="opacity-80">{getCategory(category).label}</span>
                  <span className="font-semibold tabular-nums">{money(amountMinor)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <ReceiptCheckNotice check={check} currency={currency} />

      {foreign ? (
        <MoneyInput
          label={`What you paid in ${household.currency}`}
          currency={household.currency}
          value={paid}
          onChange={(value) => {
            setPaid(value);
            setError(null);
          }}
          name="paid"
          hint="Check your bank app. The items are shared out in proportion."
        />
      ) : null}

      <section aria-label="Items">
        <h2 className="mb-2 text-sm font-medium">
          Items <span className="opacity-60">· tap an icon to change its category</span>
        </h2>
        <ul className="divide-y divide-black/5 rounded-3xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {lines.map((line, index) => {
            const category = getCategory(line.category);
            const invalid = amounts[index] === null && line.amount !== "";
            return (
              <li key={line.key}>
                <div className="flex items-center gap-2 py-2 pr-1 pl-3">
                  <button
                    type="button"
                    onClick={() => setPicking(picking === line.key ? null : line.key)}
                    aria-expanded={picking === line.key}
                    aria-label={`Item ${index + 1} category: ${category.label}. Change`}
                    className="shrink-0 rounded-full"
                  >
                    <CategoryBadge category={line.category} showLabel={false} size="sm" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <input
                      id={`line-${line.key}-name`}
                      value={line.name}
                      onChange={(e) => update(line.key, { name: e.target.value })}
                      placeholder="Item name"
                      aria-label={`Item ${index + 1} name`}
                      maxLength={120}
                      className="w-full truncate rounded-md bg-transparent py-1 font-medium outline-none focus:bg-black/5 dark:focus:bg-white/10"
                    />
                    {line.quantityMilli !== 1000 && line.unitPrice ? (
                      <p className="text-xs opacity-60">
                        {number.format(line.quantityMilli / 1000)} × {number.format(Number(line.unitPrice))}
                      </p>
                    ) : null}
                  </div>
                  <input
                    id={`line-${line.key}-amount`}
                    value={line.amount}
                    onChange={(e) => update(line.key, { amount: e.target.value.replace(/[^\d.,]/g, "") })}
                    inputMode={decimals > 0 ? "decimal" : "numeric"}
                    autoComplete="off"
                    placeholder={amountPlaceholder(currency)}
                    aria-label={`Item ${index + 1} amount in ${currency}`}
                    aria-invalid={invalid || undefined}
                    className={`w-24 rounded-lg bg-transparent px-2 py-1 text-right font-semibold tabular-nums outline-none focus:bg-black/5 dark:focus:bg-white/10 ${
                      invalid ? "text-red-600 dark:text-red-400" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLines((current) => current.filter((l) => l.key !== line.key));
                      setPicking(null);
                    }}
                    aria-label={`Remove item ${index + 1}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full opacity-50 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    <X size={16} />
                  </button>
                </div>
                {picking === line.key ? (
                  <div className="grid grid-cols-5 gap-1 px-2 pb-3" role="group" aria-label={`Category for item ${index + 1}`}>
                    {CATEGORY_LIST.map(({ id, label, icon: Icon, color }) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={line.category === id}
                        onClick={() => {
                          update(line.key, { category: id });
                          setPicking(null);
                        }}
                        className="flex flex-col items-center gap-1 rounded-xl p-1.5 text-[0.65rem] leading-tight font-medium"
                        style={line.category === id ? { backgroundColor: `${color}26` } : undefined}
                      >
                        <span
                          className="flex size-9 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${color}1f`, color }}
                        >
                          <Icon size={18} strokeWidth={2.25} aria-hidden />
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={addLine}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-brand"
            >
              <Plus size={18} aria-hidden /> Add item
            </button>
          </li>
        </ul>
      </section>

      <fieldset>
        <legend className="mb-3 text-sm font-medium">Date</legend>
        <div className="flex flex-wrap items-center gap-2">
          {dateChip(today, "Today")}
          {dateChip(addDays(today, -1), "Yesterday")}
          <input
            type="date"
            value={spentOn}
            max={today}
            onChange={(e) => e.target.value && chooseDate(e.target.value)}
            aria-label="Purchase date"
            className="h-10 rounded-full border border-black/15 bg-transparent px-3 text-sm dark:border-white/15"
          />
        </div>
      </fieldset>

      {members.length > 1 ? (
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Who paid</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberId(m.id)}
                aria-pressed={memberId === m.id}
                className={`flex h-10 items-center gap-2 rounded-full border pr-4 pl-1 text-sm font-medium transition ${
                  memberId === m.id ? "border-brand bg-brand/10" : "border-black/15 dark:border-white/15"
                }`}
              >
                <span className="size-8 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
                {m.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-background/95 backdrop-blur dark:border-white/10">
        <div className="mx-auto flex max-w-md flex-col gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error ? (
            <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Button onClick={save} loading={saving}>
            {linesTotal > 0 && !foreign ? `Save ${money(linesTotal)}` : "Save expense"}
          </Button>
        </div>
      </div>
    </main>
  );
}
