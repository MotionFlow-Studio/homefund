import { isCurrency } from "@/lib/money";
import { MAX_RECEIPT_BYTES, RECEIPT_TIMEOUT_MS } from "@/lib/receipt-limits";
import { env } from "@/server/env";
import { errorResponse, isSameOrigin, json } from "@/server/http";
import { MetaApiError } from "@/server/meta-api";
import { createRateLimiter } from "@/server/rate-limit";
import { scanReceipt, ScanError } from "@/server/receipt-scan";
import { getSessionUser } from "@/server/supabase";

/** Room for the multipart envelope around the photo. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Per user: a few receipts a minute, plenty for a family's day. */
const perMinute = createRateLimiter({ limit: 6, windowMs: MINUTE });
const perDay = createRateLimiter({ limit: 60, windowMs: DAY });
/** For the whole server, so the API budget cannot be drained. */
const serverPerDay = createRateLimiter({ limit: 1_000, windowMs: DAY });

/** Users with a scan in progress: one at a time each. */
const scanning = new Set<string>();

/**
 * Reads a receipt photo. Takes multipart form data with `image` (JPEG, PNG
 * or WebP, at most 10 MB) and `currency` (the household currency, used when
 * the receipt shows none). The Meta API key never leaves the server and the
 * photo is not stored.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");

  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");

  if (!env.metaApiKey) return errorResponse(503, "unavailable");

  const length = Number(request.headers.get("content-length"));
  if (!length) return errorResponse(411, "invalid_input");
  if (length > MAX_RECEIPT_BYTES + FORM_OVERHEAD_BYTES) return errorResponse(413, "too_large");

  if (scanning.has(user.id)) return errorResponse(429, "busy");
  const wait = Math.max(perMinute.retryAfter(user.id), perDay.retryAfter(user.id), serverPerDay.retryAfter("all"));
  if (wait > 0) return rateLimited(wait);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_input");
  }
  const image = form.get("image");
  const currency = form.get("currency");
  if (!(image instanceof File) || !isCurrency(currency)) return errorResponse(400, "invalid_input");
  if (image.size === 0) return errorResponse(400, "invalid_input");
  if (image.size > MAX_RECEIPT_BYTES) return errorResponse(413, "too_large");

  perMinute.hit(user.id);
  perDay.hit(user.id);
  serverPerDay.hit("all");
  scanning.add(user.id);

  const timeout = AbortSignal.timeout(RECEIPT_TIMEOUT_MS);
  const signal = AbortSignal.any([timeout, request.signal]);
  try {
    const bytes = new Uint8Array(await image.arrayBuffer());
    return json(await scanReceipt(bytes, currency, signal));
  } catch (error) {
    if (error instanceof ScanError) {
      const status = { unsupported_image: 415, not_a_receipt: 422, scan_failed: 502 }[error.code];
      return errorResponse(status, error.code);
    }
    if (timeout.aborted) return errorResponse(504, "timeout");
    if (error instanceof MetaApiError && error.status === 429) return errorResponse(503, "busy");
    // Never log the photo or what was read from it.
    console.error("Receipt scan failed:", error instanceof MetaApiError ? error.status : (error as Error)?.name);
    return errorResponse(502, "scan_failed");
  } finally {
    scanning.delete(user.id);
  }
}

function rateLimited(retryAfterSeconds: number) {
  const response = errorResponse(429, "rate_limited");
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}
