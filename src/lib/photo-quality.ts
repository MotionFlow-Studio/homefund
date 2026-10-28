/*
 * Quick checks on a receipt photo before it is sent, so a blurry or dark
 * shot can be retaken straight away instead of failing after upload.
 */

/** Side of the small copy the checks run on, in pixels. */
export const QUALITY_SAMPLE_SIDE = 512;

/**
 * Below this, the sharpest part of the photo is likely too soft to read small
 * print. Calibrated on blurred test receipts read by the model: below it,
 * small receipts came back with wrong or invented lines. Slightly blurred
 * photos above it are caught by the totals check instead.
 */
export const BLUR_THRESHOLD = 300;

/** Average brightness (0-255) below which the photo is too dark. */
export const DARK_THRESHOLD = 45;

export type PhotoQuality = { blurry: boolean; dark: boolean; sharpness: number; brightness: number };

/**
 * Judges a grayscale image (one byte per pixel). Sharpness is the variance of
 * the Laplacian, measured per tile; the sharpest tiles count, because a
 * receipt may fill only part of the photo while the table around it is plain.
 */
export function assessGray(gray: Uint8ClampedArray | Uint8Array, width: number, height: number): PhotoQuality {
  const tiles = 6;
  const tileW = Math.floor(width / tiles);
  const tileH = Math.floor(height / tiles);
  const variances: number[] = [];
  let brightnessSum = 0;
  for (let i = 0; i < gray.length; i++) brightnessSum += gray[i];

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      const x0 = Math.max(1, tx * tileW);
      const y0 = Math.max(1, ty * tileH);
      const x1 = Math.min(width - 1, (tx + 1) * tileW);
      const y1 = Math.min(height - 1, (ty + 1) * tileH);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * width + x;
          const laplacian = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
          sum += laplacian;
          sumSq += laplacian * laplacian;
          count++;
        }
      }
      if (count > 0) variances.push(sumSq / count - (sum / count) ** 2);
    }
  }

  variances.sort((a, b) => b - a);
  // The average of the sharpest tenth of tiles.
  const top = variances.slice(0, Math.max(1, Math.round(variances.length / 10)));
  const sharpness = top.reduce((a, b) => a + b, 0) / top.length;
  const brightness = brightnessSum / gray.length;

  return {
    blurry: sharpness < BLUR_THRESHOLD,
    dark: brightness < DARK_THRESHOLD,
    sharpness: Math.round(sharpness),
    brightness: Math.round(brightness),
  };
}

/** Runs the checks on a photo in the browser. Returns null if it cannot be decoded. */
export async function assessPhoto(photo: Blob): Promise<PhotoQuality | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const scale = Math.min(1, QUALITY_SAMPLE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(8, Math.round(bitmap.width * scale));
  const height = Math.max(8, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
    }
    return assessGray(gray, width, height);
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
