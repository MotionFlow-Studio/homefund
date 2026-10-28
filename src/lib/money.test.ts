import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  currencyDecimals,
  formatMoney,
  fromMinor,
  isCurrency,
  rescaleMinor,
  toMinor,
} from "@/lib/money";

describe("currencies", () => {
  it("supports every ISO currency", () => {
    expect(CURRENCIES.length).toBeGreaterThan(100);
    for (const code of ["EUR", "USD", "GBP", "HUF", "RON", "PLN", "CHF", "JPY", "KWD"]) {
      expect(isCurrency(code)).toBe(true);
    }
    expect(isCurrency("XYZ1")).toBe(false);
  });

  it("knows each currency's decimals", () => {
    expect(currencyDecimals("EUR")).toBe(2);
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("KWD")).toBe(3);
  });
});

describe("toMinor", () => {
  it("keeps decimals exactly, with no rounding", () => {
    expect(toMinor("49.97", "EUR")).toBe(4997);
    expect(toMinor("49,97", "HUF")).toBe(4997);
    expect(toMinor(49.97, "USD")).toBe(4997);
    expect(toMinor("0.01", "EUR")).toBe(1);
    expect(toMinor("1 234.5", "EUR")).toBe(123450);
    expect(toMinor("12", "EUR")).toBe(1200);
    expect(toMinor("49.970", "KWD")).toBe(49970);
    expect(toMinor("50", "JPY")).toBe(50);
  });

  it("rejects invalid input and too many decimals", () => {
    expect(() => toMinor("abc", "EUR")).toThrow();
    expect(() => toMinor("49,975", "EUR")).toThrow();
    expect(() => toMinor("1.500", "GBP")).toThrow();
    expect(() => toMinor("49.5", "JPY")).toThrow();
  });
});

/** Intl uses no-break spaces between groups and before symbols; compare with plain ones. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");

describe("fromMinor and formatMoney", () => {
  it("round-trips 49.97 without loss", () => {
    expect(fromMinor(toMinor("49.97", "EUR"), "EUR")).toBe(49.97);
    expect(plain(formatMoney(4997, "EUR"))).toBe("49,97 €");
    expect(formatMoney(4997, "USD")).toBe("$49.97");
    expect(plain(formatMoney(49970, "KWD"))).toContain("49.970");
    expect(formatMoney(50, "JPY")).toBe("¥50");
  });

  it("writes each currency the way its users do", () => {
    expect(plain(formatMoney(123456, "EUR"))).toBe("1 234,56 €");
    expect(plain(formatMoney(123456, "RON"))).toBe("1.234,56 lei");
    expect(plain(formatMoney(1234500, "HUF"))).toBe("12 345 Ft");
    expect(plain(formatMoney(123400, "HUF"))).toBe("1 234 Ft");
    expect(plain(formatMoney(4997, "HUF"))).toBe("49,97 Ft");
    expect(formatMoney(123456, "GBP")).toBe("£1,234.56");
    expect(plain(formatMoney(123456, "PLN"))).toBe("1 234,56 zł");
    expect(plain(formatMoney(123456, "CHF"))).toBe("CHF 1’234.56");
    expect(plain(formatMoney(123456, "ZAR"))).toContain("1,234.56");
  });
});

describe("typing amounts", () => {
  it("understands local separators", () => {
    expect(toMinor("1.234,56", "RON")).toBe(123456);
    expect(toMinor("1 234,56", "EUR")).toBe(123456);
    expect(toMinor("1,234.56", "USD")).toBe(123456);
    expect(toMinor("1.500", "RON")).toBe(150000);
    expect(toMinor("1.500", "EUR")).toBe(150000);
    expect(toMinor("12 345", "HUF")).toBe(1234500);
    expect(toMinor("1.234.567", "HUF")).toBe(123456700);
    expect(toMinor("49.97", "RON")).toBe(4997);
    expect(toMinor("1.500", "KWD")).toBe(1500);
  });

  it("prefills fields the same way", async () => {
    const { formatAmountInput, amountPlaceholder } = await import("@/lib/money");
    expect(formatAmountInput(123456, "RON")).toBe("1234,56");
    expect(formatAmountInput(123456, "GBP")).toBe("1234.56");
    expect(formatAmountInput(1234500, "HUF")).toBe("12345");
    expect(toMinor(formatAmountInput(123456, "RON"), "RON")).toBe(123456);
    expect(amountPlaceholder("RON")).toBe("0,00");
    expect(amountPlaceholder("USD")).toBe("0.00");
    expect(amountPlaceholder("JPY")).toBe("0");
  });
});

describe("formatMoneyParts", () => {
  it("separates the symbol from the number, wherever it stands", async () => {
    const parts = (await import("@/lib/money")).formatMoneyParts;
    expect(parts(4997, "GBP")).toEqual([{ type: "symbol", value: "£" }, { type: "number", value: "49.97" }]);
    expect(parts(-4997, "GBP").map((p) => p.value).join("")).toBe("-£49.97");
    expect(parts(123456, "RON").map((p) => ({ ...p, value: plain(p.value) }))).toEqual([
      { type: "number", value: "1.234,56 " },
      { type: "symbol", value: "lei" },
    ]);
  });
});

describe("currency decimals are the same everywhere", () => {
  it("follows ISO 4217, not the runtime", () => {
    expect(currencyDecimals("HUF")).toBe(2);
    expect(currencyDecimals("RON")).toBe(2);
    expect(currencyDecimals("ISK")).toBe(0);
    expect(currencyDecimals("KRW")).toBe(0);
    expect(currencyDecimals("BHD")).toBe(3);
    expect(toMinor("49,97", "HUF")).toBe(4997);
    expect(plain(formatMoney(4997, "HUF"))).toBe("49,97 Ft");
  });
});

describe("rescaleMinor", () => {
  it("keeps the number when the currency changes", () => {
    expect(rescaleMinor(4997, "RON", "EUR")).toBe(4997);
    expect(rescaleMinor(4997, "RON", "JPY")).toBe(50);
    expect(rescaleMinor(4949, "RON", "JPY")).toBe(49);
    expect(rescaleMinor(4950, "RON", "JPY")).toBe(50);
    expect(rescaleMinor(4997, "RON", "KWD")).toBe(49970);
    expect(rescaleMinor(50, "JPY", "EUR")).toBe(5000);
    expect(rescaleMinor(0, "EUR", "JPY")).toBe(0);
  });
});
