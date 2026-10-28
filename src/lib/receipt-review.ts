import type { CategoryId } from "@/lib/categories";

/*
 * Pure helpers for the receipt review screen.
 */

/**
 * Scales amounts so they add up to `total` exactly, keeping their proportions.
 * Used when a receipt in another currency is paid in the household currency:
 * every line gets its share of what was actually paid. Remainders go to the
 * largest shares first.
 */
export function scaleToTotal(amounts: number[], total: number): number[] {
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum === 0) return amounts.map((_, index) => (index === 0 ? total : 0));

  const shares = amounts.map((amount, index) => {
    const exact = (amount * total) / sum;
    return { index, whole: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = total - shares.reduce((a, share) => a + share.whole, 0);
  for (const share of [...shares].sort((a, b) => b.rest - a.rest || a.index - b.index)) {
    if (left === 0) break;
    share.whole += 1;
    left -= 1;
  }
  return shares.map((share) => share.whole);
}

/** The category with the most money on the receipt; ties go to the first one listed. */
export function mainCategory(lines: { category: CategoryId; amountMinor: number }[]): CategoryId {
  const totals = new Map<CategoryId, number>();
  for (const line of lines) totals.set(line.category, (totals.get(line.category) ?? 0) + line.amountMinor);
  let best: CategoryId = lines[0]?.category ?? "other";
  for (const [category, total] of totals) if (total > (totals.get(best) ?? 0)) best = category;
  return best;
}
