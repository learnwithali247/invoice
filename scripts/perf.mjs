/**
 * Local-only performance probe. Times the server-side work a signed-in user
 * triggers, so the numbers are measured rather than guessed.
 *
 *   node scripts/perf.mjs [port]
 *
 * Creates a throwaway account, signs in, replays the real request sequence and
 * deletes the account again.
 */
const PORT = process.argv[2] || "3112";
const BASE = `http://localhost:${PORT}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !PUBLISHABLE || !SECRET) {
  console.error("Missing Supabase env. Run via: npm run perf");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(SUPABASE_URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = `perf-${Date.now()}@example.com`;
const PASSWORD = "PerfProbe12345!";

/** DB row -> the shape the API expects for an item. */
const toItem = (row) => ({
  id: row.id,
  name: row.name ?? "",
  description: row.description ?? "",
  quantity: String(row.quantity ?? 1),
  unitPrice: String(row.unit_price ?? 0),
  discount: String(row.discount ?? 0),
  tax: String(row.tax ?? 0),
});

async function time(label, fn, runs = 3) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(
    `  ${label.padEnd(34)} median ${median.toFixed(0).padStart(5)} ms   (${samples
      .map((s) => s.toFixed(0))
      .join(", ")})`,
  );
  return median;
}

async function main() {
  console.log(`\nPerformance probe against ${BASE}\n`);

  console.log("→ creating a throwaway account…");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Perf Probe", business_name: "Perf Probe Ltd" },
  });
  if (createError) {
    console.error(`✖ ${createError.message}`);
    process.exit(1);
  }
  const userId = created.user.id;

  try {
    // sign in to obtain a real session cookie
    const anon = createClient(SUPABASE_URL, PUBLISHABLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    if (signInError) throw new Error(signInError.message);

    const accessToken = session.session.access_token;
    // Supabase SSR reads the session from this cookie; encode the same shape.
    const cookieValue = `base64-${Buffer.from(
      JSON.stringify(session.session),
      "utf8",
    ).toString("base64url")}`;
    const cookieName = `sb-${SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0]}-auth-token`;
    const cookie = `${cookieName}=${cookieValue}`;

    const get = (path) => async () => {
      const res = await fetch(`${BASE}${path}`, {
        headers: { cookie, "user-agent": "perf-probe" },
        redirect: "manual",
      });
      if (res.status >= 500) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} on ${path}: ${text.slice(0, 200)}`);
      }
      await res.arrayBuffer();
    };

    console.log(`\n=== HTTP round trips (full page, server included) ===\n`);
    await get("/dashboard")(); // warm
    await time("GET /dashboard", get("/dashboard"));
    await time("GET /invoices/new", get("/invoices/new"));
    await time("GET /customers", get("/customers"));
    await time("GET /settings", get("/settings"));
    await time("GET /login (no session needed)", () =>
      fetch(`${BASE}/login`).then((r) => r.arrayBuffer()),
    );

    console.log(`\n=== server-side query cost ===\n`);

    const supabase = anon; // RLS-scoped, same as the app
    const userClient = createClient(SUPABASE_URL, accessToken, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { cookie } },
    });
    void supabase;

    await time("auth.getUser() (1 round trip)", () => userClient.auth.getUser());
    await time("invoices page query", () =>
      userClient.from("invoices").select("id,invoice_number,total").eq("user_id", userId).limit(10),
    );
    await time("two queries in parallel", async () => {
      await Promise.all([
        userClient.from("invoices").select("id").eq("user_id", userId).limit(10),
        userClient.from("customers").select("id").eq("user_id", userId).limit(10),
      ]);
    });
    await time("two queries SEQUENTIAL (bad)", async () => {
      await userClient.from("invoices").select("id").eq("user_id", userId).limit(10);
      await userClient.from("customers").select("id").eq("user_id", userId).limit(10);
    });

    console.log(`\n=== API routes ===\n`);

    const save = (body) =>
      fetch(`${BASE}/api/invoices`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, json: await r.json() }));

    const base = {
      invoiceNumber: "",
      invoiceType: "standard",
      status: "draft",
      customer: { name: "Probe Customer" },
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      discountType: "percent",
      discountValue: "0",
      shipping: "0",
      fees: "0",
      adjustment: "0",
      amountPaid: "0",
      template: "modern",
      design: {},
      notes: "",
      terms: "",
      footerText: "",
      paymentInstructions: "",
      paymentEnabled: false,
      paymentProvider: "manual",
    };

    const item = (name, price = "50") => ({
      id: crypto.randomUUID(),
      name,
      description: "",
      quantity: "2",
      unitPrice: price,
      discount: "0",
      tax: "20",
    });

    let failures = 0;
    const expect = (label, got, want) => {
      const ok = String(got) === String(want);
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${String(got)}${ok ? "" : ` (expected ${want})`}`,
      );
    };

    console.log("  ── autosave correctness ──");

    // 1. first save — creates the invoice and its first item
    const first = await save({ ...base, items: [item("Alpha")] });
    expect("first save status", first.status, 200);
    const invoiceId = first.json?.data?.invoice?.id;
    expect("first save returns the invoice id", Boolean(invoiceId), true);
    expect("first save returns 1 item", first.json?.data?.items?.length, 1);

    const itemId = first.json?.data?.items?.[0]?.id;
    expect("item has a uuid id", /^[0-9a-f-]{36}$/.test(itemId ?? ""), true);

    const readItems = async () => {
      const res = await fetch(`${BASE}/api/invoices/${invoiceId}`, { headers: { cookie } });
      const json = await res.json();
      return json?.data?.items ?? [];
    };

    expect("database stored 1 item", (await readItems()).length, 1);

    // 2. autosave that ADDS an item — the case that silently duplicated rows
    const added = await save({
      ...base,
      id: invoiceId,
      invoiceNumber: first.json.data.invoice.invoice_number,
      items: [item("Alpha"), item("Beta")],
    });
    expect("add-item autosave status", added.status, 200);
    expect("add-item autosave is minimal", added.json?.data?.minimal, true);
    expect("database now has 2 items", (await readItems()).length, 2);

    // 3. autosave that REORDERS — ids must be respected, not re-inserted
    const current = await readItems();
    const reordered = await save({
      ...base,
      id: invoiceId,
      invoiceNumber: first.json.data.invoice.invoice_number,
      items: [
        { ...toItem(current[1]), name: "Beta" },
        { ...toItem(current[0]), name: "Alpha" },
      ],
    });
    expect("reorder autosave status", reordered.status, 200);
    expect("reorder did not duplicate rows", (await readItems()).length, 2);

    // 4. autosave that REMOVES an item
    const afterReorder = await readItems();
    const removed = await save({
      ...base,
      id: invoiceId,
      invoiceNumber: first.json.data.invoice.invoice_number,
      items: [toItem(afterReorder[0])],
    });
    expect("remove-item autosave status", removed.status, 200);
    expect("database now has 1 item", (await readItems()).length, 1);

    // 5. every item gone
    const emptied = await save({
      ...base,
      id: invoiceId,
      invoiceNumber: first.json.data.invoice.invoice_number,
      items: [],
    });
    expect("empty-items autosave status", emptied.status, 200);
    expect("database has 0 items", (await readItems()).length, 0);

    // 6. server-side totals are the authority
    await save({
      ...base,
      id: invoiceId,
      invoiceNumber: first.json.data.invoice.invoice_number,
      items: [item("Gamma", "100")],
    });
    const inv = await admin
      .from("invoices")
      .select("subtotal,tax_total,total,amount_due")
      .eq("id", invoiceId)
      .single();
    expect("subtotal 2 x 100", Number(inv.data.subtotal), 200);
    expect("tax 20% of 200", Number(inv.data.tax_total), 40);
    expect("total recalculated in Postgres", Number(inv.data.total), 240);
    expect("amount due", Number(inv.data.amount_due), 240);

    // 7. a hostile / malformed item id must not produce a null primary key
    const hostile = await save({
      ...base,
      id: invoiceId,
      invoiceNumber: first.json.data.invoice.invoice_number,
      items: [{ id: "not-a-uuid", name: "Hostile", description: "", quantity: "1", unitPrice: "10", discount: "0", tax: "0" }],
    });
    expect("malformed item id is accepted", hostile.status, 200);
    expect("hostile id was reassigned", Boolean(hostile.json?.data?.reassigned?.length), true);
    expect("database still has 1 item", (await readItems()).length, 1);

    if (failures) {
      console.log(`\n✖ ${failures} correctness check(s) failed.\n`);
    } else {
      console.log(`\n✔ all autosave correctness checks passed\n`);
    }

    await time(
      "POST /api/invoices (autosave, warm)",
      () =>
        save({
          ...base,
          id: invoiceId,
          invoiceNumber: first.json.data.invoice.invoice_number,
          items: [item("Warm")],
        }),
      3,
    );

    console.log(`\nDone.\n`);
  } finally {
    console.log("→ cleaning up the throwaway account…");
    await admin.auth.admin.deleteUser(userId);
  }
}

main().catch((error) => {
  console.error(`\n✖ ${error?.message ?? error}\n`);
  process.exit(1);
});
