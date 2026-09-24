# StudyBg – Medical Gateway

Guidance and admissions platform for English-taught Medicine, Dentistry and Pharmacy degrees in Bulgaria:
a public marketing site, an 8-step application wizard that ends in a €180 Stripe payment, and (in demo
mode) a sample student portal and staff operations view.

## Architecture

| Part | What | Hosted on |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind (`src/`) | GitHub Pages → `studybg.ac` |
| Payments API | Express + Stripe (`server/`) | Render (`render.yaml`) |

The browser never holds the Stripe secret key and never decides the amount. The API:

- `GET  /api/config`: publishable key + the fixed fee (€180.00 EUR)
- `POST /api/payment-intent`: creates the PaymentIntent for an application (or updates the existing one, so an applicant is never charged twice) with the applicant, program and requested call slot as metadata. That metadata shows on each payment in the Stripe Dashboard.
- `GET  /api/payment-intent/:id?applicationId=…`: asks Stripe whether the payment really succeeded. The wizard only unlocks the confirmation page on this answer.
- `POST /api/stripe/webhook`: verified Stripe events (`payment_intent.succeeded` / `payment_failed`), logged to the service logs. On a successful payment this is also where the invoice and emails below are triggered — the API never trusts the browser to say "I paid," only this signed, server-to-server event.

### Invoices & receipt emails

Every successful payment automatically gets:

- **A PDF invoice/receipt** (`server/invoice.js`), bilingual (Bulgarian/English), with a gap-free sequential
  number, your company's legal details, the applicant's details, the €180.00 total, and — if `COMPANY_VAT_NUMBER`
  is set — a VAT breakdown at 20%; otherwise a note that VAT isn't charged (Art. 113(9) ЗДДС).
