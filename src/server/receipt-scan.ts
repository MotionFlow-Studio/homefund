import "server-only";
import sharp, { type Sharp } from "sharp";
import { CATEGORY_LIST } from "@/lib/categories";
import type { CropArea, ReceiptScan } from "@/lib/receipt";
import { readImageAsJson, segment } from "@/server/meta-api";
import { bestBox, cropArea, cropRect, parseReceiptJson, RECEIPT_JSON_SCHEMA } from "@/server/receipt-parse";

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

/** Largest photo kept for cropping (longest side, pixels). */
const SOURCE_MAX_SIDE = 4096;

/** SAM looks for the receipt on a copy this size; it only needs the outline. */
const DETECT_MAX_SIDE = 1600;

/** The cropped receipt is sent to Muse Spark at most this size. */
const READ_MAX_WIDTH = 1024;
const READ_MAX_HEIGHT = 1600;

type Photo = { data: Buffer; width: number; height: number };

/**
 * Reads a receipt photo: SAM 3.1 finds the receipt on a small copy, the
 * sharp original is cropped to it, and Muse Spark 1.3 reads the lines.
 * Everything happens in memory; the photo is never written anywhere.
 */
export async function scanReceipt(
  bytes: Uint8Array,
  fallbackCurrency: string,
  signal: AbortSignal,
): Promise<ReceiptScan> {
  const photo = await normalize(bytes);
  const { image, crop } = await cropToReceipt(photo, signal);

  const json = await readImageAsJson(image, PROMPT, { name: "receipt", schema: RECEIPT_JSON_SCHEMA }, signal);
  const parsed = parseReceiptJson(json, fallbackCurrency);
  if (!parsed.ok) throw new ScanError(parsed.reason === "not_a_receipt" ? "not_a_receipt" : "scan_failed");
  return { ...parsed.receipt, crop };
}

/** Checks the image, turns it upright, removes its metadata and caps its size. */
async function normalize(bytes: Uint8Array): Promise<Photo> {
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const { format } = await image.metadata();
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new ScanError("unsupported_image");

    const { data, info } = await image
      .rotate()
      .resize({ width: SOURCE_MAX_SIDE, height: SOURCE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof ScanError) throw error;
    throw new ScanError("unsupported_image");
  }
}

/** Small receipts are enlarged up to this much so their print stays legible. */
const MAX_ENLARGEMENT = 2;

/** Scales an image of the given size to fit the reading size. */
function fitForReading(image: Sharp, width: number, height: number) {
  const scale = Math.min(READ_MAX_WIDTH / width, READ_MAX_HEIGHT / height, MAX_ENLARGEMENT);
  return image
    .resize({ width: Math.round(width * scale), height: Math.round(height * scale), fit: "fill" })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Crops the photo to the receipt so the reader sees only the paper, at full
 * sharpness even when the receipt fills a small part of the photo. If SAM
 * finds nothing or is unavailable, the whole photo is read instead.
 */
async function cropToReceipt(photo: Photo, signal: AbortSignal): Promise<{ image: Buffer; crop: CropArea | null }> {
  const whole = async () => ({ image: await fitForReading(sharp(photo.data), photo.width, photo.height), crop: null });

  let box;
  try {
    const small = await sharp(photo.data)
      .resize({ width: DETECT_MAX_SIDE, height: DETECT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    box = bestBox(await segment(small, "receipt", signal));
  } catch (error) {
    if (signal.aborted) throw error;
    box = null;
  }
  if (!box || box.c < MIN_BOX_CONFIDENCE) return whole();

  const padding = Math.round(Math.max(photo.width, photo.height) * 0.012);
  const rect = cropRect(box, photo.width, photo.height, padding);
  if (rect.width < 64 || rect.height < 64) return whole();

  return {
    image: await fitForReading(sharp(photo.data).extract(rect), rect.width, rect.height),
    crop: cropArea(rect, photo.width, photo.height),
  };
}
