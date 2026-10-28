import { describe, expect, it } from "vitest";
import { assessGray } from "./photo-quality";

function image(width: number, height: number, pixel: (x: number, y: number) => number) {
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) gray[y * width + x] = pixel(x, y);
  return gray;
}

describe("photo quality", () => {
  it("finds sharp print even when it fills only a corner", () => {
    // Plain table, with crisp black-on-white "text" in one corner.
    const gray = image(300, 400, (x, y) => (x < 90 && y < 120 ? ((x >> 1) + (y >> 2)) % 3 === 0 ? 20 : 240 : 128));
    const quality = assessGray(gray, 300, 400);
    expect(quality.blurry).toBe(false);
    expect(quality.dark).toBe(false);
  });

  it("flags a photo with no sharp detail", () => {
    const gray = image(300, 400, (x, y) => 100 + Math.round(40 * Math.sin(x / 40) * Math.cos(y / 50)));
    expect(assessGray(gray, 300, 400)).toMatchObject({ blurry: true, dark: false });
  });

  it("flags a dark photo", () => {
    const gray = image(300, 400, (x, y) => ((x + y) % 4 === 0 ? 30 : 10));
    expect(assessGray(gray, 300, 400).dark).toBe(true);
  });
});
