/**
 * Spins up a throwaway Postgres 16 container, applies a shim that recreates the
 * few Supabase-managed schemas the migration needs (auth, storage, and the
 * anon/authenticated/service_role roles), runs
 * `supabase/migrations/001_initial_schema.sql` twice (to prove it is
 * idempotent) and then executes `scripts/test-db.sql`.
 *
 *   npm run test:db
 *
 * Requires Docker. The container is always removed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CONTAINER = "invoice-gen-dbtest";
const PORT = process.env.TEST_DB_PORT || "55432";
const IMAGE = "postgres:16-alpine";

const root = resolve(process.cwd());
const tmp = mkdtempSync(join(tmpdir(), "invoice-dbtest-"));
const shim = resolve(root, "scripts/test-shim.sql");
const migration = resolve(root, "supabase/migrations/001_initial_schema.sql");
const tests = resolve(root, "scripts/test-db.sql");

for (const file of [shim, migration, tests]) {
  if (!existsSync(file)) {
    console.error(`✖ Missing required file: ${file}`);
    process.exit(1);
  }
}

function docker(args, { quiet = false } = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (result.status !== 0) {
    if (!quiet) console.error(result.stderr || result.stdout);
    return { ok: false, output: `${result.stderr || ""}${result.stdout || ""}` };
  }
  return { ok: true, output: result.stdout || "" };
}

function psql(file, { onContainer = true } = {}) {
  const args = ["exec", CONTAINER, "psql", "-U", "postgres", "-d", "invoice_test", "-q", "-v", "ON_ERROR_STOP=1"];
  if (onContainer) args.push("-f", file);
  return docker(args);
}

function cleanup() {
  docker(["rm", "-f", CONTAINER], { quiet: true });
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

console.log(`\nStarting a temporary Postgres (${IMAGE})…`);
docker(["rm", "-f", CONTAINER], { quiet: true });

const started = docker([
  "run", "-d",
  "--name", CONTAINER,
  "-e", "POSTGRES_PASSWORD=postgres",
  "-e", "POSTGRES_DB=invoice_test",
  "-p", `${PORT}:5432`,
  IMAGE,
]);
if (!started.ok) {
  console.error("✖ Could not start the container. Is Docker running?");
  process.exit(1);
}

// wait for readiness
const sleep = (ms) => {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
};

let ready = false;
for (let i = 0; i < 60; i++) {
  const probe = docker(["exec", CONTAINER, "pg_isready", "-U", "postgres"], { quiet: true });
  if (probe.ok) {
    ready = true;
    break;
  }
  sleep(1500);
}
if (!ready) {
  console.error("✖ Postgres did not become ready in time.");
  process.exit(1);
}

console.log("Copying shim, migration and tests into the container…");
for (const [local, remote] of [
  [shim, "/tmp/shim.sql"],
  [migration, "/tmp/migration.sql"],
  [tests, "/tmp/test-db.sql"],
]) {
  const copy = spawnSync("docker", ["cp", local, `${CONTAINER}:${remote}`], { encoding: "utf8" });
  if (copy.status !== 0) {
    console.error(`✖ docker cp failed for ${local}: ${copy.stderr}`);
    process.exit(1);
  }
}

console.log("Applying the shim…");
if (!psql("/tmp/shim.sql").ok) process.exit(1);

console.log("Running the migration…");
if (!psql("/tmp/migration.sql").ok) process.exit(1);

console.log("Running the migration a second time (idempotency)…");
if (!psql("/tmp/migration.sql").ok) process.exit(1);

console.log("\nRunning the database test suite…\n");
const result = docker([
  "exec", CONTAINER,
  "psql", "-U", "postgres", "-d", "invoice_test", "-q", "-f", "/tmp/test-db.sql",
]);
process.stdout.write(result.output);

cleanup();
process.exit(result.ok ? 0 : 1);
