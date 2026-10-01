/**
 * Copies the migration SQL to your clipboard and opens the SQL editor, so you
 * can paste it with Ctrl+V and press Run. No tokens or accounts needed.
 *
 *   npm run sql:copy
 *
 * Works on Windows (clip.exe), macOS (pbcopy) and Linux (xclip / wl-copy).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync, execSync } from "node:child_process";

const MIGRATION = resolve(process.cwd(), "supabase/migrations/001_initial_schema.sql");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

if (!existsSync(MIGRATION)) {
  console.error(`\n✖ Migration file not found: ${MIGRATION}\n`);
  process.exit(1);
}

const sql = readFileSync(MIGRATION, "utf8");
const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .replace(/^https?:\/\//, "")
  .split(".")[0];
const editorUrl = projectRef
  ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
  : "https://supabase.com/dashboard";

/* -------------------------------------------------------------------------- */

function copyToClipboard(text) {
  const candidates =
    process.platform === "win32"
      ? [["clip"], ["powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"]]
      : process.platform === "darwin"
        ? [["pbcopy"]]
        : [["wl-copy"], ["xclip", "-selection", "clipboard"]];

  for (const cmd of candidates) {
    const result = spawnSync(cmd[0], cmd.slice(1), {
      input: text,
      encoding: "utf8",
      shell: false,
    });
    if (result.status === 0) return cmd[0];
  }
  return null;
}

const statements = (sql.match(/;\s*\n/g) ?? []).length;
const lines = sql.split(/\r?\n/).length;

console.log(`\nMigration: supabase/migrations/001_initial_schema.sql`);
console.log(`  ${lines} lines, ~${statements} statements\n`);

const tool = copyToClipboard(sql);

if (tool) {
  console.log(`✔ SQL copied to the clipboard (via ${tool}).\n`);
  console.log("Now:");
  console.log(`  1. Open the SQL editor:  ${editorUrl}`);
  console.log("  2. Click in the editor, press Ctrl+V");
  console.log("  3. Click Run");
  console.log("  4. Reload the app — the setup screen disappears\n");
  console.log("  If the editor shows an error, copy that message and send it to me.\n");

  // Best effort: open the editor too.
  try {
    const opener =
      process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", editorUrl] : [editorUrl];
    execSync(`${opener} ${args.map((a) => `"${a}"`).join(" ")}`, { stdio: "ignore" });
    console.log(`(opened ${editorUrl} in your browser)\n`);
  } catch {
    /* opening a browser is a nicety, not a requirement */
  }
} else {
  console.log("Could not reach a clipboard tool. Do it manually:\n");
  console.log(`  1. Open this file:  ${MIGRATION}`);
  console.log("  2. Select all (Ctrl+A) and copy (Ctrl+C)");
  console.log(`  3. Paste it into:  ${editorUrl}`);
  console.log("  4. Click Run\n");
}
