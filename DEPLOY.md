# Deploying to Vercel

Everything here is prepared. You need to supply three things: a GitHub repo, the
env vars, and the production domain. Nothing else.

## 0. Before you start

**Rotate the secret key you pasted into chat.** Supabase → Project Settings → API Keys →
**Reset**. Then use the new value in step 3. The old one is in a chat log and should be treated
as compromised.

Run the pre-deploy gate:

```bash
npm run check:secrets    # fails if any secret is in .next, the client bundle, or a source file
```

## 1. Push the code

```bash
git init
git add .
git status              # confirm .env.local and .next are NOT listed
git commit -m "Invoice generator"
```

Create an empty repo on GitHub, then:

```bash
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`git status` must not list `.env.local`, `.env` or `.next` — they are git-ignored, but check.

## 2. Import into Vercel

1. <https://vercel.com/new> → pick the GitHub repo → **Framework: Next.js** (auto-detected)
2. Leave Build/Output settings alone (`npm run build`, default output)
3. **Deploy** — it will build. It will fail at runtime until you add the env vars below.

## 3. Environment variables

Vercel → your project → **Settings → Environment Variables**. Add for **Production** (and
**Preview** if you want previews working):

| Name | Value | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ayuzkbjywyzryotwnbpk.supabase.co` | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_B8qGs-…` (the publishable one) | yes |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` (from step 4) | yes |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` (**the new one**) | yes |
| `PAYMENT_MODE` | `test` (or `live`) | yes |
| `EMAIL_PROVIDER` | `console` (or `resend`) | yes |
| `EMAIL_FROM` | `"Your Business <billing@yourdomain.com>"` | recommended |
| `STRIPE_TEST_SECRET_KEY` | `sk_test_…` | for Stripe |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | for Stripe |
| `PAYPAL_TEST_CLIENT_ID` / `PAYPAL_TEST_CLIENT_SECRET` | from the PayPal sandbox app | for PayPal |
| `PAYPAL_WEBHOOK_ID` | from the PayPal app | for PayPal |
| `RESEND_API_KEY` | `re_…` | for real email |

`NEXT_PUBLIC_APP_URL` is optional — without it the app falls back to `VERCEL_URL`, so share and
payment links still work on a `*.vercel.app` domain. Set it explicitly once you have your own
domain.

Redeploy after adding variables: **Deployments → ⋮ → Redeploy**. Env vars are read at build
time for `NEXT_PUBLIC_*`.

## 4. Point Supabase at your domain

This is the step people miss, and login breaks without it.

Supabase → **Authentication → URL Configuration**:

- **Site URL** → `https://<your-domain>`
- **Redirect URLs** → add:
  ```
  https://<your-domain>/**
  https://*.vercel.app/**
  ```

Then in Vercel → your project → **Settings → Domains**, add your own domain and point the DNS
records Vercel shows you.

## 5. Verify the deployment

```bash
curl https://<your-domain>/api/health
```

Look for `"ok":true` and `"schema":{"ok":true}`. That single call confirms the env vars, the
database schema, the payment providers and the email provider are all wired up.

Then, in the browser:

1. Sign in (if redirect loops back to `/login`, step 4 is wrong)
2. Create an invoice — the preview updates as you type
3. **Download PDF** — the real test of the react-pdf path on Vercel
4. **Share** → open the link in a private window to see the public view without a session

## 6. Webhooks (only if you configure payments)

Register these with the providers, using your production domain:

- Stripe → `https://<your-domain>/api/payments/webhook/stripe`
- PayPal → `https://<your-domain>/api/payments/webhook/paypal`

The exact URLs are also shown in the app under **Settings → Payments**.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Login redirects back to `/login` in a loop | Supabase **Site URL** / **Redirect URLs** not updated (step 4) |
| "Your database is not set up yet" | Missing or wrong `SUPABASE_SECRET_KEY` |
| Share links point at `localhost:3000` | `NEXT_PUBLIC_APP_URL` not set |
| PDF download fails / times out | Large invoice. Vercel Hobby caps serverless functions at 60 s; reduce the item count or upgrade the plan |
| Email not delivered | `EMAIL_PROVIDER=console` only logs to the server. Set `resend` + `RESEND_API_KEY` |
| Pay Now button disabled | No payment provider keys. Settings → Payments names the missing variable |

## Useful Vercel commands (alternative to the dashboard)

```bash
npm i -g vercel
vercel                 # first run: log in, link to a new project
vercel env add NEXT_PUBLIC_APP_URL production
vercel --prod          # deploy
```

The dashboard route is preferred here: it needs no token, and you never have to paste a Vercel
token into a chat.
