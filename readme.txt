# Build a Fast, Modern, Highly Customizable Invoice Generator

Act as a senior full-stack engineer, UI/UX designer, and SaaS architect.

Build a production-ready invoice generator web application that is extremely fast, simple to use, responsive, and visually polished.

The application should use **Supabase** for authentication and database functionality.

The core philosophy is:

> Open app → Login → Select invoice type → Create invoice → Customize design → Preview → Download / Share / Send payment request.

The application should feel lightweight and instant, not like a complicated accounting platform.

---

# 1. Technology Requirements

Use a modern production-ready stack.

Preferred:

* Next.js
* TypeScript
* Tailwind CSS
* Supabase
* React
* Server-side API routes where necessary
* Client-side invoice preview
* PDF generation
* Responsive design
* Component-based architecture

Prioritize:

1. Speed
2. Reliability
3. Clean UI
4. Excellent invoice rendering
5. Mobile responsiveness
6. Easy customization
7. Secure authentication
8. Minimal unnecessary dependencies

Avoid overengineering.

---

# 2. Supabase Configuration

Use the following Supabase project:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ayuzkbjywyzryotwnbpk.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_B8qGs-YPmPcyg3OFnXQo_g_58tkj9zR
```

The Supabase secret key MUST NEVER be exposed to the browser.

The secret key should only exist in server-side environment variables:

```env
SUPABASE_SECRET_KEY=YOUR_SERVER_SIDE_SECRET
```

Never put the secret key inside:

* React components
* client JavaScript
* public environment variables
* GitHub
* browser localStorage
* API responses

Use Supabase Auth for user authentication.

---

# 3. Authentication

When a user opens the application, show a clean authentication screen.

Support:

### Login

Fields:

* Email
* Password

Buttons:

* Login
* Forgot password
* Create account

### Registration

Fields:

* Full name
* Email
* Password
* Confirm password

Use Supabase Auth.

After successful authentication:

```text
Login
↓
Dashboard
↓
Create Invoice
```

Persist the authentication session properly.

Users should remain logged in after refreshing the page.

Handle:

* Invalid credentials
* Email already registered
* Weak password
* Session expiration
* Password reset
* Logout

Show clear but minimal error messages.

---

# 4. First Screen After Login

After login, show a simple dashboard.

Dashboard should contain:

### Header

Left:

* App logo/name

Right:

* User email/name
* Settings
* Logout

### Main area

Large primary button:

**+ Create Invoice**

Below it:

### Recent Invoices

Display:

* Invoice number
* Customer
* Amount
* Date
* Status
* Payment status
* Actions

Actions:

* Open
* Edit
* Duplicate
* Download
* Delete

Use pagination or lazy loading if necessary.

Do not load unnecessary data.

---

# 5. Invoice Type Selection

When the user clicks:

**Create Invoice**

First ask:

## What type of invoice do you want to create?

Provide attractive cards.

Example:

### Standard Invoice

For normal products and services.

### Tax Invoice

Includes tax information.

### Proforma Invoice

For quotations / preliminary billing.

### Commercial Invoice

For business and international transactions.

### Custom Invoice

Fully customizable invoice structure.

The architecture should allow additional invoice types later.

Selecting an invoice type opens the invoice editor.

---

# 6. Invoice Editor

The invoice editor is the main feature.

Use a split-screen desktop layout.

Left:

## Invoice Settings / Editor

Right:

## Live Invoice Preview

On mobile:

Editor and preview should become tabs or collapsible sections.

The preview must update almost instantly when the user changes anything.

Do not reload the page.

---

# 7. Business Information

Allow the user to configure their business.

Fields:

* Business name
* Business logo
* Business email
* Phone
* Website
* Address
* City
* State
* Country
* Tax ID
* Registration number
* Additional information

Logo upload:

Allow:

* PNG
* JPG
* JPEG
* WebP
* SVG if safely supported

Show:

**Upload Logo**

Also provide:

**Remove Logo**

Logo should be stored using Supabase Storage.

Optimize uploaded images before displaying them where possible.

---

# 8. Customer Information

Invoice should have a customer section.

Fields:

* Customer name
* Company
* Email
* Phone
* Billing address
* Shipping address
* Tax ID
* Notes

Provide an option:

**Save customer**

Saved customers can later be selected from a dropdown.

---

# 9. Invoice Information

Allow editing:

* Invoice number
* Invoice date
* Due date
* Purchase/order number
* Reference number
* Currency
* Payment terms
* Invoice status

Invoice numbers should have automatic generation.

Example:

```text
INV-000001
INV-000002
INV-000003
```

Allow users to configure the prefix.

Example:

```text
AISTAN-
INV-
2026-
```

Allow automatic numbering.

Prevent duplicate invoice numbers per user.

---

# 10. Invoice Items

The invoice must support unlimited line items.

Each item should contain:

* Product/service name
* Description
* Quantity
* Unit price
* Discount
* Tax
* Total

Example:

```text
Product       Qty    Price     Tax    Discount    Total
--------------------------------------------------------
AI Pro         2     $20       5%       $0        $42
```

Buttons:

**+ Add Item**

**Duplicate Item**

**Delete Item**

Allow drag-and-drop item ordering if practical.

Calculations must happen instantly.

---

# 11. Automatic Calculations

Calculate automatically:

* Subtotal
* Discount
* Tax
* Shipping
* Additional fees
* Adjustment
* Grand total
* Amount paid
* Amount due

Example:

```text
Subtotal       $100
Discount       -$10
Tax             $9
Shipping        $5
-------------------
Total          $104
Paid            $50
-------------------
Due             $54
```

Never trust totals supplied by the client when storing payment or financial information.

Recalculate important totals server-side.

Handle decimal currency calculations safely.

Avoid floating point errors.

---

# 12. Currency

Support multiple currencies.

At minimum:

* USD
* EUR
* GBP
* PKR
* AED
* SAR
* INR
* CAD
* AUD

Allow the user to choose the currency.

Currency symbol should automatically update.

Allow custom currency symbols.

---

# 13. Highly Customizable Design

This is extremely important.

The user should be able to customize almost every visual aspect of the invoice.

Create a:

## Design

section.

Allow:

### Layout

* Classic
* Modern
* Minimal
* Professional
* Compact
* Corporate
* Bold

### Colors

Customize:

* Primary color
* Secondary color
* Text color
* Muted text color
* Border color
* Background color

Include a color picker.

### Typography

Allow:

* Font family
* Font size
* Heading size
* Body size
* Table size

Use safe web fonts.

### Header

Allow:

* Logo position
* Business information position
* Invoice title position
* Header alignment

### Table

Customize:

* Header background
* Border style
* Row spacing
* Column alignment
* Rounded corners

### Footer

Allow:

* Footer text
* Payment instructions
* Terms
* Notes
* Contact information

### Visibility

Allow toggling:

* Tax ID
* Customer phone
* Customer email
* Shipping address
* Payment terms
* Due date
* Notes
* Discount
* Tax
* Shipping
* Footer
* Payment button

Changes should immediately appear in preview.

---

# 14. Invoice Templates

Provide several professionally designed templates.

At minimum:

1. Minimal
2. Modern
3. Corporate
4. Elegant
5. Compact
6. Bold
7. Professional

The user can switch templates without losing invoice data.

Template switching should only change the presentation layer.

---

# 15. Custom Logo

Allow users to upload their own logo.

Use Supabase Storage.

Suggested structure:

```text
logos/
  user_id/
    logo.png
