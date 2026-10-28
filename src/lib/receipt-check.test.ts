import { describe, expect, it } from "vitest";
import { checkReceipt, totalTolerance, warningText, type CheckInput } from "./receipt-check";

const line = (lineTotalMinor: number, extra: Partial<CheckInput["items"][number]> = {}) => ({
  quantityMilli: 1000,
  unitPrice: null,
  lineTotalMinor,
  discountMinor: 0,
  ...extra,
});

const receipt = (overrides: Partial<CheckInput> = {}): CheckInput => ({
  currency: "RON",
  currencyDetected: true,
  spentOn: "2026-10-27",
  totalMinor: 1500,
  items: [line(1000), line(500)],
  ...overrides,
});

describe("receipt check", () => {
  it("passes a receipt whose lines add up", () => {
    expect(checkReceipt(receipt(), "RON")).toEqual({ status: "ok", differenceMinor: 0, totalsMatch: true, warnings: [] });
  });

  it("allows cash rounding to the smallest coin", () => {
    expect(totalTolerance("HUF")).toBe(250);
    expect(totalTolerance("EUR")).toBe(2);
    expect(totalTolerance("RON")).toBe(1);
    const huf = receipt({ currency: "HUF", totalMinor: 783500, items: [line(783400)] });
    expect(checkReceipt(huf, "HUF")).toMatchObject({ status: "ok", totalsMatch: true, differenceMinor: -100 });
    const ron = receipt({ totalMinor: 1502 });
    expect(checkReceipt(ron, "RON")).toMatchObject({
      status: "check",
      totalsMatch: false,
      warnings: [{ code: "total_mismatch", differenceMinor: -2 }],
    });
  });

  it("flags a line whose quantity times price is not its amount", () => {
    const items = [
      line(863, { quantityMilli: 1234, unitPrice: "6.99" }),
      line(658, { quantityMilli: 2000, unitPrice: "3.29" }),
      line(800, { quantityMilli: 2000, unitPrice: "4.50", discountMinor: 100 }),
      line(950, { quantityMilli: 2000, unitPrice: "3.29" }),
    ];
    const result = checkReceipt(receipt({ items, totalMinor: 3271 }), "RON");
    expect(result.warnings).toEqual([{ code: "line_mismatch", line: 3, expectedMinor: 658 }]);
    expect(result.status).toBe("check");
  });

  it("notes a missing total, date or currency", () => {
    const result = checkReceipt(receipt({ totalMinor: null, spentOn: null, currencyDetected: false }), "RON");
    expect(result.warnings.map((warning) => warning.code)).toEqual(["no_total", "no_date", "currency_assumed"]);
    expect(result.status).toBe("check");
  });

  it("only informs about a foreign currency or a missing date", () => {
    const result = checkReceipt(receipt({ currency: "EUR", spentOn: null }), "RON");
    expect(result.status).toBe("ok");
    expect(result.warnings.map((warning) => warning.code)).toEqual(["no_date", "other_currency"]);
  });

  it("explains each warning", () => {
    expect(warningText({ code: "total_mismatch", differenceMinor: 250 }, "EUR").replace(/[\u00a0\u202f]/g, " ")).toBe(
      "The items add up to 2,50 € more than the receipt total. Check the amounts or remove a line.",
    );
    expect(warningText({ code: "line_mismatch", line: 3, expectedMinor: 658 }, "RON")).toContain("Line 4");
  });
});
