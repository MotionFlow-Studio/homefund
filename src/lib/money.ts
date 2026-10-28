/**
 * Money is stored as an integer in the currency's smallest unit, with no
 * rounding: 49.97 EUR -> 4997 cents, 49.970 KWD -> 49970 fils, 50 JPY -> 50.
 * Floats are never used for amounts.
 */

/** Every ISO 4217 currency the runtime knows (about 160). */
export const CURRENCIES: readonly string[] = Intl.supportedValuesOf("currency");

const CURRENCY_SET = new Set(CURRENCIES);

export type Currency = string;

/**
 * Each currency is written the way people who use it write it: separators
 * and symbol position follow its home country, whatever the app language.
 * 1 234,56 € · 1.234,56 lei · 12 345 Ft · £1,234.56. Others use British style.
 */
const CURRENCY_LOCALES: Record<string, string> = {
  EUR: "fr-FR",
  RON: "ro-RO",
  HUF: "hu-HU",
  MDL: "ro-MD",
  PLN: "pl-PL",
  CZK: "cs-CZ",
  BGN: "bg-BG",
  RSD: "sr-Latn-RS",
  UAH: "uk-UA",
  TRY: "tr-TR",
  CHF: "de-CH",
  SEK: "sv-SE",
  NOK: "nb-NO",
  DKK: "da-DK",
  ISK: "is-IS",
  GBP: "en-GB",
  USD: "en-US",
  CAD: "en-CA",
  AUD: "en-AU",
  NZD: "en-NZ",
  JPY: "en-JP",
};
const DEFAULT_LOCALE = "en-GB";

/** Currencies with no coins below the unit in daily use: whole amounts are shown without decimals. */
const WHOLE_IN_PRACTICE = new Set(["HUF"]);

/** The locale whose conventions are used to write amounts in this currency. */
export function moneyLocale(currency: Currency): string {
  return CURRENCY_LOCALES[currency] ?? DEFAULT_LOCALE;
}

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

function formatter(currency: Currency, locale: string, style: "currency" | "decimal" = "currency") {
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat(locale, {
    style,
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: WHOLE_IN_PRACTICE.has(currency) ? 0 : decimals,
    maximumFractionDigits: decimals,
    // Group thousands even in four-digit amounts, so amounts line up in lists.
    useGrouping: style === "currency" ? ("always" as unknown as boolean) : false,
  });
}

/** The decimal separator people type for this currency: "," for RON and EUR, "." for GBP. */
export function decimalSeparator(currency: Currency): "." | "," {
  const part = new Intl.NumberFormat(moneyLocale(currency)).formatToParts(1.5).find((p) => p.type === "decimal");
  return part?.value === "," ? "," : ".";
}

/** An amount as it is typed into a field: no symbol, no grouping: 123456 RON -> "1234,56". */
export function formatAmountInput(minor: number, currency: Currency): string {
  return formatter(currency, moneyLocale(currency), "decimal").format(fromMinor(minor, currency));
}

/** Placeholder for an amount field: "0,00" for RON, "0.00" for GBP, "0" for JPY. */
export function amountPlaceholder(currency: Currency): string {
  const decimals = currencyDecimals(currency);
  return decimals > 0 ? `0${decimalSeparator(currency)}${"0".repeat(decimals)}` : "0";
}

/**
 * Converts an amount to the smallest unit, exactly. Accepts the ways people
 * type amounts: toMinor("49.97", "EUR") -> 4997, toMinor("49,97", "EUR") -> 4997,
 * toMinor("1 234,5", "EUR") -> 123450, toMinor("1.234,56", "RON") -> 123456,
 * toMinor("1,234.56", "USD") -> 123456. A lone separator followed by exactly
 * three digits is a thousands separator unless it is the currency's own
 * decimal separator: "1.500" RON is 1500 lei, while "1.500" GBP has too many
 * decimals. Throws if the amount has more decimals than the currency allows.
 */
export function toMinor(value: number | string, currency: Currency): number {
  const decimals = currencyDecimals(currency);
  const raw = typeof value === "number" ? value.toFixed(decimals) : normalizeAmount(value, currency);

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

/** Rewrites a typed amount with "." as the only decimal separator and no grouping. */
function normalizeAmount(value: string, currency: Currency): string {
  const text = value.trim().replace(/[\s'’\u00a0\u202f]/g, "");
  const separators = [...text.matchAll(/[.,]/g)].map((m) => m[0]);
  if (separators.length === 0) return text;

  const last = text.search(/[.,][^.,]*$/);
  const kinds = new Set(separators);
  let decimalAt = last;
  if (kinds.size === 1) {
    const digitsAfter = text.length - last - 1;
    const grouping =
      separators.length > 1 ||
      (digitsAfter === 3 && separators[0] !== decimalSeparator(currency) && currencyDecimals(currency) !== 3);
    if (grouping) decimalAt = -1;
  }
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "." || text[i] === ",") {
      if (i === decimalAt) out += ".";
    } else out += text[i];
  }
  return out;
}

/** Converts the smallest unit back to a plain number: 4997 EUR -> 49.97. */
export function fromMinor(minor: number, currency: Currency): number {
  return minor / 10 ** currencyDecimals(currency);
}

/** Formats for display: 123456 EUR -> "1 234,56 €", 123456 RON -> "1.234,56 lei", 1234500 HUF -> "12 345 Ft". */
export function formatMoney(
  minor: number,
  currency: Currency,
  locale: string = moneyLocale(currency),
): string {
  return formatter(currency, locale).format(fromMinor(minor, currency));
}

/** Formatted amount split into parts, so the symbol can be styled apart from the number. */
export function formatMoneyParts(
  minor: number,
  currency: Currency,
  locale: string = moneyLocale(currency),
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
