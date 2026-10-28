import { MAX_RECEIPT_BYTES, RECEIPT_UPLOAD_MAX_SIDE, RECEIPT_UPLOAD_QUALITY } from "@/lib/receipt-limits";

/** Photos larger than this are not even opened on the phone. */
const MAX_INPUT_BYTES = 60 * 1024 * 1024;

export class PhotoError extends Error {
  constructor(readonly code: "too_large" | "unsupported_image") {
    super(code);
  }
}

/**
 * Prepares a receipt photo for upload, in memory only: turns it upright,
 * shrinks it and re-encodes it as JPEG. Re-encoding drops all metadata, so
 * location (GPS), camera and time stamps never leave the phone. Nothing is
 * written to storage, and the decoded pixels are released right away.
 */
export async function prepareReceiptPhoto(photo: Blob): Promise<Blob> {
  if (photo.size > MAX_INPUT_BYTES) throw new PhotoError("too_large");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("unsupported_image");
  }

  const canvas = document.createElement("canvas");
  try {
    const scale = Math.min(1, RECEIPT_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoError("unsupported_image");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let quality = RECEIPT_UPLOAD_QUALITY;
    let jpeg = await toJpeg(canvas, quality);
    while (jpeg.size > MAX_RECEIPT_BYTES && quality > 0.5) {
      quality -= 0.15;
      jpeg = await toJpeg(canvas, quality);
    }
    if (jpeg.size > MAX_RECEIPT_BYTES) throw new PhotoError("too_large");
    return jpeg;
  } finally {
    bitmap.close();
    // Frees the pixel buffer now instead of waiting for garbage collection.
    canvas.width = 0;
    canvas.height = 0;
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("unsupported_image"))),
      "image/jpeg",
      quality,
    );
  });
}
