// Checks that no secret and no receipt photo is anywhere in the repository,
// including its full git history, or in the build output sent to browsers.
// It prints only names and counts, never a secret value.
//
//   node scripts/check-leaks.mjs            full check (history, build, files)
//   node scripts/check-leaks.mjs --staged   only what is about to be committed
//
// Secret values are read from the local env files (never committed). Exits
// with status 1 when anything is found.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const staged = process.argv.includes("--staged");

/** The only images allowed in the repository: app artwork and self-made test receipts. */
const ALLOWED_IMAGES = [
  /^public\/icons\/[\w-]+\.png$/,
  /^public\/splash\/\d+x\d+\.png$/,
  /^public\/screenshots\/[\w-]+\.jpg$/,
  /^public\/landing\/[\w-]+\.webp$/,
  /^src\/app\/(apple-icon\.png|icon\.svg)$/,
  /^test\/fixtures\/receipt-[\w-]+\.jpg$/,
];
const IMAGE = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?|svg|pdf)$/i;

/** Shapes of secrets that must never appear, whoever's they are. */
const SECRET_SHAPES = [
  ["Supabase secret key", /sb_secret_[\w-]{10,}/],
  ["JSON web token", /eyJ[\w-]{20,}\.[\w-]{20,}\.[\w-]{10,}/],
  ["database URL with password", /postgres(?:ql)?:\/\/[^:@/\s]+:[^@\s]+@/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY/],
  ["bearer token", /Bearer [\w.-]{24,}/],
];

function envValues() {
  const values = [];
  for (const file of [".env.local", ".env", "signing.env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (!match || match[2].length < 12) continue;
      values.push([`${file} ${match[1]}`, match[2]]);
      const password = match[2].match(/^postgres(?:ql)?:\/\/[^:]+:([^@]+)@/)?.[1];
      if (password && password.length >= 8) values.push([`${file} ${match[1]} password`, decodeURIComponent(password)]);
    }
  }
  return values;
}

const git = (...args) => execFileSync("git", args, { maxBuffer: 1 << 30 });
const secrets = envValues();
const problems = new Set();

function scanText(where, text) {
  for (const [name, value] of secrets) if (text.includes(value)) problems.add(`secret value (${name}) in ${where}`);
  for (const [name, shape] of SECRET_SHAPES) if (shape.test(text)) problems.add(`${name} in ${where}`);
}

function checkPath(path, where) {
  if (IMAGE.test(path) && !ALLOWED_IMAGES.some((allowed) => allowed.test(path))) problems.add(`image ${path} in ${where}`);
  if (/(^|\/)(\.env(\..*)?|signing\.env|.*\.pem|.*\.key)$/.test(path) && !path.endsWith(".env.example")) {
    problems.add(`secret file ${path} in ${where}`);
  }
}

if (staged) {
  const files = git("diff", "--cached", "--name-only", "--diff-filter=ACMR").toString().split("\n").filter(Boolean);
  for (const file of files) {
    checkPath(file, "the commit");
    scanText(file, git("show", `:${file}`).toString("latin1"));
  }
  scanText("the commit message", existsSync(".git/COMMIT_EDITMSG") ? readFileSync(".git/COMMIT_EDITMSG", "utf8") : "");
} else {
  // Every file name and every version of every file, on every branch.
  for (const path of git("log", "--all", "--pretty=format:", "--name-only").toString().split("\n").filter(Boolean)) {
    checkPath(path, "git history");
  }
  const objects = git("rev-list", "--all", "--objects").toString().trim().split("\n");
  const batch = execFileSync("git", ["cat-file", "--batch"], {
    input: objects.map((line) => line.split(" ")[0]).join("\n"),
    maxBuffer: 1 << 30,
  }).toString("latin1");
  scanText("git history", batch);
  scanText("commit messages", git("log", "--all", "--format=%B").toString());
  console.log(`Checked ${objects.length} objects in the git history.`);

  // What the build sends to browsers and keeps on the server.
  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  for (const dir of [".next/static", ".next/server", "public"]) {
    if (!existsSync(dir)) continue;
    const files = walk(dir);
    for (const file of files) scanText(file, readFileSync(file).toString("latin1"));
    console.log(`Checked ${files.length} files in ${dir}.`);
  }
}

console.log(`Compared against ${secrets.length} local secret values.`);
if (problems.size > 0) {
  console.error(`Found ${problems.size} problem(s):\n${[...problems].map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("No secrets and no receipt photos found.");
