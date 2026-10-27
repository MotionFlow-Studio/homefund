import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  currencyDecimals,
  formatMoney,
  fromMinor,
  isCurrency,
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
    expect(() => toMinor("49.975", "EUR")).toThrow();
    expect(() => toMinor("49.5", "JPY")).toThrow();
  });
});

describe("fromMinor and formatMoney", () => {
  it("round-trips 49.97 without loss", () => {
    expect(fromMinor(toMinor("49.97", "EUR"), "EUR")).toBe(49.97);
    expect(formatMoney(4997, "EUR")).toBe("€49.97");
    expect(formatMoney(4997, "USD")).toBe("$49.97");
    expect(formatMoney(4997, "HUF")).toContain("49.97");
    expect(formatMoney(4997, "RON")).toContain("49.97");
    expect(formatMoney(49970, "KWD")).toContain("49.970");
    expect(formatMoney(50, "JPY")).toContain("50");
  });
});

describe("formatMoneyParts", () => {
  it("separates the symbol from the number", async () => {
    const parts = (await import("@/lib/money")).formatMoneyParts;
    expect(parts(4997, "EUR")).toEqual([{ type: "symbol", value: "€" }, { type: "number", value: "49.97" }]);
    expect(parts(-4997, "EUR").map((p) => p.value).join("")).toBe("-€49.97");
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
    expect(formatMoney(4997, "HUF")).toContain("49.97");
  });
});