- **Emailed to the applicant** as an attachment, via [Resend](https://resend.com).
- **A "New sale" email to you** (`SALE_NOTIFICATION_EMAIL`) with the amount, applicant and call slot.

Sequential numbering and "don't send this twice" are handled with a small Render Key Value (Redis) store
(`server/kv.js`), because Stripe can redeliver the same webhook event: the invoice number and the emails are
each assigned/sent at most once per payment, and a failure between the two (PDF made but email failed to send)
is retried on Stripe's next delivery — it never reuses or skips a number.

**This is not a substitute for advice from a Bulgarian accountant.** The PDF is built to look like standard
Bulgarian invoicing software output, but whether it fully satisfies your specific registration (VAT status,
any e-invoicing/SAF-T obligations) needs sign-off from your accountant before you rely on it for filing.

### Student accounts & documents (`#/account`)

Students sign in with just their email: we email a 6-digit code (valid 10 minutes, 5 tries, one at a time),
no passwords. Once signed in they get a profile, in the same look as the rest of the site, with three tabs:

- **Overview**: their paid application(s) (read live from Stripe by email) and a checklist of the 5 required
  documents with a progress bar and one-click "Upload" per missing item.
- **Documents**: upload (pick the type, then drop/choose a PDF, JPG or PNG up to 10 MB), view in-page, download, delete.
- **Activity**: a timeline of everything done with the account (sign-ins, uploads, views, downloads, deletions, payment).

Security:

- Files are encrypted with AES-256-GCM before they're stored in Postgres (`FILE_ENCRYPTION_KEY`). Each file's
  ciphertext is bound to its owner and document id, so a blob copied to another row can't be decrypted.
- File type is checked from the file's actual bytes, not its name. Limits: 10 MB per file, 30 files / 100 MB per student.
- Every document query is scoped to the signed-in user; another user's document id simply returns "not found".
- Only hashes of sign-in codes and session tokens are stored. Sessions last 30 days, and signing out revokes them server-side.
- Files are served with `Cache-Control: no-store`, `nosniff` and a sandboxing CSP.

API: `POST /api/auth/request-code`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/me`,
`GET|POST /api/me/documents`, `GET /api/me/documents/:id/file`, `DELETE /api/me/documents/:id`, `GET /api/me/activity`.

## Pages (URLs)

| Page | URL |
|---|---|
| Public site | `/` |
| Application (8 steps + payment) | `/#/apply` |
| Student account / sign in | `/#/account` |
| Privacy Policy · Terms & Conditions · GDPR Compliance (linked in the footer of every page) | `/#/privacy`, `/#/terms`, `/#/gdpr` |
| Accessibility Statement (footer, and the accessibility button on every page) | `/#/accessibility` |
| Account preview with sample data (no sign-in) | `/?demo=1#/account` |
| Sample student portal / staff ops (demo) | `/?demo=1#/portal-demo`, `/?demo=1#/staff-demo` |

## Application flow

1. Applicant & high school → 2. Faculty & intake → 3. Science grades (≥62% in Biology **and** Chemistry) & English →
4. Documents → 5. Entrance exam → 6. Sworn translation & courier → 7. Review, book the call & consents → 8. Payment.

Every step is validated before the next one opens, and the stepper can't jump past the first incomplete step.
Progress is saved in the browser (`localStorage`).

Demo mode (persona switcher, sample Student Portal and Staff Ops views) is hidden from visitors. Open the site with
`?demo=1` to enable it for that tab, `?demo=0` to turn it off.

## Run locally

```bash
npm install
cp .env.example .env        # add your Stripe TEST keys; for accounts also DATABASE_URL,
                            # FILE_ENCRYPTION_KEY and LOG_LOGIN_CODES=true (codes print to the console)
npm run dev:server          # API on :8787
npm run dev                 # site on :3000 (proxies /api to :8787)
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC. Declined: `4000 0000 0000 0002`.

```bash
npm run lint   # type check
npm test       # API tests (account tests also need TEST_DATABASE_URL=postgres://...; CI provides one)
npm run build
```

## Going live with Stripe

1. **Render → studybg-api → Environment**: set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`
   (test keys first, live keys when ready. Both must be the same mode).
2. **Stripe → Developers → Webhooks**: add endpoint `https://<render-url>/api/stripe/webhook` for
   `payment_intent.succeeded` and `payment_intent.payment_failed`, then set its signing secret as `STRIPE_WEBHOOK_SECRET` on Render.
3. **Stripe → Settings → Customer emails**: turn on receipts for successful payments.
4. The frontend build reads the API address from the `VITE_API_BASE_URL` repository variable
   (GitHub → Settings → Secrets and variables → Actions → Variables); the workflow falls back to the Render URL.

## Turning on invoices & receipt emails

1. **Resend → Domains**: add `studybg.ac`, add the DNS records it gives you (at your domain registrar,
   alongside the GitHub Pages records), wait for it to verify. Then Resend → API Keys → create a key.
2. **Render → studybg-api → Environment**, set:
   - `RESEND_API_KEY` — from step 1
   - `INVOICE_FROM_EMAIL` — e.g. `StudyBg Billing <billing@studybg.ac>` (must be on the verified domain)
   - `SALE_NOTIFICATION_EMAIL` — the inbox that should get a "New sale" email each payment
   - `COMPANY_LEGAL_NAME`, `COMPANY_EIK` (ЕИК/Bulstat), `COMPANY_ADDRESS`, `COMPANY_CITY` — required on every invoice
   - `COMPANY_VAT_NUMBER` — only if VAT-registered; leave empty otherwise
   - `REDIS_URL` is already set for you (linked to the `studybg-invoices` Key Value store)
3. Make a test payment; check the applicant's inbox for the receipt PDF and your own inbox for the sale alert.
   The Render logs also print `invoice <number> emailed for <payment id>` for every one that goes out.

## Turning on student accounts

1. **Render → studybg-db** (Postgres) → *Connections* → copy the **Internal Database URL**.
2. **Render → studybg-api → Environment**, set:
   - `DATABASE_URL`: the URL from step 1
   - `FILE_ENCRYPTION_KEY`: click *Generate*. **Back this value up somewhere safe and never change it**;
     without it, stored documents can't be decrypted.
   - `RESEND_API_KEY` + `INVOICE_FROM_EMAIL`: needed to email sign-in codes (same as for receipts).
3. After the redeploy, `/api/health` shows `"accountsReady": true` and the Render log line says `accounts: ready`.

The company's legal name, ЕИК, address and contact emails shown on the legal pages live in `src/data/legal.ts`.
Fill them in before launch, and update `LEGAL_LAST_UPDATED` whenever the legal text changes.

Update `EXAM_SESSIONS` in `src/data/constants.ts` each admission cycle; sessions whose date has passed show as closed.
