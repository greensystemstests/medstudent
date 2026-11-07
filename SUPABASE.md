# StudyBg on Supabase

The API (everything in `server/`) runs as one **Supabase Edge Function** named `studybg`, with its data in the
**Studybg.ac** project's Postgres (Frankfurt). The website stays on GitHub Pages. Render and Neon are no longer used.

| What | Where |
|---|---|
| API base URL | `https://lexvesszfuqqrateocap.supabase.co/functions/v1/studybg` (baked into the site: `src/lib/apiBase.ts`) |
| Database schema | `supabase/migrations/` (RLS on, public API roles revoked: only the function can read or write) |
| Function code | `supabase/functions/studybg/` (a small Deno wrapper) + `server/` (the Express app, imported from a commit-pinned GitHub URL) |
| Invoice fonts | `server/fonts/`, fetched from the same pinned commit |

## What happens on a payment

1. The applicant signs in (emailed 6-digit code), the application is saved and locked, `POST /api/checkout-session` creates the
   Stripe Checkout Session (embedded form).
2. Stripe calls `POST /api/stripe/webhook` (signature verified). The server records the payment, allocates the next invoice number,
   and queues two emails: the receipt (PDF invoice attached, plus the "Book your call" link) and a sale notice.
3. The browser's return page and the account page ask the server for the payment status. **Only a confirmed, paid, signed-in owner
   receives the invoice summary and the Calendly link**, so the link is not in the public site code.
4. The invoice PDF (Czech/English tax document, 21% VAT included in the €180, VAT also stated in CZK at the ČNB rate) can be
   downloaded from the confirmation page and from the account: `GET /api/me/invoices/:paymentIntentId/pdf`.

## Secrets (Supabase → Edge Functions → Secrets)

Never put these in the repository. Supabase injects `SUPABASE_DB_URL` itself.

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` first, `sk_live_…` at launch |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` (same mode as the secret key) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` of the webhook endpoint that points at the function |
| `RESEND_API_KEY` | Resend API key (needed for sign-in codes, receipts, invoices) |
| `FILE_ENCRYPTION_KEY` | a long random string. **Back it up; never change it** or stored documents become unreadable |

Optional overrides (defaults are in `server/company.js`): `INVOICE_FROM_EMAIL` (default `StudyBg <hello@studybg.ac>`; the domain must
be verified in Resend, while testing use `onboarding@resend.dev`), `SUPPORT_EMAIL`, `SALE_NOTIFICATION_EMAIL`, `BOOKING_URL`,
`STAFF_EMAILS`, `COMPANY_*`, `ALLOWED_ORIGINS`.

## Going live

Payments are off until **both** switches in the `app_settings` table are `true` (and all secrets above are set):

```sql
update app_settings set value = 'true', updated_at = now() where key in ('checkout_enabled', 'legal_approved');
```

Turn them off again the same way with `'false'`. The change takes effect within ~10 seconds, with no redeploy.

## Deploying a new version of the API

1. Merge the change and note the commit SHA.
2. Deploy the function with `index.ts` importing `server/bootstrap.js` from that SHA
   (`https://raw.githubusercontent.com/greensystemstests/medstudent/<SHA>/server/bootstrap.js`).
   In `supabase/functions/studybg/index.ts` the placeholder is `COMMIT_SHA`.
3. Check `GET <API base>/api/health`.

Schema changes go in a new file under `supabase/migrations/` and are applied to the project.

## Background job

`pg_cron` calls `/api/internal/sweep` every minute to retry any email that failed to send. It also keeps the function warm.

## Free-plan limits to know

Supabase pauses free projects after about a week with no activity, and the free database is 500 MB (uploaded documents are stored
encrypted in it). A paid plan removes the pausing.

## Local development

`npm run dev:server` runs the same app on Node against a local Postgres (`DATABASE_URL`, `LOG_LOGIN_CODES=true` prints sign-in codes).
`npm test` needs `TEST_DATABASE_URL` pointing at a disposable `*_test` database.
