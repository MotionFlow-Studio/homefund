import { describe, expect, it } from "vitest";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";

describe("toMinor", () => {
  it("converts numbers and strings to minor units", () => {
    expect(toMinor(12.5)).toBe(1250);
    expect(toMinor("12,50")).toBe(1250);
    expect(toMinor("4 500")).toBe(450000);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("rejects invalid input", () => {
    expect(() => toMinor("abc")).toThrow();
  });
});

describe("fromMinor", () => {
  it("converts minor units back to major units", () => {
    expect(fromMinor(1250)).toBe(12.5);
  });
});

describe("formatMoney", () => {
  it("formats each currency for its locale", () => {
    expect(formatMoney(1250, "EUR")).toContain("12.50");
    expect(formatMoney(1250, "RON")).toContain("12,50");
    const huf = formatMoney(450000, "HUF");
    expect(huf).toContain("Ft");
    expect(huf).not.toContain(",");
  });
});
