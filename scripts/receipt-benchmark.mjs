/**
 * Measures receipt reading on real photos.
 *
 *   1. Put photos in test/receipts/ (this folder is never committed).
 *   2. List what each receipt really says in test/receipts/expected.json:
 *        { "lidl-cluj.jpg": { "country": "RO", "total": "105.07", "currency": "RON" } }
 *   3. Start the app (npm run build && npm start) and run:
 *        node --env-file=.env.local scripts/receipt-benchmark.mjs
 *
 * Each photo is prepared like the app does (upright, max 3072 px, JPEG 85)
 * and sent to POST /api/receipt/scan as a throwaway user, which is deleted
 * afterwards. Prints a Markdown table and saves it to test/receipts/results.md.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DIR = path.resolve("test/receipts");
const SCAN_GAP_MS = 11_000; // stays under the per-user limit of 6 scans a minute

const ZERO = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
const decimals = (currency) => (ZERO.has(currency) ? 0 : THREE.has(currency) ? 3 : 2);

/** "7 834" or "105,07" -> minor units. */
function toMinor(value, currency) {
  let raw = String(value).trim().replace(/[\s ']/g, "");
  if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(",", ".");
  else raw = raw.replace(/,/g, "");
  const [whole, fraction = ""] = raw.split(".");
  const d = decimals(currency);
  return Number(whole + fraction.slice(0, d).padEnd(d, "0"));
}

const format = (minor, currency) => `${(minor / 10 ** decimals(currency)).toFixed(decimals(currency))} ${currency}`;

const jar = new Map();
async function call(route, body, form = false) {
  const headers = { Origin: BASE, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
  if (!form) headers["Content-Type"] = "application/json";
  const started = Date.now();
  const response = await fetch(BASE + route, { method: "POST", headers, body: form ? body : JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return { status: response.status, ms: Date.now() - started, body: await response.json().catch(() => null) };
}

const expected = JSON.parse(fs.readFileSync(path.join(DIR, "expected.json"), "utf8"));
const photos = Object.keys(expected);
if (photos.length === 0) throw new Error("No receipts listed in test/receipts/expected.json");

const email = `benchmark+${randomBytes(4).toString("hex")}@motionflowstudio.com`;
const signup = await call("/api/auth/signup", { name: "Benchmark", email, password: `Pw-${randomBytes(12).toString("hex")}` });
if (signup.status !== 200) throw new Error(`Sign-up failed: ${signup.status}`);

const rows = [];
try {
  for (const [index, file] of photos.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, SCAN_GAP_MS));
    const want = expected[file];
    const upload = await sharp(path.join(DIR, file))
      .rotate()
      .resize(3072, 3072, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const form = new FormData();
    form.set("image", new Blob([upload], { type: "image/jpeg" }), "receipt.jpg");
    form.set("currency", want.currency);
    const result = await call("/api/receipt/scan", form, true);
    const read = result.body ?? {};
    const wantTotal = toMinor(want.total, want.currency);
    const totalRight = result.status === 200 && read.currency === want.currency && read.totalMinor === wantTotal;
    rows.push({
      file,
      country: want.country ?? "",
      expected: format(wantTotal, want.currency),
      read: result.status === 200 ? format(read.totalMinor ?? read.itemsTotalMinor, read.currency) : read.error ?? String(result.status),
      totalRight,
      linesAddUp: Boolean(read.check?.totalsMatch),
      lines: read.items?.length ?? 0,
      seconds: (result.ms / 1000).toFixed(1),
    });
    console.error(`${totalRight ? "right" : "WRONG"}  ${file}  ${rows.at(-1).read}  (${rows.at(-1).seconds} s)`);
  }
} finally {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  await sql`delete from auth.users where email = ${email}`;
  await sql.end();
}

const right = rows.filter((row) => row.totalRight).length;
const table = [
  `Total read correctly: **${right} of ${rows.length}**. Lines adding up to the total: ${rows.filter((r) => r.linesAddUp).length} of ${rows.length}.`,
  "",
  "| # | Country | Printed total | Read total | Total right | Lines add up | Lines | Time |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (row, i) =>
      `| ${i + 1} | ${row.country} | ${row.expected} | ${row.read} | ${row.totalRight ? "yes" : "no"} | ${row.linesAddUp ? "yes" : "no"} | ${row.lines} | ${row.seconds} s |`,
  ),
].join("\n");
fs.writeFileSync(path.join(DIR, "results.md"), `${table}\n`);
console.log(table);
