import "server-only";
import sharp, { type Sharp } from "sharp";
import { CATEGORY_LIST } from "@/lib/categories";
import type { CropArea, ReceiptScan } from "@/lib/receipt";
import { RECEIPT_TIMEOUT_MS } from "@/lib/receipt-limits";
import { readImageAsJson, segment } from "@/server/meta-api";
import { bestBox, cropArea, cropRect, parseReceiptJson, RECEIPT_JSON_SCHEMA } from "@/server/receipt-parse";

/** Reading failed for a reason the user can act on. */
export class ScanError extends Error {
  constructor(readonly code: "unsupported_image" | "not_a_receipt" | "unreadable" | "scan_failed") {
    super(code);
  }
}

// sharp keeps recent images in an in-memory cache by default; receipt photos
// must not outlive their request.
sharp.cache(false);

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Refuses decompression bombs: about 40 megapixels at most. */
const MAX_INPUT_PIXELS = 40_000_000;

/** SAM ignores tiny matches below this confidence. */
const MIN_BOX_CONFIDENCE = 0.3;

const PROMPT = [
  "Read this shop receipt and return its contents in the given JSON format.",
  "",
  "Amounts: decimal strings exactly as printed, with a dot as the decimal separator and no thousands",
  'separators ("2 559" -> "2559", "1,19" -> "1.19"). Never round or calculate amounts yourself.',
  "",
  "items, in printed order:",
  '- kind "item": every product or service paid for, including bottle deposits and bag fees.',
  "  line_total is the amount printed for the line; quantity is the count or weight",
  '  ("2", "0.856"); unit_price is the price per piece or per kg if printed, otherwise null.',
  '- kind "item_discount": a discount printed under a product. line_total is negative.',
  '- kind "receipt_discount": a coupon or discount for the whole receipt, usually after the',
  "  subtotal. line_total is negative.",
  "Leave out subtotals, VAT or tax summaries, cash rounding, payment, change, cashback and loyalty",
  "point lines.",
  "",
  "total: the final amount paid, as printed.",
  'currency: ISO 4217 code from the printed symbol or word ("Ft" -> HUF, "lei" -> RON, "€" -> EUR),',
  "or null if none is printed.",
  "date: purchase date as YYYY-MM-DD, or null. merchant: the shop name.",
  "",
  "category for every line, from this list (a bottle deposit gets the category of its drink;",
  "a discount gets the category of what it discounts):",
  ...CATEGORY_LIST.map((category) => `- ${category.id}: ${category.hint}`),
  "",
  "If the image is not a receipt, set is_receipt to false and return no items.",
  "readable: false if the print is too blurry, dark, glared or cut off to read every amount with",
  "certainty. Never guess amounts; when unsure, set readable to false and return no items.",
].join("\n");

/** A second, more careful read is only attempted if this much time is left. */
const RETRY_TIME_LEFT_MS = 15_000;

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
  const started = Date.now();
  const photo = await normalize(bytes);
  const { image, crop } = await cropToReceipt(photo, signal);

  let parsed = await read(image, "low", fallbackCurrency, signal);

  // If the lines do not add up to the printed total, read once more, more
  // carefully, as long as there is time; keep whichever answer adds up.
  const needsSecondLook =
    !parsed.ok ? parsed.reason === "invalid" : parsed.receipt.totalMinor !== null && !parsed.receipt.check.totalsMatch;
  if (needsSecondLook && Date.now() - started < RECEIPT_TIMEOUT_MS - RETRY_TIME_LEFT_MS) {
    const second = await read(image, "medium", fallbackCurrency, signal);
    if (second.ok && (!parsed.ok || second.receipt.check.totalsMatch)) parsed = second;
  }

  if (!parsed.ok) throw new ScanError(parsed.reason === "invalid" ? "scan_failed" : parsed.reason);
  return { ...parsed.receipt, crop };
}

async function read(image: Buffer, effort: "low" | "medium", fallbackCurrency: string, signal: AbortSignal) {
  const json = await readImageAsJson(image, PROMPT, { name: "receipt", schema: RECEIPT_JSON_SCHEMA }, effort, signal);
  return parseReceiptJson(json, fallbackCurrency);
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
