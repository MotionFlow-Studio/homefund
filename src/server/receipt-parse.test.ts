import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";
import {
  amountToMinor,
  bestBox,
  cropArea,
  cropRect,
  normalizeUnitPrice,
  parseReceiptJson,
  quantityToMilli,
} from "./receipt-parse";

describe("SAM boxes", () => {
  const output =
    "<0f>0<|box;x1=473;y1=186;x2=1249;y2=1722;w=1600;h=2000;c=0.808|><|mask;data=1,2,x|>," +
    "<|box;x1=10;y1=10;x2=50;y2=50;w=1600;h=2000;c=0.41|>";

  it("picks the most confident box", () => {
    expect(bestBox(output)).toMatchObject({ x1: 473, y2: 1722, c: 0.808 });
  });

  it("returns null when nothing was found", () => {
    expect(bestBox("")).toBeNull();
    expect(bestBox("<|box;x1=5;y1=5;x2=1;y2=1;w=10;h=10;c=0.9|>")).toBeNull();
  });

  it("scales and pads the crop to the real image size", () => {
    const box = bestBox(output)!;
    expect(cropRect(box, 800, 1000)).toEqual({ left: 216, top: 73, width: 429, height: 808 });
    expect(cropRect({ ...box, x1: 0, y1: 0, x2: 1600, y2: 2000 }, 1600, 2000)).toEqual({
      left: 0,
      top: 0,
      width: 1600,
      height: 2000,
    });
  });
});

describe("amounts", () => {
  it("converts printed amounts exactly", () => {
    expect(amountToMinor("105.07", "RON")).toBe(10507);
    expect(amountToMinor("49.97", "EUR")).toBe(4997);
    expect(amountToMinor("49,97", "EUR")).toBe(4997);
    expect(amountToMinor("1 299", "HUF")).toBe(129900);
    expect(amountToMinor("1.234,50", "EUR")).toBe(123450);
    expect(amountToMinor("1,234.50", "USD")).toBe(123450);
    expect(amountToMinor("1200", "JPY")).toBe(1200);
    expect(amountToMinor("3.250", "KWD")).toBe(3250);
    expect(amountToMinor("-3.50", "EUR")).toBe(-350);
  });

  it("rounds extra decimals half up and rejects text", () => {
    expect(amountToMinor("1.005", "EUR")).toBe(101);
    expect(amountToMinor("1.004", "EUR")).toBe(100);
    expect(amountToMinor("abc", "EUR")).toBeNull();
    expect(amountToMinor("", "EUR")).toBeNull();
  });

  it("reads quantities and unit prices", () => {
    expect(quantityToMilli("2")).toBe(2000);
    expect(quantityToMilli("0,512")).toBe(512);
    expect(quantityToMilli("x")).toBe(1000);
    expect(normalizeUnitPrice("12,99")).toBe("12.99");
    expect(normalizeUnitPrice("free")).toBeNull();
  });
});

describe("receipt JSON", () => {
  const receipt = (overrides: object = {}) =>
    JSON.stringify({
      is_receipt: true,
      merchant: "  Lidl   Romania ",
      date: "2026-10-27",
      currency: "ron",
      total: "12.49",
      items: [
        { name: "Milk", quantity: "2", unit_price: "4.50", line_total: "9.00", category: "groceries" },
        { name: "Discount", quantity: "1", unit_price: null, line_total: "-1.00", category: "groceries" },
        { name: "Soap", quantity: "1", unit_price: "4.49", line_total: "4.49", category: "household" },
      ],
      ...overrides,
    });

  it("turns the model answer into checked data", () => {
    const result = parseReceiptJson(receipt(), "EUR");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt).toMatchObject({
      merchant: "Lidl Romania",
      spentOn: "2026-10-27",
      currency: "RON",
      currencyDetected: true,
      totalMinor: 1249,
      itemsTotalMinor: 1249,
      totalsMatch: true,
    });
    expect(result.receipt.items.map((item) => [item.name, item.lineTotalMinor, item.quantityMilli])).toEqual([
      ["Milk", 800, 2000],
      ["Soap", 449, 1000],
    ]);
  });

  it("falls back to the household currency and flags totals that do not add up", () => {
    const result = parseReceiptJson(receipt({ currency: null, total: "99.00", date: "27/10/2026" }), "EUR");
    expect(result.ok && result.receipt).toMatchObject({
      currency: "EUR",
      currencyDetected: false,
      spentOn: null,
      totalsMatch: false,
    });
  });

  it("recognises photos that are not receipts and broken answers", () => {
    expect(parseReceiptJson(receipt({ is_receipt: false }), "EUR")).toEqual({ ok: false, reason: "not_a_receipt" });
    expect(parseReceiptJson(receipt({ items: [] }), "EUR")).toEqual({ ok: false, reason: "not_a_receipt" });
    expect(parseReceiptJson("{", "EUR")).toEqual({ ok: false, reason: "invalid" });
    expect(parseReceiptJson(receipt({ items: [{ name: "x" }] }), "EUR")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("rate limiter", () => {
  it("allows the limit, then says how long to wait", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.hit("a", 0);
    expect(limiter.retryAfter("a", 1_000)).toBe(0);
    limiter.hit("a", 1_000);
    expect(limiter.retryAfter("a", 2_000)).toBe(58);
    expect(limiter.retryAfter("b", 2_000)).toBe(0);
    expect(limiter.retryAfter("a", 60_001)).toBe(0);
  });
});

describe("crop area", () => {
  it("reports the crop as fractions of the photo", () => {
    expect(cropArea({ left: 216, top: 73, width: 429, height: 808 }, 800, 1000)).toEqual({
      x: 0.27,
      y: 0.073,
      width: 0.5363,
      height: 0.808,
    });
  });
});
