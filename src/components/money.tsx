import { formatMoney, formatMoneyParts } from "@/lib/money";

/** An amount with the currency symbol set smaller than the number. */
export function Money({ minor, currency, className = "" }: { minor: number; currency: string; className?: string }) {
  const parts = formatMoneyParts(minor, currency);
  return (
    <span className={`tabular-nums ${className}`} aria-label={formatMoney(minor, currency)}>
      {parts.map((part, i) =>
        part.type === "symbol" ? (
          <span
            key={i}
            aria-hidden
            className={`text-[0.55em] font-medium align-[0.35em] opacity-80 ${i === 0 ? "mr-[0.3em]" : "ml-[0.3em]"}`}
          >
            {part.value}
          </span>
        ) : (
          <span key={i} aria-hidden>
            {part.value.trim()}
          </span>
        ),
      )}
    </span>
  );
}
