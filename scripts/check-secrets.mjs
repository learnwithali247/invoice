/**
 * Pre-deploy guard: fails if a real secret ever ends up in the build output or
 * in a file that would be committed.
 *
 *   npm run check:secrets
 *
 * Run this before every deploy. It reads the local .env.local purely to learn
 * what the secret values ARE — nothing is printed except the variable *names*.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const BUILD = join(ROOT, ".next");

/** Variable names whose values must never be committed or bundled. */
const SENSITIVE = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "STRIPE_TEST_SECRET_KEY",
  "STRIPE_LIVE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PAYPAL_TEST_CLIENT_SECRET",
  "PAYPAL_LIVE_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "RESEND_API_KEY",
  "TEST_ACCOUNT_PASSWORD",
];

const SCANNED_EXT = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css", ".html", ".md", ".sql", ".yml", ".yaml",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", "out", "build", ".turbo", "coverage",
]);

/** Files that are *supposed* to mention these names (docs, examples, code). */
const ALLOWED_MENTIONS = new Set([".env.example", "README.md", "DEPLOY.md", "readme.txt"]);

function readEnvValues() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return new Map();
  const values = new Map();
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Only long, high-entropy values can be searched for reliably.
    if (value.length >= 16) values.set(key, value);
  }
  return values;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full);
    else if (SCANNED_EXT.has(extname(entry))) yield full;
  }
}

const secrets = readEnvValues();
const tracked = [...secrets.keys()].filter((k) => SENSITIVE.includes(k));

console.log("\nSecret scan");
console.log(`  checking ${tracked.length} sensitive variable(s) from .env.local\n`);

let problems = 0;

/* ---------------------------------------------------------------- 1. build */
if (existsSync(BUILD)) {
  let buildHits = 0;
  for (const file of walk(BUILD)) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const [name, value] of secrets) {
      if (!SENSITIVE.includes(name)) continue;
      if (text.includes(value)) {
        console.log(`  LEAK  ${relative(ROOT, file)} contains the value of ${name}`);
        buildHits += 1;
      }
    }
  }
  if (buildHits) {
    problems += buildHits;
  } else {
    console.log("  PASS  no secret value appears anywhere in .next");
  }
} else {
  console.log("  SKIP  no .next directory (run `npm run build` first)");
}

/* ------------------------------------------------------------ 2. sources */
let sourceHits = 0;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (rel.startsWith(".next") || rel.startsWith("node_modules")) continue;
  if (ALLOWED_MENTIONS.has(rel)) continue;
  if (rel === ".env.local" || rel === ".env") continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [name, value] of secrets) {
    if (!SENSITIVE.includes(name)) continue;
    if (text.includes(value)) {
      console.log(`  LEAK  ${rel} contains the value of ${name}`);
      sourceHits += 1;
    }
  }
}
if (sourceHits) problems += sourceHits;
else console.log("  PASS  no secret value appears in any source file");

/* --------------------------------------------------------- 3. client side */
if (existsSync(join(BUILD, "static"))) {
  const clientDir = join(BUILD, "static");
  let clientHits = 0;
  for (const file of walk(clientDir)) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const [name, value] of secrets) {
      if (!SENSITIVE.includes(name)) continue;
      if (text.includes(value)) {
        console.log(`  LEAK  ${relative(ROOT, file)} (client bundle) contains ${name}`);
        clientHits += 1;
      }
    }
  }
  if (clientHits) problems += clientHits;
  else console.log("  PASS  no secret value appears in the client bundle");
}

/* --------------------------------------------------------- 4. gitignore */
const gitignore = existsSync(join(ROOT, ".gitignore"))
  ? readFileSync(join(ROOT, ".gitignore"), "utf8")
  : "";
const covered = [".env", ".env.local", ".vercel"].every((p) => gitignore.includes(p));
console.log(
  covered
    ? "  PASS  .gitignore covers .env, .env.local and .vercel"
    : "  FAIL  .gitignore is missing an entry for a sensitive file",
);
if (!covered) problems += 1;

console.log(
  problems === 0
    ? "\n✔ Nothing to block a deploy.\n"
    : `\n✖ ${problems} problem(s) found — do not deploy.\n`,
);
process.exit(problems === 0 ? 0 : 1);
