/**
 * Development seed script.
 *
 * Creates (or resets) a demo account through the Supabase Admin API and fills
 * it with clearly-labelled demo data: a business profile, three sample
 * customers and three sample invoices covering different statuses, one of them
 * payment-enabled.
 *
 * The password is NEVER hard-coded here. It comes from your local env:
 *
 *   .env.local
 *   TEST_ACCOUNT_EMAIL=demo@example.com
 *   TEST_ACCOUNT_PASSWORD=<something you choose>
 *
 * Usage:  npm run seed
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/* env                                                                         */
/* -------------------------------------------------------------------------- */

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const EMAIL = process.env.TEST_ACCOUNT_EMAIL;
const PASSWORD = process.env.TEST_ACCOUNT_PASSWORD;
const NAME = process.env.TEST_ACCOUNT_NAME || "Demo User";

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    "\n✖ Missing server credentials.\n" +
      "  Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local\n" +
      "  (Supabase Dashboard → Project Settings → API Keys → Secret key).\n",
  );
  process.exit(1);
}

if (!EMAIL || !PASSWORD) {
  console.error(
    "\n✖ Missing test account credentials.\n" +
      "  Add these to .env.local (this file is git-ignored):\n" +
      "    TEST_ACCOUNT_EMAIL=demo@example.com\n" +
      "    TEST_ACCOUNT_PASSWORD=<at least 8 characters>\n",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* -------------------------------------------------------------------------- */
/* pre-flight                                                                  */
/* -------------------------------------------------------------------------- */

const REQUIRED_TABLES = [
  "invoices",
  "invoice_items",
  "customers",
  "business_settings",
  "profiles",
];

/** Fail with an actionable message instead of a raw PGRST205 later on. */
async function assertSchemaReady() {
  const missing = [];
  for (const table of REQUIRED_TABLES) {
    // A plain GET is required: `head: true` makes supabase-js report
    // `error: null` even for a 404 PGRST205 (missing table).
    const { error } = await admin.from(table).select("id").limit(1);
    if (error) {
      if (["PGRST205", "42P01", "PGRST200"].includes(error.code ?? "")) missing.push(table);
      else {
        console.error(
          `\n✖ Could not read the table "${table}" (${error.code}: ${error.message}).\n` +
            "  Check that SUPABASE_SECRET_KEY is the service-role / secret key.\n",
        );
        process.exit(1);
      }
    }
  }

  if (missing.length) {
    console.error(
      "\n✖ The database schema is missing: " + missing.join(", ") + "\n" +
        "\n  Apply the migration first:\n" +
        "    1. Supabase Dashboard → SQL Editor → New query\n" +
        "    2. Paste supabase/migrations/001_initial_schema.sql\n" +
        "       (print it with:  npm run supabase:migrate)\n" +
        "    3. Click Run\n" +
        "    4. Re-run this command:  npm run seed\n",
    );
    process.exit(1);
  }

  // The functions the seed relies on must exist too.
  const { error: fnError } = await admin.rpc("recalculate_invoice_totals", {
    p_invoice_id: "00000000-0000-0000-0000-000000000000",
  });
  if (fnError && ["42883", "PGRST202", "404"].includes(fnError.code ?? "")) {
    console.error(
      "\n✖ The database functions are missing (" + fnError.message + ").\n" +
        "  Re-run supabase/migrations/001_initial_schema.sql — it is safe to run again.\n",
    );
    process.exit(1);
  }
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const money = (n) => Number(Number(n).toFixed(2));

async function rpc(name, args) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

const iso = (d) => {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
};

const addDays = (base, days) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return iso(d);
};

/* -------------------------------------------------------------------------- */
/* account                                                                     */
/* -------------------------------------------------------------------------- */

async function ensureUser() {
  // find existing by listing (admin list is paginated but fine for a dev seed)
  let found = null;
  for (let page = 1; page <= 20 && !found; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    found = data.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase()) ?? null;
    if (!found && data.users.length === 0) break;
  }

  if (found) {
    await admin.auth.admin.updateUserById(found.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAME, business_name: "Northwind Studio" },
    });
    console.log(`• Reusing existing demo user (${found.id})`);
    return found.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: NAME, business_name: "Northwind Studio" },
  });
  if (error) throw new Error(error.message);
  console.log(`• Created demo user (${data.user.id})`);
  return data.user.id;
}

/* -------------------------------------------------------------------------- */
/* demo data                                                                   */
/* -------------------------------------------------------------------------- */

const CUSTOMERS = [
  {
    name: "Acme Technologies",
    company: "Acme Technologies Ltd",
    email: "billing@acme.example",
    phone: "+1 555 0101",
    billing_address: "500 Market Street\nSan Francisco, CA 94105\nUnited States",
    tax_id: "US-88-1234567",
    notes: "Net 14. Prefers PDF invoices.",
  },
  {
    name: "John Smith",
    company: "",
    email: "john.smith@example.com",
    phone: "+44 20 7946 0958",
    billing_address: "221B Baker Street\nLondon NW1 6XE\nUnited Kingdom",
    tax_id: "GB123456789",
    notes: "Individual customer.",
  },
  {
    name: "Global Solutions",
    company: "Global Solutions GmbH",
    email: "accounts@globalsolutions.example",
    phone: "+49 30 901820",
    billing_address: "Torstraße 1\n10119 Berlin\nGermany",
    tax_id: "DE811234567",
    notes: "Requires VAT number on every invoice.",
  },
];