```

Ensure users cannot access or overwrite another user's private files.

Use Supabase Storage policies.

---

# 16. Notes and Terms

Provide separate fields:

### Notes

Example:

```text
Thank you for your business.
```

### Terms & Conditions

Example:

```text
Payment is due within 30 days.
```

Both should appear on the invoice if enabled.

---

# 17. Payment Button

Invoices should optionally contain a:

## Pay Now

button.

The customer should be able to click the button and pay the invoice online.

IMPORTANT:

Do not build a fake payment processor.

Implement payment provider architecture so real payment providers can be connected securely.

Support:

### PayPal

Use PayPal Checkout / Orders API.

### Card payments

Use a provider such as Stripe Checkout.

The payment process should look like:

```text
Invoice
↓
Pay Now
↓
Secure Checkout
↓
Payment Provider
↓
Payment Successful
↓
Return to Invoice
↓
Invoice marked Paid
```

Do not store:

* Card numbers
* CVV
* Card passwords
* Sensitive payment credentials

Payment providers must handle payment information.

---

# 18. Test Payment Mode

Create a clearly labeled:

## Test Mode

for development.

Add test configuration fields such as:

```env
PAYMENT_MODE=test

STRIPE_TEST_SECRET_KEY=
STRIPE_TEST_PUBLISHABLE_KEY=

