/*
 * Pure helpers that turn raw model output into checked receipt data.
 * Kept free of server-only imports so they can be unit tested.
 */
import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/categories";
import { currencyDecimals, isCurrency } from "@/lib/money";
import type { ReceiptScan, ScannedItem } from "@/lib/receipt";

export type Box = { x1: number; y1: number; x2: number; y2: number; w: number; h: number; c: number };

/**
 * Reads the boxes from SAM 3.1 output text, e.g.
 * `<|box;x1=473;y1=186;x2=1249;y2=1722;w=1600;h=2000;c=0.808|>`.
 */
export function parseBoxes(text: string): Box[] {
  const boxes: Box[] = [];
  for (const match of text.matchAll(/<\|box;([^|]*)\|>/g)) {
    const fields = Object.fromEntries(
      match[1].split(";").map((pair) => {
        const [key, value] = pair.split("=");
        return [key, Number(value)];
      }),
    );
    const box = { x1: fields.x1, y1: fields.y1, x2: fields.x2, y2: fields.y2, w: fields.w, h: fields.h, c: fields.c ?? 0 };
    const valid =
      [box.x1, box.y1, box.x2, box.y2, box.w, box.h, box.c].every(Number.isFinite) &&
      box.w > 0 &&
      box.h > 0 &&
      box.x2 > box.x1 &&
      box.y2 > box.y1;
    if (valid) boxes.push(box);
  }
  return boxes;
}

/** The most confident box, or null when nothing was found. */
export function bestBox(text: string): Box | null {
  return parseBoxes(text).reduce<Box | null>((best, box) => (!best || box.c > best.c ? box : best), null);
}

/**
 * The crop rectangle for a box, in the pixels of an image of the given size,
 * with some padding so edge text is not cut off.
 */
export function cropRect(box: Box, width: number, height: number, padding = 20) {
  const sx = width / box.w;
  const sy = height / box.h;
  const left = Math.max(0, Math.floor(box.x1 * sx) - padding);
  const top = Math.max(0, Math.floor(box.y1 * sy) - padding);
  const right = Math.min(width, Math.ceil(box.x2 * sx) + padding);
  const bottom = Math.min(height, Math.ceil(box.y2 * sy) + padding);
  return { left, top, width: right - left, height: bottom - top };
}

/** A crop rectangle as rounded fractions of the image size. */
export function cropArea(rect: { left: number; top: number; width: number; height: number }, width: number, height: number) {
  const round = (value: number) => Math.round(value * 10_000) / 10_000;
  return { x: round(rect.left / width), y: round(rect.top / height), width: round(rect.width / width), height: round(rect.height / height) };
}

/**
 * Converts a printed amount to minor units: "105.07" RON -> 10507,
 * "1 299" HUF -> 129900, "-3,50" EUR -> -350. Extra decimals are rounded
 * half up. Returns null if the text is not an amount.
 */
export function amountToMinor(value: string, currency: string): number | null {
  let raw = value.trim().replace(/[\s  ']/g, "");
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma > lastDot) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else {
    raw = raw.replace(/,/g, "");
  }

  const match = /^([-−]?)(\d+)(?:\.(\d*))?$/.exec(raw);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  const decimals = currencyDecimals(currency);

  let minor = Number(whole + fraction.slice(0, decimals).padEnd(decimals, "0"));
  if (fraction.length > decimals && fraction[decimals] >= "5") minor += 1;
  if (!Number.isSafeInteger(minor)) return null;
  return sign ? -minor : minor;
}

/** "2" -> 2000, "0.512" -> 512, anything unreadable -> 1000 (one piece). */
export function quantityToMilli(value: string): number {
  const quantity = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return 1000;
  return Math.min(1_000_000, Math.max(1, Math.round(quantity * 1000)));
}

/** A plain decimal string like "12.99", or null. */
export function normalizeUnitPrice(value: string | null): string | null {
  if (value === null) return null;
  const raw = value.trim().replace(/[\s ']/g, "").replace(",", ".");
  return /^\d{1,13}(\.\d{1,6})?$/.test(raw) ? raw : null;
}

/** The JSON schema Muse Spark must answer with (strict mode). */
export const RECEIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_receipt", "merchant", "date", "currency", "total", "items"],
  properties: {
    is_receipt: { type: "boolean" },
    merchant: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    currency: { type: ["string", "null"], description: "ISO 4217 code" },
    total: { type: ["string", "null"], description: "Grand total exactly as printed, dot as decimal separator" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit_price", "line_total", "category"],
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          unit_price: { type: ["string", "null"] },
          line_total: { type: "string" },
          category: { type: "string", enum: CATEGORY_IDS },
        },
      },
    },
  },
} as const;

const modelReceiptSchema = z.object({
  is_receipt: z.boolean(),
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  currency: z.string().nullable(),
  total: z.string().nullable(),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string(),
        unit_price: z.string().nullable(),
        line_total: z.string(),
        category: z.enum(CATEGORY_IDS),
      }),
    )
    .max(300),
});

export type ParsedReceipt = { ok: true; receipt: ReceiptScan } | { ok: false; reason: "not_a_receipt" | "invalid" };

function cleanText(value: string | null, max: number): string | null {
  const text = value?.replace(/\s+/g, " ").trim().slice(0, max);
  return text ? text : null;
}

function validDate(value: string | null): string | null {
  if (!value || !z.iso.date().safeParse(value).success) return null;
  return value;
}

/**
 * Checks the model's JSON and converts it to a ReceiptScan. Amounts are
 * converted exactly; negative lines (discounts) are taken off the line above.
 */
export function parseReceiptJson(text: string, fallbackCurrency: string): ParsedReceipt {
  let data: z.infer<typeof modelReceiptSchema>;
  try {
    const result = modelReceiptSchema.safeParse(JSON.parse(text));
    if (!result.success) return { ok: false, reason: "invalid" };
    data = result.data;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!data.is_receipt) return { ok: false, reason: "not_a_receipt" };

  const printedCurrency = data.currency?.trim().toUpperCase() ?? null;
  const currencyDetected = isCurrency(printedCurrency);
  const currency = currencyDetected ? printedCurrency! : fallbackCurrency;

  const items: ScannedItem[] = [];
  for (const line of data.items) {
    const lineTotal = amountToMinor(line.line_total, currency);
    if (lineTotal === null) continue;

    if (lineTotal < 0) {
      const previous = items.at(-1);
      if (previous) previous.lineTotalMinor = Math.max(0, previous.lineTotalMinor + lineTotal);
      continue;
    }

    items.push({
      name: cleanText(line.name, 120) ?? "Item",
      quantityMilli: quantityToMilli(line.quantity),
      unitPrice: normalizeUnitPrice(line.unit_price),
      lineTotalMinor: lineTotal,
      category: line.category,
    });
  }

  if (items.length === 0) return { ok: false, reason: "not_a_receipt" };

  const total = data.total === null ? null : amountToMinor(data.total, currency);
  const totalMinor = total !== null && total >= 0 ? total : null;
  const itemsTotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);

  return {
    ok: true,
    receipt: {
      merchant: cleanText(data.merchant, 80),
      spentOn: validDate(data.date),
      currency,
      currencyDetected,
      totalMinor,
      itemsTotalMinor,
      totalsMatch: totalMinor !== null && totalMinor === itemsTotalMinor,
      items,
      crop: null,
    },
  };
}
