/** Largest receipt photo the server accepts. Anything bigger is rejected before processing. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/**
 * The browser shrinks photos to this size before upload (longest side, pixels).
 * Large enough that a receipt filling only part of the photo stays readable.
 */
export const RECEIPT_UPLOAD_MAX_SIDE = 3072;

/** JPEG quality used for the shrunken upload. */
export const RECEIPT_UPLOAD_QUALITY = 0.85;

/** Receipt reading is aborted after this long and manual entry is offered. */
export const RECEIPT_TIMEOUT_MS = 30_000;