PAYPAL_TEST_CLIENT_ID=
PAYPAL_TEST_CLIENT_SECRET=
```

Never expose secret payment keys to the frontend.

Provide a test invoice payment flow.

The UI should clearly display:

```text
TEST MODE
```

when enabled.

Do not pretend a test payment is a real payment.

---

# 19. Payment Status

Invoices should support:

* Unpaid
* Pending
* Paid
* Partially Paid
* Overdue
* Cancelled

When a payment provider confirms payment, update the invoice using a secure server-side webhook.

Never mark an invoice as paid based only on a browser redirect.

Use webhook verification.

---

# 20. Payment Link

Every invoice can optionally have a unique payment URL.

Example:

```text
/pay/invoice/[secure-token]
```

The public invoice payment page should show:

* Business logo
* Business name
* Customer-facing invoice
* Invoice number
* Items
* Total
* Amount due
* Pay Now button

The public payment URL must not expose database IDs unnecessarily.

Use secure random tokens.

---

# 21. Public Invoice

Allow the invoice owner to generate a shareable invoice link.

Example:

```text
Share Invoice
```

Buttons:

* Copy link
* Open link
* Download PDF
* Pay Now

The public invoice should not require login.

However, sensitive internal information should never be displayed.

---

# 22. PDF Generation

PDF generation is a critical feature.

Provide:

**Download PDF**

The PDF should closely match the invoice preview.

Also provide:

**Print Invoice**

PDF generation should be fast.

Do not create a low-quality screenshot of the invoice.

Generate a proper printable document.

Support:

* A4
* Letter

Use clean page breaks.

If an invoice has many items, automatically create additional pages.

Repeat the invoice table header on every page.

Keep totals together when possible.

---

# 23. Email Invoice

Prepare the architecture for:

**Send Invoice**

The user enters the customer's email.

Send:

* Invoice email
* Invoice PDF
* Secure invoice link
* Payment link if enabled

Do not hard-code an email provider.

Create an email service abstraction so providers such as Resend, SendGrid, or SMTP can be added later.

---

# 24. Invoice Database

Create Supabase tables approximately like:

```text
profiles
invoices
invoice_items
customers
invoice_templates
business_settings
payment_transactions
```

Suggested invoice structure:

```text
invoices
---------
id
user_id
invoice_number
invoice_type
customer_id
status
payment_status
currency
invoice_date
due_date
subtotal
discount
tax
shipping
total
amount_paid
amount_due
notes
terms
template
design_settings
payment_enabled
payment_provider
payment_url
public_token
created_at
updated_at
```

Invoice items:

```text
invoice_items
-------------
id
invoice_id
description
quantity
unit_price
discount
tax
total
sort_order
created_at
```

Use proper foreign keys.

Use indexes on:

```text
user_id
invoice_id
invoice_number
public_token
created_at
```

---

# 25. Supabase Row Level Security

RLS is mandatory.

Users must only be able to access their own:

* invoices
* customers
* business settings
* templates
* payment records

Example concept:

```sql
user_id = auth.uid()
```

Never rely only on frontend filtering for security.

Create appropriate INSERT, SELECT, UPDATE and DELETE policies.

Storage policies must also isolate users.

---

# 26. Autosave

The editor should automatically save changes.

Do not send a database request after every keystroke.

Use debouncing.

Example:

```text
User types
↓
Wait 500 to 1000ms
↓
Save
```

Show a tiny status:

```text
Saving...
Saved
```

Avoid annoying popups.

If the network temporarily fails:

```text
Unable to save
Retrying...
```

Do not lose invoice data.

---

# 27. Local Draft Protection

Maintain a temporary local draft while editing.

If the browser refreshes unexpectedly, allow recovery.

Example:

```text
We found an unsaved invoice.

