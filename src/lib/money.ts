/**
 * Money is always stored as an integer in the currency's minor unit
 * (cent, ban, filler): 12.50 EUR -> 1250. Never use floats for amounts.
 */

export const CURRENCIES = ["EUR", "RON", "HUF"] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Number of minor units per major unit. ISO 4217 defines 2 decimals for all three. */
const MINOR_PER_MAJOR = 100;

/** Decimals shown to people. HUF is shown without decimals in everyday use. */
const DISPLAY_DECIMALS: Record<Currency, number> = {
  EUR: 2,
  RON: 2,
  HUF: 0,
};

const LOCALE: Record<Currency, string> = {
  EUR: "en-IE",
  RON: "ro-RO",
  HUF: "hu-HU",
};

export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" &&
    (CURRENCIES as readonly string[]).includes(value)
  );
}

/** Converts a major-unit number (12.5) or string ("12,50") to minor units (1250). */
export function toMinor(value: number | string): number {
  const normalized =
    typeof value === "number"
      ? value
      : Number(value.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(normalized)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  return Math.round(normalized * MINOR_PER_MAJOR);
}

/** Converts minor units (1250) to a major-unit number (12.5). */
export function fromMinor(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

/** Formats minor units for display, e.g. 1250 EUR -> "€12.50", 450000 HUF -> "4 500 Ft". */
export function formatMoney(minor: number, currency: Currency): string {
  const decimals = DISPLAY_DECIMALS[currency];
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fromMinor(minor));
}
