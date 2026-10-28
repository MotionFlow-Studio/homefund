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

/*
 * Minor-unit exponents from the ISO 4217 list. Fixed here rather than read
 * from the runtime, because browsers and Node disagree for some currencies
 * (HUF, for example), and every device must store the same amount the same way.
 */
const ZERO_DECIMALS = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG",
  "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF",
]);
const THREE_DECIMALS = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
const FOUR_DECIMALS = new Set(["CLF", "UYW"]);

/** Number of decimals the currency uses (ISO 4217): 2 for EUR and HUF, 0 for JPY, 3 for KWD. */
export function currencyDecimals(currency: Currency): number {
  if (ZERO_DECIMALS.has(currency)) return 0;
  if (THREE_DECIMALS.has(currency)) return 3;
  if (FOUR_DECIMALS.has(currency)) return 4;
  return 2;
}

function formatter(currency: Currency, locale: string) {
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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

/** Formats for display: 4997 EUR -> "€49.97", 4997 HUF -> "Ft49.97". */
export function formatMoney(
  minor: number,
  currency: Currency,
  locale: string = DEFAULT_LOCALE,
): string {
  return formatter(currency, locale).format(fromMinor(minor, currency));
}

/** Formatted amount split into parts, so the symbol can be styled apart from the number. */
export function formatMoneyParts(
  minor: number,
  currency: Currency,
  locale: string = DEFAULT_LOCALE,
): { type: "symbol" | "number"; value: string }[] {
  const parts = formatter(currency, locale).formatToParts(fromMinor(minor, currency));

  const out: { type: "symbol" | "number"; value: string }[] = [];
  for (const part of parts) {
    const type = part.type === "currency" ? "symbol" : "number";
    const last = out.at(-1);
    if (last && last.type === type) last.value += part.value;
    else out.push({ type, value: part.value });
  }
  return out.map((p) => ({ ...p, value: p.type === "symbol" ? p.value.trim() : p.value }));
}

/**
 * Re-expresses an amount in another currency's smallest unit, keeping the
 * number the same: 49.97 RON (4997) -> 49.97 EUR (4997), -> 50 JPY (50),
 * -> 49.970 KWD (49970). Used when a household corrects its currency; it is
 * not an exchange-rate conversion. Rounds half up when decimals are dropped.
 */
export function rescaleMinor(minor: number, from: Currency, to: Currency): number {
  const shift = currencyDecimals(to) - currencyDecimals(from);
  if (shift >= 0) return minor * 10 ** shift;
  const factor = 10 ** -shift;
  return Math.sign(minor) * Math.floor((Math.abs(minor) + factor / 2) / factor);
}
