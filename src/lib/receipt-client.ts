import type { ReceiptScan, ReceiptScanError } from "@/lib/receipt";
import { RECEIPT_TIMEOUT_MS } from "@/lib/receipt-limits";
import { PhotoError, prepareReceiptPhoto } from "@/lib/receipt-photo";

export type ScanFailure = ReceiptScanError | "offline" | "cancelled";

export type ScanResult = { ok: true; receipt: ReceiptScan } | { ok: false; error: ScanFailure };

/** A little longer than the server's own limit, so its answer arrives first. */
const CLIENT_TIMEOUT_MS = RECEIPT_TIMEOUT_MS + 5_000;

/**
 * Reads a receipt photo. The photo is prepared on the phone (upright, smaller,
 * no location or other metadata), sent once, and not kept anywhere.
 */
export async function scanReceiptPhoto(
  photo: Blob,
  householdCurrency: string,
  cancel?: AbortSignal,
): Promise<ScanResult> {
  let upload: Blob;
  try {
    upload = await prepareReceiptPhoto(photo);
  } catch (error) {
    return { ok: false, error: error instanceof PhotoError ? error.code : "unsupported_image" };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, error: "offline" };

  const form = new FormData();
  form.set("image", upload, "receipt.jpg");
  form.set("currency", householdCurrency);

  try {
    const response = await fetch("/api/receipt/scan", {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: cancel
        ? AbortSignal.any([cancel, AbortSignal.timeout(CLIENT_TIMEOUT_MS)])
        : AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null);
    if (response.ok && body) return { ok: true, receipt: body as ReceiptScan };
    return { ok: false, error: (body?.error as ReceiptScanError) ?? "scan_failed" };
  } catch (error) {
    if (cancel?.aborted) return { ok: false, error: "cancelled" };
    if (error instanceof DOMException && error.name === "TimeoutError") return { ok: false, error: "timeout" };
    return { ok: false, error: "offline" };
  }
}

/** What the app says when a receipt could not be read. */
export const SCAN_ERROR_TEXT: Record<ScanFailure, string> = {
  unauthorized: "Please sign in again to scan receipts.",
  forbidden: "Please sign in again to scan receipts.",
  invalid_input: "That photo could not be sent. Please try again.",
  too_large: "That photo is too large. Try taking it again.",
  unsupported_image: "That file is not a photo we can read. Use a JPEG, PNG or WebP picture.",
  not_a_receipt: "No receipt found in that photo. Make sure the whole receipt is in the picture.",
  rate_limited: "You have scanned a lot of receipts. Please wait a little and try again.",
  busy: "Still reading your last receipt. Please wait a moment.",
  timeout: "Reading took too long. Try again, or enter the amount yourself.",
  scan_failed: "The receipt could not be read. Try again, or enter the amount yourself.",
  unavailable: "Receipt scanning is not available right now. Enter the amount yourself.",
  cancelled: "Scanning was cancelled.",
  offline: "You are offline. Receipt scanning needs a connection; you can still add the amount yourself.",
};
