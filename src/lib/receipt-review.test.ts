import { describe, expect, it } from "vitest";
import { categorySplit, mainCategory, scaleToTotal } from "./receipt-review";

describe("scaling a receipt to what was paid", () => {
  it("keeps proportions and the exact total", () => {
    // A 7,834 Ft receipt paid as 97.21 lei
    const lines = [77800, 59900, 225900, 19900, 5000, 349900, 45000];
    const scaled = scaleToTotal(lines, 9721);
    expect(scaled.reduce((a, b) => a + b, 0)).toBe(9721);
    expect(scaled).toEqual([966, 743, 2803, 247, 62, 4342, 558]);
  });

  it("handles a single line and empty amounts", () => {
    expect(scaleToTotal([500], 1234)).toEqual([1234]);
    expect(scaleToTotal([0, 0], 100)).toEqual([100, 0]);
  });

  it("never loses a minor unit", () => {
    for (let run = 1; run < 300; run++) {
      const lines = Array.from({ length: 1 + (run % 7) }, (_, i) => ((run * 4513 + i * 7717) % 9000) + 1);
      const total = (run * 977) % 100_000;
      expect(scaleToTotal(lines, total).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe("main category", () => {
  it("is the one with the most money", () => {
    expect(
      mainCategory([
        { category: "groceries", amountMinor: 778 },
        { category: "household", amountMinor: 3499 },
        { category: "groceries", amountMinor: 2259 },
        { category: "groceries", amountMinor: 599 },
        { category: "kids", amountMinor: 450 },
      ]),
    ).toBe("groceries");
    expect(mainCategory([{ category: "kids", amountMinor: 1 }, { category: "fun", amountMinor: 1 }])).toBe("kids");
  });
});

describe("categorySplit", () => {
  it("adds up per category, largest first, without empty ones", () => {
    expect(
      categorySplit([
        { category: "groceries", amountMinor: 749 },
        { category: "household", amountMinor: 999 },
        { category: "groceries", amountMinor: 5490 },
        { category: "kids", amountMinor: 0 },
      ]),
    ).toEqual([
      { category: "groceries", amountMinor: 6239 },
      { category: "household", amountMinor: 999 },
    ]);
  });
});
