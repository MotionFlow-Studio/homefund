"use client";

import { currencyDecimals } from "@/lib/money";

type Props = {
  label: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  name?: string;
  placeholder?: string;
  hint?: string;
};

/** Text field for amounts; accepts "49.97" or "49,97" and keeps every decimal. */
export function MoneyInput({ label, currency, value, onChange, error, name, placeholder, hint }: Props) {
  const decimals = currencyDecimals(currency);
  const id = name ?? label.toLowerCase().replace(/\W+/g, "-");
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="relative flex items-center">
        <input
          id={id}
          name={name}
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          placeholder={placeholder ?? (decimals > 0 ? `0.${"0".repeat(decimals)}` : "0")}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ""))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="h-12 w-full rounded-xl border border-black/15 bg-white pl-4 pr-16 text-base tabular-nums outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
        />
        <span className="pointer-events-none absolute right-4 font-mono text-sm opacity-60">{currency}</span>
      </span>
      {hint && !error ? (
        <span id={`${id}-hint`} className="text-sm opacity-70">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}
