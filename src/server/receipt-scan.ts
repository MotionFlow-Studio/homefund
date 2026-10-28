import "server-only";
import sharp from "sharp";
import { CATEGORY_LIST } from "@/lib/categories";
import type { ReceiptScan } from "@/lib/receipt";
import { RECEIPT_UPLOAD_MAX_SIDE } from "@/lib/receipt-limits";
import { readImageAsJson, segment } from "@/server/meta-api";
import { bestBox, cropRect, parseReceiptJson, RECEIPT_JSON_SCHEMA } from "@/server/receipt-parse";

/** Reading failed for a reason the user can act on. */
export class ScanError extends Error {
  constructor(readonly code: "unsupported_image" | "not_a_receipt" | "scan_failed") {
    super(code);
  }
}

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Refuses decompression bombs: about 40 megapixels at most. */
const MAX_INPUT_PIXELS = 40_000_000;

/** SAM ignores tiny matches below this confidence. */
const MIN_BOX_CONFIDENCE = 0.3;

const PROMPT = [
  "Read this shop receipt.",
  "Return every purchased line item exactly as printed: amounts as decimal strings with a dot, no rounding.",
  "If a discount is printed under an item, return the discount as its own line with a negative line_total.",
  "Also return the merchant, the purchase date, the ISO 4217 currency code and the grand total.",
  "Sort each item into one category:",
  ...CATEGORY_LIST.map((category) => `- ${category.id}: ${category.hint}`),
  "Ignore tax summaries, payment, change and loyalty lines.",
  "If the image is not a receipt, set is_receipt to false and return no items.",
].join("\n");

/**
 * Reads a receipt photo: SAM 3.1 finds the receipt, the photo is cropped to
 * it, and Muse Spark 1.3 reads the lines. Everything happens in memory; the
 * photo is never written anywhere.
 */
export async function scanReceipt(
  bytes: Uint8Array,
  fallbackCurrency: string,
  signal: AbortSignal,
): Promise<ReceiptScan> {
  const photo = await normalize(bytes);
  const cropped = await cropToReceipt(photo, signal);

  const json = await readImageAsJson(cropped, PROMPT, { name: "receipt", schema: RECEIPT_JSON_SCHEMA }, signal);
  const parsed = parseReceiptJson(json, fallbackCurrency);
  if (!parsed.ok) throw new ScanError(parsed.reason === "not_a_receipt" ? "not_a_receipt" : "scan_failed");
  return parsed.receipt;
}

/** Checks the image, turns it upright, removes its metadata and caps its size. */
async function normalize(bytes: Uint8Array) {
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const { format } = await image.metadata();
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new ScanError("unsupported_image");

    const { data, info } = await image
      .rotate()
      .resize({ width: RECEIPT_UPLOAD_MAX_SIDE, height: RECEIPT_UPLOAD_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof ScanError) throw error;
    throw new ScanError("unsupported_image");
  }
}

/**
 * Crops the photo to the receipt so the reader sees only the paper. If SAM
 * finds nothing or is unavailable, the whole photo is read instead.
 */
async function cropToReceipt(photo: { data: Buffer; width: number; height: number }, signal: AbortSignal) {
  let box;
  try {
    box = bestBox(await segment(photo.data, "receipt", signal));
  } catch (error) {
    if (signal.aborted) throw error;
    box = null;
  }
  if (!box || box.c < MIN_BOX_CONFIDENCE) return photo.data;

  const rect = cropRect(box, photo.width, photo.height);
  if (rect.width < 32 || rect.height < 32) return photo.data;

  return sharp(photo.data)
    .extract(rect)
    .resize({ width: 1024, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
