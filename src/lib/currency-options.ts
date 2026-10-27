import { CURRENCIES } from "@/lib/money";

/** Shown first in the currency picker. */
export const SUGGESTED_CURRENCIES = ["EUR", "RON", "HUF", "USD", "GBP", "PLN", "CZK", "CHF"];

const REGION_CURRENCY: Record<string, string> = {
  HU: "HUF", RO: "RON", PL: "PLN", CZ: "CZK", GB: "GBP", US: "USD", CH: "CHF",
  SE: "SEK", DK: "DKK", NO: "NOK", BG: "BGN", RS: "RSD", MD: "MDL", UA: "UAH",
  CA: "CAD", AU: "AUD", JP: "JPY", TR: "TRY", IS: "ISK",
};

export type CurrencyOption = { code: string; name: string };

export function currencyOptions(locale = "en"): CurrencyOption[] {
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  const rest = CURRENCIES.filter((c) => !SUGGESTED_CURRENCIES.includes(c));
  return [...SUGGESTED_CURRENCIES, ...rest].map((code) => ({ code, name: names.of(code) ?? code }));
}

/** Best guess from the browser language, e.g. "hu-HU" -> HUF. Euro otherwise. */
export function guessCurrency(languages: readonly string[]): string {
  for (const language of languages) {
    const region = new Intl.Locale(language).maximize().region;
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return "EUR";
}
