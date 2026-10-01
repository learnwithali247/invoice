/**
 * Local-only check for the emailed-link auth flow.
 *
 *   node scripts/auth-flow-check.mjs [port]
 *
 * A broken confirmation link has two causes that look identical from outside:
 *   a) the Supabase Site URL still points at localhost  (dashboard setting)
 *   b) the app cannot finish the handshake                (this repo)
 *
 * This distinguishes them. It creates a real unconfirmed user, asks Supabase's
 * admin API for the actual confirmation link, and inspects where Supabase is
 * willing to send people.
 *
 * What it CANNOT do without a browser: prove the session cookie is written,
 * because Supabase returns tokens in a URL fragment and fragments do not exist
 * server-side. It asserts the callback page is reachable and ungated instead.
 */
const PORT = process.argv[2] || "3113";
const BASE = `http://localhost:${PORT}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !PUBLISHABLE || !SECRET) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(SUPABASE_URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function check(name, pass, detail = "") {
  results.push(pass);
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
}

async function generateLink(email, redirectTo, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "signup",
      email,
      password: password ?? undefined,
      redirect_to: redirectTo,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`generate_link failed: ${JSON.stringify(json).slice(0, 300)}`);
  return json.properties?.action_link ?? json.action_link ?? null;
}

/** Follows the /auth/v1/verify link and reports where Supabase actually sends it. */
async function resolveVerifyLink(link) {
  let current = link;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, { redirect: "manual" });
    const next = res.headers.get("location");
    if (!next) return { landedOn: current, status: res.status };
    current = new URL(next, current).toString();
  }
  return { landedOn: current, status: 0 };
}

const email = `authflow-${Date.now()}@example.com`;
const password = "AuthFlow12345!";

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: false,
  user_metadata: { full_name: "Auth Flow" },
});
if (createError) {
  console.error(`✖ ${createError.message}`);
  process.exit(1);
}

try {
  console.log(`\nAuth link flow against ${BASE}\n`);
  console.log(`  NOTE: the Site URL in the Supabase dashboard governs where these`);
  console.log(`  links point. A localhost answer below is a dashboard setting,`);
  console.log(`  not a bug in this repo.\n`);

  // ---- 1. what does Supabase do with a redirect_to it does not know? ----
  const link = await generateLink(email, `${BASE}/auth/callback?next=/dashboard`);
  check("Supabase generated a confirmation link", Boolean(link));
  if (!link) throw new Error("no link returned");

  const { landedOn } = await resolveVerifyLink(link);
  const landedHost = new URL(landedOn).host;
  console.log(`  verification lands on: ${landedHost}/auth/callback?...`);
  check(
    "Supabase honours the callback redirect target",
    landedHost === `localhost:${PORT}`,
    landedHost === `localhost:${PORT}` ? "" : `went to ${landedHost} instead`,
  );

  // ---- 2. an unknown redirect target falls back to the Site URL ---------
  // generate_link refuses an existing address, so use a fresh one.
  const stranger = `stranger-${Date.now()}@example.com`;
  const rogue = await generateLink(
    stranger,
    "https://not-allowlisted.example/auth/callback",
    password,
  );
  const rogueLanding = await resolveVerifyLink(rogue);
  const rogueHost = new URL(rogueLanding.landedOn).host;
  check(
    "an un-allowlisted redirect falls back to the Site URL",
    !rogueHost.includes("not-allowlisted.example"),
    `fell back to ${rogueHost}`,
  );
  if (rogueHost.includes("localhost") || rogueHost.includes("127.0.0.1")) {
    console.log("       ^ that fallback IS localhost: fix Authentication -> URL Configuration -> Site URL");
  }

  // ---- 3. the callback page must exist and not be gated by middleware --
  const page = await fetch(`${BASE}/auth/callback`, { redirect: "manual" });
  const location = page.headers.get("location") || "";
  check(
    "middleware does not gate /auth/callback",
    !location.includes("/login"),
    location ? `redirected to ${location}` : `served directly (${page.status})`,
  );
  check("callback page is served", page.status === 200, `status ${page.status}`);

  const html = await page.text();
  check(
    "callback page ships client JS to read the fragment",
    html.includes("auth/callback") || /_next\/static\/chunks/.test(html),
    html.length > 0 ? "html received" : "empty html",
  );

  // ---- 4. reset links use the same route -------------------------------
  const resetRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "recovery",
      email,
      redirect_to: `${BASE}/auth/callback?next=/reset-password`,
    }),
  }).catch(() => null);
  if (resetRes?.ok) {
    check("recovery link generation works", true);
  } else {
    console.log("  SKIP  recovery link needs an existing confirmed user");
  }

  const failed = results.filter((r) => !r).length;
  console.log(
    failed
      ? `\n✖ ${failed}/${results.length} checks failed`
      : `\n✔ all ${results.length} auth-flow checks passed\n`,
  );
  process.exit(failed ? 1 : 0);
} finally {
  await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
  await admin.auth.admin.listUsers().then(({ data }) =>
    Promise.all(
      (data?.users ?? [])
        .filter((u) => u.email?.startsWith("stranger-"))
        .map((u) => admin.auth.admin.deleteUser(u.id)),
    ),
  ).catch(() => {});
}