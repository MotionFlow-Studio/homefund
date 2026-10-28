import { currencyDecimals, formatMoney } from "@/lib/money";

/*
 * Checks a read receipt before it is saved. Runs on the server right after
 * reading, and again in the app while the user corrects the lines.
 */

/**
 * Smallest coin used when paying cash, in minor units. Shops round cash
 * payments to it, so the printed total can differ from the lines by up to
 * half a coin. Currencies not listed are paid to the exact minor unit.
 */
const CASH_STEP: Record<string, number> = {
  AUD: 5,
  CAD: 5,
  CHF: 5,
  CZK: 100,
  DKK: 50,
  EUR: 5,
  HUF: 500,
  NOK: 100,
  NZD: 10,
  SEK: 100,
};

/** How far the lines may be from the printed total and still count as matching. */
export function totalTolerance(currency: string): number {
  return Math.max(1, Math.floor((CASH_STEP[currency] ?? 1) / 2));
}

export type CheckedLine = {
  quantityMilli: number;
  unitPrice: string | null;
  lineTotalMinor: number;
  /** Discounts already taken off this line. */
  discountMinor: number;
};

export type ReceiptWarning =
  | { code: "total_mismatch"; differenceMinor: number }
  | { code: "no_total" }
  | { code: "line_mismatch"; line: number; expectedMinor: number }
  | { code: "no_date" }
  | { code: "currency_assumed" }
  | { code: "other_currency"; currency: string };

export type ReceiptCheck = {
  /** "ok" when nothing needs a second look; "check" when the user should look before saving. */
  status: "ok" | "check";
  /** Lines total minus printed total (0 when they match exactly). */
  differenceMinor: number;
  /** True when the lines match the printed total within the tolerance. */
  totalsMatch: boolean;
  warnings: ReceiptWarning[];
};

export type CheckInput = {
  currency: string;
  currencyDetected: boolean;
  spentOn: string | null;
  totalMinor: number | null;
  items: CheckedLine[];
};

/** Unit price as an exact fraction of minor units: "6.99" EUR -> 699. */
function unitPriceMinor(unitPrice: string, decimals: number): number | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(unitPrice);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return Number(`${whole}.${fraction}`) * 10 ** decimals;
}

/**
 * Finds what looks wrong in a read receipt: lines that do not add up to the
 * total, a line whose quantity times unit price is not its amount, a missing
 * date, or a currency that was assumed or differs from the household's.
 */
export function checkReceipt(receipt: CheckInput, householdCurrency: string): ReceiptCheck {
  const warnings: ReceiptWarning[] = [];
  const tolerance = totalTolerance(receipt.currency);

  const linesTotal = receipt.items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  let differenceMinor = 0;
  let totalsMatch = false;
  if (receipt.totalMinor === null) {
    warnings.push({ code: "no_total" });
  } else {
    differenceMinor = linesTotal - receipt.totalMinor;
    totalsMatch = Math.abs(differenceMinor) <= tolerance;
    if (!totalsMatch) warnings.push({ code: "total_mismatch", differenceMinor });
  }

  receipt.items.forEach((item, line) => {
    if (item.unitPrice === null) return;
    const unit = unitPriceMinor(item.unitPrice, currencyDecimals(receipt.currency));
    if (unit === null) return;
    const expectedMinor = Math.round((unit * item.quantityMilli) / 1000);
    const charged = item.lineTotalMinor + item.discountMinor;
    // Weighed goods round once more, so allow a minor unit per started kilo.
    const allowed = tolerance + Math.ceil(item.quantityMilli / 1000);
    if (Math.abs(expectedMinor - charged) > allowed) {
      warnings.push({ code: "line_mismatch", line, expectedMinor });
    }
  });

  if (!receipt.spentOn) warnings.push({ code: "no_date" });
  if (!receipt.currencyDetected) warnings.push({ code: "currency_assumed" });
  else if (receipt.currency !== householdCurrency) warnings.push({ code: "other_currency", currency: receipt.currency });

  const needsLook = warnings.some((warning) => warning.code !== "other_currency" && warning.code !== "no_date");
  return { status: needsLook ? "check" : "ok", differenceMinor, totalsMatch, warnings };
}

/** What the review screen says about a warning. */
export function warningText(warning: ReceiptWarning, currency: string): string {
  switch (warning.code) {
    case "total_mismatch": {
      const amount = formatMoney(Math.abs(warning.differenceMinor), currency);
      return warning.differenceMinor > 0
        ? `The items add up to ${amount} more than the receipt total. Check the amounts or remove a line.`
        : `The items add up to ${amount} less than the receipt total. A line may be missing or misread.`;
    }
    case "no_total":
      return "The total could not be read. Compare the items with the receipt before saving.";
    case "line_mismatch":
      return `Line ${warning.line + 1}: quantity times price is ${formatMoney(warning.expectedMinor, currency)}. Check this amount.`;
    case "no_date":
      return "The date could not be read, so today is used. Change it if needed.";
    case "currency_assumed":
      return `No currency was printed, so ${currency} is assumed.`;
    case "other_currency":
      return `This receipt is in ${warning.currency}, not your household currency.`;
  }
}
