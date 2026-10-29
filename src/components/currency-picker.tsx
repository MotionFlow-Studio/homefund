"use client";

import { useMemo, useState } from "react";
import { currencyOptions, SUGGESTED_CURRENCIES } from "@/lib/currency-options";

/** Searchable list of every currency, the common ones first. */
export function CurrencyPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (currency: string) => void;
  error?: string;
}) {
  const options = useMemo(() => currencyOptions(), []);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.filter((o) => SUGGESTED_CURRENCIES.includes(o.code) || o.code === value);
    return options.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)).slice(0, 30);
  }, [options, query, value]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">Currency</legend>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search all currencies"
        aria-label="Search currencies"
        className="h-11 rounded-2xl border border-black/10 bg-white/90 shadow-sm shadow-black/[0.03] px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
      />
      <div role="radiogroup" aria-label="Currency" className="-m-1 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto p-1">
        {visible.map((option) => {
          const selected = option.code === value;
          return (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.code)}
              className={`flex h-12 shrink-0 items-center justify-between rounded-2xl border px-4 text-left transition ${
                selected
                  ? "border-teal-500 bg-gradient-to-r from-teal-500/12 to-cyan-500/10 font-semibold ring-4 ring-teal-500/10"
                  : "border-black/10 bg-white/60 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
              }`}
            >
              <span>{option.name}</span>
              <span className="font-mono text-sm opacity-70">{option.code}</span>
            </button>
          );
        })}
        {visible.length === 0 ? <p className="py-3 text-sm opacity-70">No currency found.</p> : null}
      </div>
      {error ? <span className="text-sm text-red-600 dark:text-red-400">{error}</span> : null}
    </fieldset>
  );
}
