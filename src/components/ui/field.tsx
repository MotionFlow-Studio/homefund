import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Field({ label, error, id, ...input }: Props) {
  const inputId = id ?? input.name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="h-12 rounded-2xl border border-black/10 bg-white/90 shadow-sm shadow-black/[0.03] px-4 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
        {...input}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}