const INVOICES = [
  {
    number: "INV-000001",
    type: "standard",
    customerIndex: 0,
    date: addDays(new Date(), -21),
    dueDate: addDays(new Date(), -7),
    template: "modern",
    status: "paid",
    amountPaidRatio: 1,
    paymentEnabled: false,
    notes: "Thank you for your business. Payment received in full.",
    terms: "Payment is due within 14 days of the invoice date.",
    items: [
      { name: "Website Development", description: "Marketing site, 8 pages, responsive", quantity: 1, unitPrice: 500, tax: 0, discount: 0 },
      { name: "Hosting (annual)", description: "Managed hosting + SSL", quantity: 1, unitPrice: 120, tax: 0, discount: 0 },
    ],
  },
  {
    number: "INV-000002",
    type: "tax",
    customerIndex: 1,
    date: addDays(new Date(), -6),
    dueDate: addDays(new Date(), 8),
    template: "professional",
    status: "draft",
    amountPaidRatio: 0,
    paymentEnabled: true,
    notes: "Your subscription renews automatically each month.",
    terms: "Prices include VAT. Cancel any time before the next renewal.",
    items: [
      { name: "AI Subscription", description: "Pro plan, monthly", quantity: 3, unitPrice: 20, tax: 20, discount: 0 },
    ],
  },
  {
    number: "INV-000003",
    type: "commercial",
    customerIndex: 2,
    date: addDays(new Date(), -40),
    dueDate: addDays(new Date(), -26),
    template: "corporate",
    status: "sent",
    amountPaidRatio: 0,
    paymentEnabled: false,
    notes: "",
    terms: "Payment by bank transfer within 14 days. Late payments accrue 2% interest per month.",
    items: [
      { name: "Consulting", description: "Senior consultant, day rate", quantity: 10, unitPrice: 50, tax: 19, discount: 5 },
    ],
    shipping: 15,
  },
];

/* -------------------------------------------------------------------------- */
/* run                                                                         */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log("\nSeeding demo data (all records are marked as demo data)…\n");

  await assertSchemaReady();

  const userId = await ensureUser();

  // clean previous demo data so re-running is idempotent
  await admin.from("invoice_items").delete().eq("user_id", userId);
  await admin.from("invoices").delete().eq("user_id", userId);
  await admin.from("customers").delete().eq("user_id", userId);

  await admin.from("profiles").upsert({ id: userId, full_name: NAME });

  await admin.from("business_settings").upsert(
    {
      user_id: userId,
      business_name: "Northwind Studio",
      email: EMAIL,
      phone: "+1 555 0142",
      website: "https://example.com",
      address_line1: "18 Harbour Lane",
      city: "Lisbon",
      state: "Lisboa",
      postal_code: "1200-109",
      country: "Portugal",
      tax_id: "PT509876543",
      registration_number: "RC-998877",
      additional_info: "Demo business profile — created by scripts/seed.mjs",
      default_currency: "USD",
      default_template: "modern",
      invoice_prefix: "INV-",
      next_invoice_number: 4,
      number_padding: 6,
      default_payment_terms: "Payment due within 14 days.",
      default_notes: "Thank you for your business.",
      default_terms: "Late payments may incur a 2% monthly fee.",
      default_design: { template: "modern", primaryColor: "#111827" },
      default_payment_enabled: false,
      default_payment_provider: "manual",
    },
    { onConflict: "user_id" },
  );

  const customerIds = [];
  for (const customer of CUSTOMERS) {
    const { data, error } = await admin
      .from("customers")
      .insert({ user_id: userId, ...customer })
      .select("id")
      .single();
    if (error) throw new Error(`customer: ${error.message}`);
    customerIds.push(data.id);
  }
  console.log(`• ${customerIds.length} demo customers`);

  for (const seed of INVOICES) {
    const customer = CUSTOMERS[seed.customerIndex];
    const customerId = customerIds[seed.customerIndex];

    const { data: invoice, error } = await admin
      .from("invoices")
      .insert({
        user_id: userId,
        invoice_number: seed.number,
        invoice_type: seed.type,
        customer_id: customerId,
        customer_name: customer.name,
        customer_company: customer.company || null,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.billing_address,
        invoice_date: seed.date,
        due_date: seed.dueDate,
        currency: "USD",
        currency_symbol: "$",
        payment_terms: "Payment due within 14 days.",
        status: seed.status,
        discount_type: "percent",
        discount_value: 0,
        shipping: money(seed.shipping ?? 0),
        template: seed.template,
        design_settings: { template: seed.template, primaryColor: "#111827" },
        notes: seed.notes,
        terms: seed.terms,
        payment_enabled: seed.paymentEnabled,
        payment_provider: seed.paymentEnabled ? "stripe" : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`invoice ${seed.number}: ${error.message}`);

    await admin.from("invoice_items").insert(
      seed.items.map((item, index) => ({
        invoice_id: invoice.id,
        user_id: userId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_price: money(item.unitPrice),
        discount: item.discount,
        tax: item.tax,
        sort_order: index,
      })),
    );

    // server-side recalculation (the DB trigger is the source of truth)
    await rpc("recalculate_invoice_totals", { p_invoice_id: invoice.id });

    if (seed.amountPaidRatio > 0) {
      const { data: fresh } = await admin
        .from("invoices")
        .select("total")
        .eq("id", invoice.id)
        .single();
      await admin
        .from("invoices")
        .update({ amount_paid: money(fresh.total) })
        .eq("id", invoice.id);
    }

    await rpc("sync_payment_status", { p_invoice_id: invoice.id });
    console.log(`• ${seed.number} — ${customer.name} (${seed.status})`);
  }

  console.log(
    [
      "",
      "✔ Demo data ready.",
      "",
      `  Email:    ${EMAIL}`,
      `  Password: (the TEST_ACCOUNT_PASSWORD you set in .env.local)`,
      "",
      "  Sign in at http://localhost:3000/login",
      "  Run `npm run dev` first if the server is not running yet.",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error("\n✖ Seed failed:", error.message, "\n");
  process.exit(1);
});