Restore draft?
[Restore] [Discard]
```

Clear the draft after successful final save if appropriate.

Do not use localStorage as the permanent database.

---

# 28. Performance

Performance is a major requirement.

The app should feel extremely fast.

Optimize:

* Database queries
* Images
* Fonts
* JavaScript bundle
* Supabase requests
* Invoice preview rendering
* PDF generation
* Dashboard loading

Do not fetch every invoice when only 10 are displayed.

Use pagination.

Avoid unnecessary React re-renders.

Use memoization where appropriate.

Do not reload the entire page after saving.

Use optimistic UI where safe.

---

# 29. Dashboard Search

Allow searching invoices by:

* Invoice number
* Customer name
* Customer email

Filters:

* Status
* Payment status
* Date
* Currency

Sorting:

* Newest
* Oldest
* Highest amount
* Lowest amount

---

# 30. Duplicate Invoice

Add:

**Duplicate**

When clicked:

```text
Original Invoice
↓
Duplicate
↓
Generate new invoice number
↓
Copy items/design/customer
```

The original invoice must remain unchanged.

---

# 31. Invoice Actions

Each invoice should have:

```text
Open
Edit
Duplicate
Download PDF
Print
Share
Send
Delete
```

Delete should require confirmation.

Prefer soft deletion if appropriate.

---

# 32. Settings

Create a Settings page containing:

### Business

* Business name
* Logo
* Contact details
* Address
* Tax information

### Invoice

* Default currency
* Default invoice template
* Invoice prefix
* Starting number
* Default payment terms
* Default notes
* Default terms

### Design

* Default colors
* Default font
* Default layout

### Payments

* Payment providers
* Test/live mode
* Payment settings

### Account

* Email
* Password
* Logout
* Delete account

---

# 33. UI Design

The interface should feel like a modern SaaS product.

Design principles:

* Minimal
* Premium
* Clean
* Fast
* Professional
* Lots of whitespace
* Clear typography
* Subtle borders
* Small radius
* Minimal shadows
* Excellent spacing

Avoid:

* Excessive gradients
* Huge animations
* Clutter
* Excessive cards
* Slow animations
* Unnecessary popups

Use subtle transitions only.

---

# 34. Responsive Design

Desktop:

```text
Sidebar | Main workspace | Invoice preview
```

Tablet:

```text
Editor
Preview
```

Mobile:

```text
Header
Invoice editor
Preview
Actions
```

Make sure invoice preview can be zoomed or viewed comfortably on mobile.

---

# 35. Empty States

Create useful empty states.

Dashboard:

```text
No invoices yet

Create your first invoice in seconds.

[Create Invoice]
```

Customers:

```text
No customers yet
```

---

# 36. Error Handling

Every important operation needs proper error handling.

Handle:

* Supabase unavailable
* Network failure
* Invalid form
* Authentication error
* PDF failure
* Payment failure
* Upload failure
* Database failure
* Session expiration

Never expose raw server errors to users.

Log technical details server-side.

---

# 37. Loading States

Use skeleton loaders where appropriate.

Buttons should show loading states:

```text
Saving...
Generating PDF...
Uploading...
Sending...
Processing payment...
```

Prevent duplicate submissions.

---

# 38. Security

Follow secure development practices.

Never expose:

* Supabase secret key
* Payment secret keys
* Webhook secrets
* API keys

Validate all server-side inputs.

Sanitize user-generated content.

Protect public invoice routes.

Use secure random public tokens.

Use RLS.

Verify payment webhooks.

Do not trust totals coming from the browser.

---

# 39. Database Setup

Provide a complete Supabase SQL migration.

The project should include:

```text
supabase/
  migrations/
    001_initial_schema.sql
```

The SQL should create:

* tables
* indexes
* foreign keys
* RLS
* RLS policies
* storage bucket
* storage policies
* useful database functions if needed

Make the SQL safe to run on a fresh Supabase project.

---

# 40. Environment Variables

Create:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SECRET_KEY=

PAYMENT_MODE=test

STRIPE_TEST_SECRET_KEY=
STRIPE_TEST_PUBLISHABLE_KEY=

PAYPAL_TEST_CLIENT_ID=
PAYPAL_TEST_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
```

Only variables beginning with `NEXT_PUBLIC_` should be exposed to the browser.

---

# 41. Demo/Test Account

Create a development-only test account mechanism.

Do NOT hard-code a real production password into the application.

Instead provide:

```text
TEST_ACCOUNT_EMAIL=
TEST_ACCOUNT_PASSWORD=
```

in a local `.env.local` file or setup script.

Provide a seed/setup script that creates the test account through Supabase Admin APIs.

The test account should have:

* Sample business information
* Sample logo
* 3 sample invoices
* Sample customers
* Different invoice statuses
* One test payment-enabled invoice

Clearly mark this data as demo data.

---

# 42. Demo Invoice Data

Create examples such as:

### Invoice 1

Customer:

```text
Acme Technologies
```

Items:

```text
Website Development
1 × $500
```

Status:

```text
Paid
```

### Invoice 2

Customer:

```text
John Smith
```

Items:

```text
AI Subscription
3 × $20
```

Status:

```text
Pending
```

### Invoice 3

Customer:

```text
Global Solutions
```

Items:

```text
Consulting
10 × $50
```

Status:

```text
Overdue
```

---

# 43. Architecture

Keep the code modular.

Suggested structure:

```text
app/
  login/
  register/
  dashboard/
  invoices/
  invoices/new/
  invoices/[id]/
  customers/
  settings/
  pay/[token]/

components/
  invoice/
  dashboard/
  forms/
  ui/

lib/
  supabase/
  invoice/
  payments/
  pdf/
  validation/

supabase/
  migrations/

types/
```

