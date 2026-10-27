/**
 * Money is stored as an integer in the currency's smallest unit, with no
 * rounding: 49.97 EUR -> 4997 cents, 49.970 KWD -> 49970 fils, 50 JPY -> 50.
 * Floats are never used for amounts.
 */

/** Every ISO 4217 currency the runtime knows (about 160). */
export const CURRENCIES: readonly string[] = Intl.supportedValuesOf("currency");

const CURRENCY_SET = new Set(CURRENCIES);

export type Currency = string;

const DEFAULT_LOCALE = "en-GB";

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCY_SET.has(value);
}

/** Number of decimals the currency uses: 2 for EUR, 0 for JPY, 3 for KWD. */
export function currencyDecimals(currency: Currency): number {
  return new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Converts an amount to the smallest unit, exactly:
 * toMinor("49.97", "EUR") -> 4997, toMinor("49,97", "EUR") -> 4997,
 * toMinor("1 234.5", "EUR") -> 123450.
 * Throws if the amount has more decimals than the currency allows.
 */
export function toMinor(value: number | string, currency: Currency): number {
  const decimals = currencyDecimals(currency);
  const raw = (typeof value === "number" ? value.toFixed(decimals) : value)
    .trim()
    .replace(/[\s ']/g, "")
    .replace(",", ".");

  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(raw);
  if (!match) {
    throw new Error(`Invalid amount: ${value}`);
  }
  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > decimals) {
    throw new Error(`${currency} allows at most ${decimals} decimals: ${value}`);
  }

  const minor = Number(whole + fraction.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Amount too large: ${value}`);
  }
  return sign === "-" ? -minor : minor;
}

/** Converts the smallest unit back to a plain number: 4997 EUR -> 49.97. */
export function fromMinor(minor: number, currency: Currency): number {
  return minor / 10 ** currencyDecimals(currency);
}

/** Formats for display: 4997 EUR -> "€49.97", 4997 HUF -> "Ft 49.97". */
export function formatMoney(
  minor: number,
  currency: Currency,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(fromMinor(minor, currency));
}
