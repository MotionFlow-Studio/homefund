import type { CategoryId } from "@/lib/categories";

/** One purchased line, ready to be saved as a receipt item. */
export type ScannedItem = {
  name: string;
  /** Quantity in thousandths: 1 piece = 1000, 0.512 kg = 512. */
  quantityMilli: number;
  /** Unit price as printed, as a decimal string, or null if not printed. */
  unitPrice: string | null;
  /** What was paid for the line, discounts included, in minor units. */
  lineTotalMinor: number;
  category: CategoryId;
};

/** What the server read from a receipt photo. The photo itself is never kept. */
export type ReceiptScan = {
  merchant: string | null;
  /** Purchase date (YYYY-MM-DD) if it could be read. */
  spentOn: string | null;
  /** Currency of every amount below. */
  currency: string;
  /** False when the receipt showed no currency and the household currency was assumed. */
  currencyDetected: boolean;
  /** Grand total as printed, or null if it could not be read. */
  totalMinor: number | null;
  /** Sum of the line totals. */
  itemsTotalMinor: number;
  /** True when the line totals add up to the printed total. */
  totalsMatch: boolean;
  items: ScannedItem[];
};

/** Error codes returned by POST /api/receipt/scan. */
export type ReceiptScanError =
  | "unauthorized"
  | "forbidden"
  | "invalid_input"
  | "too_large"
  | "unsupported_image"
  | "not_a_receipt"
  | "rate_limited"
  | "busy"
  | "timeout"
  | "scan_failed"
  | "unavailable";
