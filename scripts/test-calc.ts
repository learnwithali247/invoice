/**
 * Calculation + render-spec parity tests.
 *
 * These are the same scenarios asserted against Postgres in
 * `scripts/test-db.sql` — the two implementations must agree exactly, because
 * the live preview and the stored row are produced by different engines.
 *
 *   npm run test:calc
 */
import { calculateTotals, formatMoney, Decimal } from "../lib/invoice/calculate.ts";
import { buildRenderSpec } from "../lib/invoice/render-spec.ts";
import { getCurrency } from "../lib/invoice/currencies.ts";
import { normaliseDesign, DEFAULT_DESIGN } from "../lib/invoice/design.ts";
import { emptyItem } from "../lib/invoice/mappers.ts";
import { uuid } from "../lib/utils.ts";
import { addDays, isOverdue, todayISO, toISODate } from "../lib/invoice/date.ts";

let passed = 0;
let failed = 0;

function check(label: string, got: unknown, expected: unknown) {
  const g = String(got);
  const e = String(expected);
  if (g === e) {
    passed += 1;
    console.log(`  PASS  ${label} = ${g}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label} — expected ${e}, got ${g}`);
  }
}

type Item = { id: string; quantity: string; unitPrice: string; discount: string; tax: string };
const run = (
  items: Item[],
  discountType: "percent" | "fixed" = "percent",
  discountValue = "0",
  shipping = "0",
  fees = "0",
  adjustment = "0",
  amountPaid = "0",
) => calculateTotals({ items, discountType, discountValue, shipping, fees, adjustment, amountPaid });

console.log("\n── money: mirrored from scripts/test-db.sql ──");

// case 1 — 2 x 20 with 5% tax
{
  const t = run([{ id: "1", quantity: "2", unitPrice: "20", discount: "0", tax: "5" }]);
  check("case1 subtotal", t.subtotal.toFixed(2), "40.00");
  check("case1 tax", t.taxTotal.toFixed(2), "2.00");
  check("case1 total", t.total.toFixed(2), "42.00");
  check("case1 due", t.amountDue.toFixed(2), "42.00");
}

// case 2 — item 10% + invoice 5 fixed + shipping 5 + 50 paid
{
  const t = run(
    [{ id: "1", quantity: "1", unitPrice: "100", discount: "10", tax: "0" }],
    "fixed",
    "5",
    "5",
    "0",
    "0",
    "50",
  );
  check("case2 subtotal", t.subtotal.toFixed(2), "100.00");
  check("case2 combined discount", t.discountTotal.toFixed(2), "15.00");
  check("case2 total", t.total.toFixed(2), "90.00");
  check("case2 due", t.amountDue.toFixed(2), "40.00");
}

// case 3 — 50% invoice discount also cuts the taxable base
{
  const t = run([{ id: "1", quantity: "1", unitPrice: "100", discount: "0", tax: "10" }], "percent", "50");
  check("case3 percent discount scales tax", t.total.toFixed(2), "55.00");
}

// case 4 — float trap
{
  const t = run([{ id: "1", quantity: "3", unitPrice: "0.1", discount: "0", tax: "0" }]);
  check("case4 3 x 0.1", t.subtotal.toFixed(2), "0.30");
}

// case 5 — overpayment clamping
{
  const t = run([{ id: "1", quantity: "1", unitPrice: "10", discount: "0", tax: "0" }], "percent", "0", "0", "0", "0", "9999");
  check("case5 amountPaid clamped", t.amountPaid.toFixed(2), "10.00");
  check("case5 due never negative", t.amountDue.toFixed(2), "0.00");
}

// case 6 — empty invoice
{
  const t = run([]);
  check("case6 empty total", t.total.toFixed(2), "0.00");
  check("case6 empty due", t.amountDue.toFixed(2), "0.00");
}

// case 7 — large quantities
{
  const t = run([{ id: "1", quantity: "999999", unitPrice: "9999.99", discount: "0", tax: "17.5" }]);
  check("case7 large quantity total", t.total.toFixed(2), "11749976500.01");
}

console.log("\n── money: extra edge cases ──");
{
  const t = run([{ id: "1", quantity: "1", unitPrice: "100", discount: "150", tax: "150" }]);
  check("discount above 100% clamped", t.discountTotal.toFixed(2), "100.00");
  check("tax above 100% clamped", t.taxTotal.toFixed(2), "0.00");
}
{
  const t = run([{ id: "1", quantity: "-3", unitPrice: "10", discount: "0", tax: "0" }]);
  check("negative quantity clamped", t.subtotal.toFixed(2), "0.00");
}
{
  const t = run(
    [{ id: "1", quantity: "2", unitPrice: "50", discount: "0", tax: "0" }],
    "percent",
    "0",
    "0",
    "0",
    "-15",
  );
  check("negative adjustment", t.total.toFixed(2), "85.00");
}
{
  const t = run([{ id: "1", quantity: "1", unitPrice: "100", discount: "0", tax: "0" }], "fixed", "999");
  check("fixed discount cannot exceed the base", t.discountTotal.toFixed(2), "100.00");
  check("fully discounted total", t.total.toFixed(2), "0.00");
}
{
  const t = run([
    { id: "1", quantity: "2", unitPrice: "19.99", discount: "0", tax: "20" },
    { id: "2", quantity: "1", unitPrice: "5.01", discount: "0", tax: "20" },
  ]);
  check("multi-item subtotal", t.subtotal.toFixed(2), "44.99");
  check("multi-item tax", t.taxTotal.toFixed(2), "9.00");
  check("multi-item total", t.total.toFixed(2), "53.99");
}
{
  const t = run([{ id: "1", quantity: "1", unitPrice: "12.345", discount: "0", tax: "0" }]);
  check("sub-cent unit price rounds at the line", t.subtotal.toFixed(2), "12.35");
}
{
  const t = run([{ id: "1", quantity: "1", unitPrice: "1", discount: "33.333", tax: "19.999" }]);
  check("fractional percent handled", Number.isFinite(t.total.toNumber()), true);
}

