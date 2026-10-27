import { describe, expect, it } from "vitest";
import { expenseSchema } from "@/lib/model";

const base = {
  id: "0b6f1f5e-3c1a-4d2e-9f7a-1a2b3c4d5e6f",
  householdId: "1b6f1f5e-3c1a-4d2e-9f7a-1a2b3c4d5e6f",
  memberId: "2b6f1f5e-3c1a-4d2e-9f7a-1a2b3c4d5e6f",
  amountMinor: 1250,
  category: "groceries",
  spentOn: "2026-10-27",
  merchant: "Lidl",
  note: null,
  source: "receipt",
  createdByUserId: null,
  createdAt: "2026-10-27T10:00:00.000Z",
  updatedAt: "2026-10-27T10:00:00.000Z",
  deletedAt: null,
};

describe("expenseSchema", () => {
  it("accepts a valid expense", () => {
    expect(expenseSchema.safeParse(base).success).toBe(true);
  });

  it("rejects float amounts, unknown categories and zero", () => {
    expect(expenseSchema.safeParse({ ...base, amountMinor: 12.5 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, category: "cars" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, amountMinor: 0 }).success).toBe(false);
  });
});
