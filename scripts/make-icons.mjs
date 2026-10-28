// Draws the app icon and launch screens and writes every size the platforms need.
// Run after changing the artwork: node scripts/make-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const TEAL_LIGHT = "#14b8a6";
const TEAL = "#0f766e";
const TEAL_DARK = "#115e59";
const GOLD = "#fbbf24";
const GOLD_DARK = "#d97706";

const background = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL_LIGHT}"/>
      <stop offset="0.45" stop-color="${TEAL}"/>
      <stop offset="1" stop-color="${TEAL_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.15" r="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

/** The house with a coin inside, drawn on a 512 grid around its centre. */
function mark(scale = 1) {
  return `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 118 112 236h36v156h216V236h36z" fill="#ffffff" stroke="#ffffff" stroke-width="28" stroke-linejoin="round"/>
    <circle cx="256" cy="306" r="62" fill="${GOLD}"/>
    <circle cx="256" cy="306" r="42" fill="none" stroke="${GOLD_DARK}" stroke-opacity="0.5" stroke-width="9"/>
    <path d="M222 286a42 42 0 0 1 34-22" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="9" stroke-linecap="round"/>
  </g>`;
}

/** Square artwork. `rounded` adds the corner radius (for browsers); platforms that mask icons get it full-bleed. */
function icon({ rounded = false, scale = 1 } = {}) {
  const radius = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${background}
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <rect width="512" height="512" rx="${radius}" fill="url(#glow)"/>${mark(scale)}
</svg>
`;
}

/** iOS launch screen: the mark and the name on the brand gradient. */
function splash(width, height) {
  const size = Math.round(Math.min(width, height) * 0.42);
  const x = (width - size) / 2;
  const y = height * 0.42 - size / 2;
  const fontSize = Math.round(size * 0.24);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background}
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 512 512">${mark()}</svg>
  <text x="${width / 2}" y="${y + size + fontSize * 1.5}" text-anchor="middle" fill="#ffffff"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="${fontSize * -0.01}">HomeFund</text>
</svg>`;
}

/** Portrait launch screens for current iPhones and iPads: CSS size and pixel ratio. */
const SPLASH_SCREENS = JSON.parse(readFileSync("src/lib/splash-screens.json", "utf8"));

const png = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);

mkdirSync("public/icons", { recursive: true });
mkdirSync("public/splash", { recursive: true });

writeFileSync("src/app/icon.svg", icon({ rounded: true }));
await png(icon({ rounded: true }), 192, "public/icons/icon-192.png");
await png(icon({ rounded: true }), 512, "public/icons/icon-512.png");
// Android crops maskable icons to a circle or squircle; the mark stays inside the safe zone.
await png(icon({ scale: 0.72 }), 512, "public/icons/icon-maskable-512.png");
await png(icon({ scale: 0.72 }), 192, "public/icons/icon-maskable-192.png");
// iOS rounds the corners itself.
await png(icon({ scale: 0.86 }), 180, "src/app/apple-icon.png");

for (const [w, h, ratio] of SPLASH_SCREENS) {
  const width = w * ratio;
  const height = h * ratio;
  await sharp(Buffer.from(splash(width, height))).png({ compressionLevel: 9 }).toFile(`public/splash/${width}x${height}.png`);
}
console.log(`Wrote icons and ${SPLASH_SCREENS.length} launch screens.`);