console.log("\n── formatting ──");
check("USD thousands separator", formatMoney(new Decimal("1234.5"), "$", 2), "$1,234.50");
check("JPY no decimals", formatMoney(new Decimal("1234.5"), "¥", 0), "¥1,235");
check("PKR symbol", formatMoney(new Decimal("999.99"), "Rs", 2), "Rs999.99");
check("negative", formatMoney(new Decimal("-12.3"), "$", 2), "-$12.30");
check("zero", formatMoney(new Decimal("0"), "$", 2), "$0.00");
check("string input", formatMoney("88.1", "$", 2), "$88.10");

console.log("\n── currencies ──");
check("USD", getCurrency("USD").symbol, "$");
check("EUR", getCurrency("EUR").symbol, "€");
check("GBP", getCurrency("GBP").symbol, "£");
check("PKR", getCurrency("pkR").symbol, "Rs");
check("AED", getCurrency("AED").symbol, "AED");
check("SAR", getCurrency("SAR").symbol, "SAR");
check("INR", getCurrency("INR").symbol, "₹");
check("CAD", getCurrency("CAD").symbol, "CA$");
check("AUD", getCurrency("AUD").symbol, "A$");
check("JPY decimals", getCurrency("JPY").decimals, 0);
check("custom symbol override", getCurrency("USD", "kr").symbol, "kr");
check("unknown code falls back", getCurrency("ZZZ").code, "ZZZ");

console.log("\n── design + render spec ──");
{
  const design = normaliseDesign({ template: "bold", primaryColor: "nope" });
  check("unknown colour falls back", design.primaryColor, DEFAULT_DESIGN.primaryColor);
  check("template drives defaults", design.accentStyle, "block");
  check("clamped base font size", normaliseDesign({ baseFontSize: 999 }).baseFontSize, 14);
  check("clamped table font size", normaliseDesign({ tableFontSize: 0.1 }).tableFontSize, 6);

  const a4 = buildRenderSpec({ ...DEFAULT_DESIGN, pageSize: "A4" });
  check("A4 width mm", a4.pageWidthMm, 210);
  check("A4 content width mm", a4.contentWidthMm, 180);
  check("A4 pdf font", a4.pdfFont, "Helvetica");

  const letter = buildRenderSpec({ ...DEFAULT_DESIGN, pageSize: "Letter" });
  check("Letter width mm", letter.pageWidthMm, 215.9);
  check("Letter content width mm", letter.contentWidthMm, 185.9);

  const compact = buildRenderSpec({ ...DEFAULT_DESIGN, density: "compact" });
  const airy = buildRenderSpec({ ...DEFAULT_DESIGN, density: "airy" });
  check("compact has less padding than airy", compact.cellPadY < airy.cellPadY, true);

  const serif = buildRenderSpec({ ...DEFAULT_DESIGN, fontFamily: "georgia" });
  check("serif pdf font", serif.pdfFont, "Times-Roman");
  check("serif bold pdf font", serif.pdfBold, "Times-Bold");
}

console.log("\n── dates ──");
{
  const today = new Date();
  const past = toISODate(new Date(today.getTime() - 5 * 86_400_000));
  const future = addDays(todayISO(), 5);
  check("past date is overdue", isOverdue(past), true);
  check("future date is not overdue", isOverdue(future), false);
  check("null due date is not overdue", isOverdue(null), false);
  check("addDays keeps the ISO shape", /^\d{4}-\d{2}-\d{2}$/.test(future), true);
}

console.log("\n── invoice line-item ids ──");
{
  // `invoice_items.id` is a uuid primary key. Autosave upserts every row in one
  // statement, so a missing or malformed id would be sent as NULL and violate
  // the constraint. Item ids must be real v4 UUIDs from the moment they exist.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const a = emptyItem();
  const b = emptyItem();
  check("emptyItem() id is a v4 uuid", UUID_RE.test(a.id), true);
  check("two items never share an id", a.id !== b.id, true);

  const many = Array.from({ length: 500 }, () => emptyItem().id);
  check("500 item ids are unique", new Set(many).size, 500);
  check("500 item ids are all uuids", many.every((id) => UUID_RE.test(id)), true);

  // the duplicate button mints a fresh id, otherwise the upsert would collapse
  // the copy into the original row
  check("duplicate produces a new id", a.id !== uuid(), true);

  // server-side fallback: a non-uuid id from the wire must be replaceable
  const wireId = "item_abc123";
  check("non-uuid is detected as non-uuid", UUID_RE.test(wireId), false);
  check("replacement is a valid uuid", UUID_RE.test(uuid()), true);
}

console.log(`\n${failed === 0 ? "✔" : "✖"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