Keep business logic out of UI components where practical.

---

# 44. Invoice Rendering Engine

Create a reusable invoice renderer.

Example concept:

```tsx
<InvoicePreview
  invoice={invoice}
  design={designSettings}
  template={template}
/>
```

The same renderer should be used for:

* Live preview
* Print
* PDF
* Public invoice

This prevents the preview and PDF from looking different.

---

# 45. Customization State

Store invoice design settings as structured JSON.

Example:

```json
{
  "template": "modern",
  "primaryColor": "#111111",
  "secondaryColor": "#666666",
  "fontFamily": "Inter",
  "headerAlignment": "right",
  "showTax": true,
  "showDiscount": true,
  "showShipping": false,
  "showPaymentButton": true
}
```

Allow new customization options to be added later without changing the entire database schema.

---

# 46. Accessibility

Support:

* Keyboard navigation
* Proper labels
* Focus states
* Accessible buttons
* Screen-reader-friendly forms
* Sufficient contrast

Do not make the UI dependent only on color.

---

# 47. Important UX Detail

The user should be able to create a basic invoice extremely quickly.

The minimum workflow should be:

```text
Login
↓
Create Invoice
↓
Select Invoice Type
↓
Customer
↓
Items
↓
Logo
↓
Design
↓
Preview
↓
Download / Share / Pay
```

Do not force users through unnecessary setup screens.

Business settings should be optional.

---

# 48. Advanced Invoice Editor UX

Use tabs or sections:

```text
General
Customer
Items
Payment
Design
Notes
```

A sticky action bar should contain:

```text
Save
Preview
Download PDF
Share
```

On desktop, keep the invoice preview visible while editing.

---

# 49. Payment Provider Architecture

Create a provider abstraction.

Conceptually:

```ts
interface PaymentProvider {
  createCheckoutSession(invoice): Promise<CheckoutSession>
  verifyPayment(data): Promise<PaymentResult>
  handleWebhook(request): Promise<void>
}
```

Implement:

```text
StripeProvider
PayPalProvider
```

This makes it possible to add additional payment providers later without rewriting invoice logic.

---

# 50. Testing

Before considering the application complete, test:

### Authentication

* Register
* Login
* Logout
* Password reset
* Session persistence

### Invoice

* Create
* Edit
* Delete
* Duplicate
* Autosave
* Reload
* Large invoice
* Multiple pages

### Calculations

Test:

* Tax
* Discounts
* Decimal values
* Large quantities
* Zero values
* Partial payment

### PDF

Test:

* One-page invoice
* Multi-page invoice
* Logo
* Long descriptions
* Different currencies
* Different templates

### Security

Test:

* User A cannot access User B invoices
* User A cannot access User B files
* Public invoice token cannot expose private data
* Secret keys never reach frontend

### Payments

Test:

* Successful test payment
* Failed test payment
* Cancelled checkout
* Webhook
* Duplicate webhook
* Invoice status update

---

# 51. Final Quality Requirements

Do not stop at a prototype.

The final application must have:

* Working authentication
* Working Supabase database
* Working RLS
* Working logo upload
* Working invoice creation
* Working invoice editing
* Working autosave
* Working calculations
* Working templates
* Working customization
* Working PDF download
* Working public invoice
* Working payment architecture
* Working test payment mode
* Working dashboard
* Working responsive UI

Avoid fake buttons.

If a feature is displayed in the UI, either implement it properly or clearly mark it as unavailable.

---

# 52. Development Priority

Build in this order:

### Phase 1

Authentication + Supabase setup

### Phase 2

Dashboard + database

### Phase 3

Invoice creation

### Phase 4

Invoice calculations

### Phase 5

Live invoice preview

### Phase 6

Customization + templates

### Phase 7

Logo upload

### Phase 8

PDF generation

### Phase 9

Public invoice + sharing

### Phase 10

Payment integration with test mode

### Phase 11

Email sending

### Phase 12

Performance optimization + security audit

---

# 53. Important Implementation Rule

Do not sacrifice functionality for visual appearance.

The application should be:

```text
Fast + Reliable + Simple + Professional
```

rather than overloaded with unnecessary features.

The invoice editor and live preview are the core of the application.

Build them exceptionally well.

At the end, provide:

1. Complete project
2. Supabase SQL migration
3. `.env.example`
4. Test account setup instructions
5. Payment test setup instructions
6. Local development instructions
7. Production deployment instructions
8. Security checklist
9. List of implemented features
10. List of anything that still requires external credentials

Do not expose any secret credentials in frontend code or source-controlled files.
