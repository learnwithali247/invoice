# Invoice Generator

A fast, modern, highly customisable invoicing app built with **Next.js 15 (App Router)**,
**TypeScript**, **Tailwind CSS** and **Supabase**.

> Open app → Login → Pick invoice type → Create → Customise → Preview → Download / Share / Get paid.

Everything a user can see is actually implemented. There are no placeholder buttons, and
there is no simulated payment processor — real providers are wired through a small
abstraction so no card data ever touches this application.

---

## Table of contents

1. [What is implemented](#1-what-is-implemented)
2. [Stack](#2-stack)
3. [Getting started](#3-getting-started)
4. [Environment variables](#4-environment-variables)
5. [Database setup](#5-database-setup)
6. [Demo / test account](#6-demo--test-account)
7. [Payment setup](#7-payment-setup)
8. [Email setup](#8-email-setup)
9. [Tests](#9-tests)
10. [Local development](#10-local-development)
11. [Production deployment](#11-production-deployment)
12. [Architecture](#12-architecture)
13. [How the money maths works](#13-how-the-money-maths-works)
14. [Security checklist](#14-security-checklist)
15. [Requires external credentials](#15-requires-external-credentials)

---

## 1. What is implemented

**Authentication**
- Email + password sign-in, registration, password reset and password update via Supabase Auth.
- Session persisted in cookies through `@supabase/ssr`; users stay signed in across refreshes.
- Middleware refreshes the session and gates every private route.
- A `profiles` row and a `business_settings` row are created automatically by a database
  trigger on user creation.
- Password rules enforced on both client and server; auth errors are mapped to short, safe messages.

**Dashboard**
- Stat cards (total billed, outstanding, overdue, average) computed per currency.
- Search by invoice number, customer name, company or customer email.
- Filters: status, payment status, currency, date range.
- Sorting: newest, oldest, highest amount, lowest amount, invoice number.
- Server-side pagination — only 10 rows are fetched at a time.
- Skeleton loaders, empty states for "no invoices" and "no results".

**Invoice types**
- Standard, Tax, Proforma, Commercial, Custom — data-driven, so adding a type is one entry in
  `INVOICE_TYPES` / `INVOICE_TYPE_META`.

**Invoice editor**
- Split-screen layout: editor on the left, live preview on the right (tabs on mobile).
- Tabs: General, Customer, Items, Payment, Design, Notes.
- Unlimited line items with add, duplicate, delete and drag-to-reorder.
- Autosave with 900 ms debounce and `Saving… / Saved / Unable to save` status.
- Automatic retry with backoff when the network fails; the request is aborted after 20 s.
- Local draft protection — after an unexpected refresh you are offered `Restore` / `Discard`.
- `Cmd/Ctrl + S` saves immediately.
- Sticky action bar: Save, Print, Download PDF, Share, Send.

**Design customisation**
- 7 templates: Minimal, Modern, Corporate, Elegant, Compact, Bold, Professional.
- 6 colour pickers + 6 ready-made palettes.
- 9 font families, base size, heading scale, table size.
- Header alignment, logo position, title position.
- Accent style, table style, row density, divider weight, corner radius, row spacing,
  table borders, logo width.
- 16 visibility toggles (tax ID, customer phone/email, shipping address, payment terms, due date,
  notes, discount, tax, shipping, fees, adjustment, amount paid, footer, pay button, page numbers…).
- A4 and US Letter page sizes.
- Changing the template only changes presentation — invoice data is never touched.
- All design options live in a single `design_settings` JSONB column, so new options can be
  added without a schema migration.

**Rendering (one engine, three outputs)**
- `components/invoice/invoice-document.tsx` is the single renderer used for the live preview,
  the print page, the public invoice page and the payment page.
- `components/pdf/invoice-pdf.tsx` is the PDF renderer. It consumes the *same* `RenderModel` and
  `buildRenderSpec()` output as the HTML renderer, so colours, fonts, spacing, visibility toggles
  and totals always match.
- The document is authored in millimetres, so preview, print (`@page` size) and PDF share one
  geometry model.
- PDF output is real vector text (never a screenshot), repeats the table header on every page,
  keeps the totals block together, and paginates automatically.

**Data & correctness**
- Server-side recalculation of every total inside Postgres (`recalculate_invoice_totals`), triggered
  on any change to items, discount, shipping, fees, adjustment or amount paid.
- The browser never supplies totals — they are ignored on write and read back from the database.
- `Decimal.js` in the app mirrors the SQL maths 1:1, so the live preview and the stored row agree.
- Automatic invoice numbering (`INV-000001`, configurable prefix and padding) reserved atomically.
- Duplicate invoice numbers per user are rejected by a partial unique index.
- Soft delete for invoices, hard delete for customers.

**Sharing, public pages and payments**
- Public invoice page `/i/<48-char-token>` — no login, no internal fields.
- Payment page `/pay/invoice/<token>` with provider buttons and a "Test mode" banner.
- Secure random 48-character hex tokens; database IDs are never exposed in share URLs.
- `PaymentProvider` interface with `StripeProvider` and `PayPalProvider` implementations.
- Webhook verification (Stripe HMAC signature with replay window; PayPal signature verification),
  idempotent via a unique index on `(provider, provider_session_id, status)`.
- An invoice is **never** marked paid from a browser redirect.
- Payment statuses: unpaid, pending, paid, partially paid, overdue, cancelled, refunded.

**Other**
- Business profile with logo upload to a private Supabase Storage bucket (PNG/JPG/WEBP/SVG,
  2 MB limit, SVG sanitised against scripts).
- Saved customers library with search, create, edit and delete.
- Email invoices with an optional PDF attachment and secure links, behind a provider interface.
- A4 / Letter print route with a real `@page` size and page numbers.
- Settings page: business, invoice defaults, default design, payments status, account
  (name, password, sign out, delete account).
- Accessibility: labelled fields, visible focus rings, keyboard-navigable tabs and dialogs,
  skip link, ARIA roles, status live regions, non-colour status indicators (labels + icons).
- `prefers-reduced-motion` respected.

---

## 2. Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15.5 (App Router, RSC) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3.4 |
| Auth + DB + Storage | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) |
| PDF | `@react-pdf/renderer` (server-side) |
| Money maths | `decimal.js` + native `numeric` in Postgres |
| Validation | `zod` |
| Icons | `lucide-react` |
| Lint | ESLint 9 (flat config) + `eslint-config-next` |

No other runtime dependencies. Stripe and PayPal are called through their REST APIs with
`fetch`, so no vendor SDKs are shipped to the browser.

---

## 3. Getting started

```bash
# 1. install
npm install

# 2. environment
cp .env.example .env.local
#   then fill in SUPABASE_SECRET_KEY (see next section)

# 3. database — create the tables (choose ONE of the two)
npm run db:push       # applies the migration for you (needs SUPABASE_ACCESS_TOKEN)
#   …or paste supabase/migrations/001_initial_schema.sql into the SQL editor:
npm run supabase:migrate            # prints the SQL
#   …or with the Supabase CLI:
supabase link --project-ref ayuzkbjywyzryotwnbpk
supabase db push

# 4. dev server
npm run dev                         # http://localhost:3000

# optional: demo data
npm run seed
```

### Applying the migration with one command

`npm run db:push` executes the migration against your project through the Supabase
Management API, prints the exact Postgres error if anything fails, then verifies all 7 tables
via PostgREST so you know it worked. It needs a one-time personal access token:

1. Create one at <https://supabase.com/dashboard/account/tokens>
2. Add to `.env.local`:
   ```env
   SUPABASE_ACCESS_TOKEN=sbp_…
   ```
3. `npm run db:push`

The token is read only from your local git-ignored `.env.local`, is used once, and is never
bundled or logged. You can delete the line afterwards.

---

## 4. Environment variables

`.env.example` is the template. **Only variables prefixed `NEXT_PUBLIC_` reach the browser.**

### Public (safe to commit)

```env
NEXT_PUBLIC_SUPABASE_URL=https://ayuzkbjywyzryotwnbpk.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_B8qGs-YPmPcyg3OFnXQo_g_58tkj9zR
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Server-only (never commit, never sent to the browser)

```env
SUPABASE_SECRET_KEY=…            # Supabase → Project Settings → API Keys → Secret key
```

The secret key is read only by `lib/supabase/admin.ts`, which is imported exclusively from
server-only code paths (payment webhooks, public invoice reads, account deletion). It is not
referenced by any component, client hook, API response, or localStorage write.

### Payments / email / demo

See `.env.example` for the full list. Details in sections 7, 8 and 6.

---

## 5. Database setup

> **This step is required before anything works.** If the tables do not exist, the app shows a
> "Your database is not set up yet" screen listing the missing tables, and every write returns a
> `503 schema_missing`. Run this migration first.

`supabase/migrations/001_initial_schema.sql` is a single idempotent script. It creates:

- **Tables** — `profiles`, `business_settings`, `customers`, `invoices`, `invoice_items`,
  `invoice_templates`, `payment_transactions`.
- **Enums** — `invoice_status`, `payment_status`, `invoice_type`, `payment_provider`,
  `transaction_status`.
- **Indexes** — on `user_id`, `invoice_id`, `invoice_number`, `public_token`, `created_at`,
  `due_date`, statuses, plus two partial unique indexes:
  - `invoices (user_id, lower(invoice_number)) where deleted_at is null`
  - `invoices (public_token)`
- **Foreign keys** with `on delete cascade` / `set null` as appropriate.
- **Functions**
  - `recalculate_invoice_totals(uuid)` — the money source of truth
  - `sync_payment_status(uuid)` — keeps `payment_status` consistent with amounts and due dates
  - `reserve_invoice_number(uuid, prefix, padding)` — atomic numbering
  - `record_payment(...)` — webhook entry point, idempotent
  - `duplicate_invoice(uuid, new_number)`
  - `get_public_invoice(token)` — `SECURITY DEFINER`, customer-facing fields only
  - `handle_new_user()` — creates `profiles` + `business_settings` on signup
- **RLS** on every table, with `user_id = auth.uid()` policies for select/insert/update/delete.
  `payment_transactions` has read-only policies — only service-role code writes.
- **Storage** — private `logos` bucket (2 MB, PNG/JPG/WEBP/SVG) with per-user folder policies
  so no user can read or overwrite another user's files.
- **System invoice templates** — the 7 built-in template definitions.

Run it twice safely: every statement is `create … if not exists` / `drop … if exists`.

### Verify it worked

```bash
npm run dev
curl http://localhost:3000/api/health
```

A healthy deployment returns `200` with `"schema":{"ok":true}` and empty `missingTables`. The
response also reports whether the Supabase secret key, the payment providers and the email
provider are configured — it never contains a secret value. The app itself uses the same check to
decide between the normal UI and the "database is not set up yet" screen, so you can also just open
`/dashboard` in a browser.

---

## 6. Demo / test account

The password is **never** hard-coded in the app. The seed script reads it from your local,
git-ignored `.env.local`:

```env
TEST_ACCOUNT_EMAIL=demo@example.com
TEST_ACCOUNT_PASSWORD=choose-something-strong
TEST_ACCOUNT_NAME=Demo User
```

Then:

```bash
npm run seed
```

The script uses the Supabase **Admin API** (`SUPABASE_SECRET_KEY`) to:

1. create the demo user (or update it if it already exists, setting a fresh password and
   confirming the email),
2. fill in a sample business profile marked as demo data,
3. create three demo customers (Acme Technologies, John Smith, Global Solutions GmbH),
4. create three demo invoices:

| Invoice | Customer | Items | Status |
| --- | --- | --- | --- |
| `INV-000001` | Acme Technologies | Website Development 1 × $500, Hosting 1 × $120 | **Paid** |
| `INV-000002` | John Smith | AI Subscription 3 × $20 (+20% tax) | **Draft, payment enabled** |
| `INV-000003` | Global Solutions GmbH | Consulting 10 × $50 (−5% disc, +19% VAT, $15 shipping) | **Sent / overdue** |

Each invoice uses a different template and a different status, and `INV-000002` is the one with
`payment_enabled = true` so the Pay Now flow can be tested immediately. Running the script again
is safe — it resets the demo user's data.

---

## 7. Payment setup

### Mode

```env
PAYMENT_MODE=test     # test | live | disabled
```

In `test` mode the UI shows a **TEST MODE** badge on the public payment page and the Settings →
Payments tab, and every recorded transaction is stored with `is_test = true`. Test mode is never
presented as a real payment.

### Stripe

1. Create an account at <https://dashboard.stripe.com/test/apikeys>.
2. Copy the **test secret key** and **test publishable key** into `.env.local`:

```env
STRIPE_TEST_SECRET_KEY=sk_test_…
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

3. Run `npm run dev`, then in Stripe → Developers → Webhooks → add an endpoint:

```
https://your-domain.com/api/payments/webhook/stripe
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. The exact URL is shown in
Settings → Payments.

For local testing without a public URL, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook/stripe
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC. A declined card
(`4000 0000 0000 0002`) exercises the failure path.

### PayPal

1. Create a sandbox app at <https://developer.paypal.com/dashboard/applications/sandbox>.
2. Fill in:

```env
PAYPAL_TEST_CLIENT_ID=…
PAYPAL_TEST_CLIENT_SECRET=…
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=…
```

3. Add a webhook URL:

```
https://your-domain.com/api/payments/webhook/paypal
```

subscribed to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.DECLINED`
and `PAYMENT.CAPTURE.REFUNDED`.

### What happens on payment

```
Invoice → Pay now → provider checkout (hosted) → buyer pays
   → provider webhook (signature verified, server-side)
   → record_payment() → invoice.amount_paid / amount_due / payment_status updated
   → buyer returns to /pay/invoice/<token> → page polls the stored status
```

The return page never grants itself permission to mark anything paid. For Stripe the signed
webhook is the only authority; for PayPal the order is also captured server-to-server.

---

## 8. Email setup

```env
EMAIL_PROVIDER=console     # console | resend
EMAIL_FROM="Your Business <billing@yourdomain.com>"
RESEND_API_KEY=re_…        # only for provider=resend
```

- `console` prints the full message and the attachment name to the server log. The UI says
  plainly that nothing was sent.
- `resend` sends for real.

To add SendGrid or SMTP, implement `EmailProvider` in `lib/email/` and register it in
`lib/email/index.ts`. No calling code changes.

---

## 9. Tests

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint (0 errors, 0 warnings)
npm run test:calc     # 60 calculation / design / date checks
npm run test:db       # 32 database checks in a throwaway Postgres (requires Docker)
npm test              # all of the above
```

`npm run test:db` starts a temporary `postgres:16-alpine` container, applies a shim that recreates
the Supabase-managed pieces the migration needs (`auth.users`, `auth.uid()`,
`storage.buckets`, `storage.objects`, the `anon`/`authenticated`/`service_role` roles), runs the
migration twice to prove idempotency, then asserts:

- every calculation case (mirrored 1:1 by `test:calc`, proving JS and SQL agree),
- item-level + invoice-level discounts, percentage discounts reducing the taxable base,
- the `3 × 0.1` float trap, overpayment clamping, empty invoices, huge quantities,
- `handle_new_user` triggers, atomic invoice numbering, `duplicate_invoice`,
- 48-character hex public tokens, and that `get_public_invoice` leaks no internal fields,
- webhook idempotency (a duplicate delivery writes no extra row),
- RLS isolation: user B cannot read user A's invoices or customers (run as a non-superuser so RLS
  is genuinely enforced).

The PDF renderer is verified in a separate smoke check: 40 line items produce a valid multi-page
PDF (`%PDF-1.3` header, repeated table header, kept-together totals).

---

## 10. Local development

```bash
npm install
cp .env.example .env.local     # fill in SUPABASE_SECRET_KEY
npm run dev
```

- App: <http://localhost:3000>
- Supabase Studio: <http://127.0.0.1:54323> (if you run `supabase start` locally)

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with fast refresh |
| `npm run build` / `npm start` | Production build and serve |
| `npm run db:push` | Apply the migration to your Supabase project (one command) |
| `npm run supabase:migrate` | Print the SQL migration |
| `npm run seed` | Create/refresh the demo account and data |
| `npm run test:calc` | Money + design + date checks |
| `npm run test:db` | Database + RLS checks in Docker |
| `npm run perf` | Measure real page + API timings against a running server |
| `curl localhost:3000/api/health` | Check env, schema, payment and email wiring |

## Performance

The app is an SSR app in front of a remote database, so **page speed is the number of *sequential*
round trips to Supabase**, not CPU. Everything here is built around that.

Measured with `npm run perf` (median of 3, production build, ~400 ms per Supabase round trip from
this machine):

| Route | Before | After |
| --- | --- | --- |
| `GET /login` (no database) | 0.21 s | **0.005 s** |
| `GET /i/<token>` public invoice | 0.81 s | **0.09 s** |
| `GET /api/health` | 2.64 s | **0.36 s** |
| `GET /dashboard` | 0.90 s | **0.80 s** |
| `POST /api/invoices` (autosave) | 2.65 s | **1.53 s** |

What was done:

- **One auth round trip per request, not two.** Middleware validates the session and passes the
  identity down in a request header; the layout and page read that instead of calling
  `auth.getUser()` again. The header is overwritten, never appended, so it cannot be forged.
- **Anonymous traffic never touches the auth API.** Middleware checks for a session cookie first and
  only calls Supabase when one is present.
- **Shared auth result per render.** `getAuthUser()` is wrapped in React `cache()`, so a layout and
  its page cannot each pay for it.
- **Schema check is one probe, cached 10 minutes.** It stops at the first table that answers, and a
  healthy result is cached long while a broken one expires in 5 seconds so a fresh migration is
  picked up immediately.
- **Independent queries run in parallel** — the editor and print pages no longer fetch the invoice
  and the business profile one after another, and the public page fetches items + business settings
  together.
- **The public invoice page is cached** for 60 s and revalidated the moment an invoice is saved,
  duplicated or deleted, so a share link stays correct without paying for the database every view.
  The payment page is deliberately **not** cached — it must stay authoritative for status polling.
- **Autosave is lean**: items are upserted and pruned in a single round trip (the two touch disjoint
  id sets, so they run together), and the read-back is skipped for an existing invoice because the
  browser already holds the id, token and totals.

**Measure with the production build.** `next dev` recompiles a route on first request, which
dominates any timing:

```bash
npm run build && npm start     # real performance
npm run dev                    # development only
```

**The remaining floor** is two round trips per signed-in page (one auth check, one data query).
Reducing that further would mean trusting an unverified JWT instead of validating the token against
Supabase Auth, which weakens security — not worth it. If your network to Supabase is slow, the
biggest lever is the project's region: Supabase → Project Settings → Data Location.

`dashboardSummary` aggregates up to 1,000 invoices in one query. That is fine at this scale; for
tens of thousands of invoices it should move into a Postgres aggregate function.

If you ever see `ENOENT: … .next/server/vendor-chunks/next.js` or
`Cannot find module './5611.js'`, the build cache is corrupt — a dev server was running while
`.next` was deleted or rebuilt. Fix it with:

```bash
# stop the dev server (Ctrl+C), then
rmdir /s /q .next      # Windows:  rmdir /s /q .next
npm run dev
```

If port 3000 is already taken, Next prints the port it switched to. Set
`NEXT_PUBLIC_APP_URL` to that port (e.g. `http://localhost:3001`) so share and payment links point
at the right origin.

If Supabase credentials are missing the app renders a setup screen instead of crashing, so
`next build` and a fresh clone always work. If the credentials are present but the migration has
not been applied, the app renders a "database is not set up yet" screen naming the missing tables.

---

## 11. Production deployment

### Vercel (recommended)

1. Push the repository to GitHub.
2. Import it in Vercel (framework: Next.js, detected automatically).
3. Add environment variables under **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_APP_URL` → `https://your-domain.com`
   - `SUPABASE_SECRET_KEY`
   - `PAYMENT_MODE`, and the provider keys you actually use
   - `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` (if Resend)
4. Deploy. Add your production domain to the Supabase project's **Authentication → URL
   Configuration**:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/**`
5. Create the Stripe/PayPal webhooks pointing at the production domain
   (Settings → Payments shows the exact URLs).

### Any Node host

```bash
npm ci
npm run build
npm start          # listens on $PORT
```

Requirements: Node 20+, a writable `.next` directory, and outbound network access to
`*.supabase.co`, the payment provider, and (if used) the email provider.

### After deploying

- Set `NEXT_PUBLIC_APP_URL` so share/payment links use the real origin.
- Set `PAYMENT_MODE=live` only once live keys are configured and webhooks are verified.
- Optionally disable Supabase email confirmation for a frictionless signup, or configure a
  custom SMTP provider.

---

## 12. Architecture

```
app/
  (auth)/login, register, forgot-password, reset-password
  (app)/dashboard, invoices/new, invoices/[id], invoices/[id]/print, customers, settings
  i/[token]                     public invoice (no login)
  pay/invoice/[token]           public payment page
  api/
    invoices/                   GET list · POST create/update (autosave)
    invoices/[id]               GET · DELETE (soft)
    invoices/[id]/duplicate     POST
    invoices/[id]/pdf           POST → application/pdf
    invoices/[id]/send          POST → email + PDF attachment
    invoices/[id]/share         POST → public + payment links
    customers/                  GET · POST
    customers/[id]              DELETE
    logo/                       POST upload · DELETE
    settings/business           PUT
    account                     PUT (name / password) · DELETE
    public/invoices/[token]     GET (token-scoped, customer-facing only)
    payments/checkout           POST → provider checkout session
    payments/confirm            POST → server-side capture (PayPal) / status read
    payments/status             GET  → status polling for the pay page
    payments/webhook/stripe     POST signature-verified
    payments/webhook/paypal     POST signature-verified

components/
  ui/          button, input, select, textarea, toggle, colour picker, dialog, tabs, toast,
               dropdown, confirm, card, empty state, skeleton
  layout/      app shell (sidebar, mobile drawer, user menu)
  auth/        login, register, forgot-password, reset-password
  dashboard/   dashboard view, invoice actions, invoice type picker, customers, settings
  invoice/     invoice-editor · invoice-document · invoice-preview · panels/* · dialogs
  pdf/         invoice-pdf
  layout/      setup-required, print-auto-run

lib/
  supabase/    client (browser) · server (request-scoped) · admin (service role) · config
  invoice/     calculate · design · templates · currencies · date · color · render-spec ·
               mappers · payload · service (server) · public (server) · types
  payments/    provider (interface) · stripe · paypal · env · index
  email/       provider (interface) · console · resend · invoice-email · index
  pdf/         render (server-only react-pdf → Buffer)
  validation/  zod schemas
  api.ts utils.ts

types/         database.ts (hand-written, matches the migration)
supabase/migrations/001_initial_schema.sql
scripts/       seed · test-calc · test-db · test-shim · test-db.sql · print-migration · ts-hooks
middleware.ts  session refresh + route gating
```

**Layering rules**
- Business logic never lives inside UI components.
- `lib/invoice/service.ts` is the only place that writes invoices; it runs as the signed-in user
  so RLS applies.
- `lib/supabase/admin.ts` is `server-only` and used only after a token, signature or session has
  been verified.
- React-PDF is listed in `serverExternalPackages` and only imported from `lib/pdf/render.tsx`,
  which is `server-only` — the renderer never ships to the browser.

**Adding an invoice type** — add a slug to `INVOICE_TYPES` and an entry (with optional defaults)
to `INVOICE_TYPE_META` in `lib/invoice/types.ts`. The picker, editor and database enum follow
automatically.

**Adding a payment provider** — implement `PaymentProvider` from `lib/payments/provider.ts` and
add it to the registry in `lib/payments/index.ts`. No invoice code changes.

**Adding a design option** — add the field to `DesignSettings` and `DEFAULT_DESIGN` in
`lib/invoice/design.ts`, normalise it in `normaliseDesign`, expose it in
`components/invoice/panels/design-panel.tsx`, add a zod entry in
`lib/validation/schemas.ts`, and consume it in `buildRenderSpec`. No schema migration is needed.

---

## 13. How the money maths works

Every figure is derived, never trusted. The same algorithm runs in two places, and both are
covered by the same test cases:

```
base_i            = quantity_i × unit_price_i
item discount_i   = base_i × (d_i / 100)
netAfterItems     = Σ base_i − Σ item discount_i
invoice discount  = percent ? rate × netAfterItems
                  : min(netAfterItems, discountValue)
effectiveRate_i   = (1 − d_i/100) × (percent ? 1 − rate : 1)
tax_i             = round(base_i × effectiveRate_i × t_i/100, 2)
total             = netAfterItems − invoiceDiscount + Σ tax_i + shipping + fees + adjustment
amount_paid       = min(max(0, amount_paid), total)
amount_due        = total − amount_paid
```

- `lib/invoice/calculate.ts` (Decimal.js) powers the live preview.
- `public.recalculate_invoice_totals()` (native `numeric`) is the authority and runs in a trigger.
- The invoice is read back from the database after every save, so the UI shows stored values.
- Amounts are `numeric(15,2)`; quantities and unit prices are `numeric(15,4)`; percentages are
  `numeric(7,4)`. There are no floating-point money values anywhere.

---

## 14. Security checklist

**Secrets**
- [x] Only `NEXT_PUBLIC_*` variables reach the browser.
- [x] `SUPABASE_SECRET_KEY`, Stripe secret keys, PayPal client secrets, webhook secrets and the
      email API key are read exclusively in server-only modules.
- [x] `lib/supabase/admin.ts`, `lib/pdf/render.tsx`, `lib/payments/*` and `lib/email/*` all
      `import "server-only"`.
- [x] `.env*` files are git-ignored; `.env.example` contains placeholders only.
- [x] No secret is returned in any API response or written to `localStorage`.

**Authorisation**
- [x] Row Level Security enabled on all seven tables.
- [x] Every policy scopes to `user_id = auth.uid()` (item ownership is verified against the parent
      invoice, so items cannot be attached to someone else's invoice).
- [x] `payment_transactions` has no client write policy — only service-role code writes.
- [x] Middleware redirects unauthenticated requests to `/login` with a `next` parameter that is
      only used as an in-app path.
- [x] `get_invoice` / `getInvoice` runs under the caller's session, so RLS hides other users' rows
      before any application code sees them.

**Payments**
- [x] No card numbers, CVVs or card passwords are ever accepted, stored, logged or transmitted.
- [x] Checkout happens on the provider's hosted page.
- [x] Stripe signatures are verified with HMAC-SHA256 plus a 5-minute replay window, using a
      timing-safe comparison.
- [x] PayPal webhooks are verified against PayPal's certificates and the
      `verify-webhook-signature` endpoint.
- [x] An invoice is never marked paid from a browser redirect.
- [x] Duplicate webhook deliveries are idempotent (partial unique index).
- [x] Overpayments are clamped to the outstanding balance; `amount_due` can never go negative.
- [x] `is_test` records that a payment ran in sandbox mode.

**Public pages**
- [x] Share and payment URLs use a 48-character cryptographically random token (192 bits).
- [x] No database IDs appear in public URLs.
- [x] `get_public_invoice()` is `SECURITY DEFINER` and returns only customer-facing fields; this is
      asserted by an automated test.
- [x] Public pages are `noindex` and the router is the only entry point.

**Input & output**
- [x] Every write path is validated with zod (length limits, email format, ISO dates, percent
      bounds, maximum 500 items).
- [x] Every API error is logged server-side and replaced with a generic, safe message.
- [x] SVG uploads are rejected if they contain `<script>`, event handlers, `<foreignObject>` or
      `javascript:`.
- [x] Uploads are capped at 2 MB and restricted to an allow-list of MIME types.
- [x] Email HTML escapes every interpolated value.
- [x] `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` on the PDF response.
- [x] `poweredByHeader: false`.

**Storage**
- [x] Private bucket; policies key on the first path segment matching `auth.uid()`.
- [x] Users cannot read, write or delete another user's folder.
- [x] Deleting an account removes its storage objects first.

**Known residual risks**
- `npm audit` reports advisories in the copy of `postcss` bundled inside `next`. It is a
  build-time dependency that only processes this repository's own CSS files; it is not reachable
  from user input at runtime. Upgrading to Next 16 clears the report.
- A signed logo URL is valid for up to 24 hours on public invoice pages. Anyone holding the URL can
  see the logo — which is already public on that page.

---

## 15. Requires external credentials

These are the only things you must supply from outside the repository. Everything else works out
of the box.

| What | Where to get it | Needed for |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys | Server-side admin operations. **Required.** The app runs without it, but logo upload, public invoice rendering, seed and account deletion need it. |
| `STRIPE_TEST_SECRET_KEY` | <https://dashboard.stripe.com/test/apikeys> | Stripe test checkout |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks | Confirming Stripe payments server-side |
| `STRIPE_LIVE_SECRET_KEY` | <https://dashboard.stripe.com/apikeys> | Live Stripe checkout |
| `PAYPAL_TEST_CLIENT_ID` / `_SECRET` | <https://developer.paypal.com/dashboard/applications/sandbox> | PayPal sandbox checkout |
| `PAYPAL_WEBHOOK_ID` | PayPal app → Webhooks | Confirming PayPal payments server-side |
| `PAYPAL_LIVE_CLIENT_ID` / `_SECRET` | PayPal live app | Live PayPal checkout |
| `RESEND_API_KEY` | <https://resend.com/api-keys> | Real email delivery (optional — the console provider works without it) |
| `NEXT_PUBLIC_APP_URL` | Your deployment | Correct share and payment links. Falls back to `http://localhost:3000`. |
| `TEST_ACCOUNT_EMAIL` / `TEST_ACCOUNT_PASSWORD` | You choose | `npm run seed` demo data (dev only) |

Without payment credentials the Pay now button stays disabled and Settings → Payments shows
exactly which variable is missing. Without email credentials, sending logs to the server console
and says so in the UI. There are no other gaps and no fake buttons.
