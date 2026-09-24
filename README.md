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
cp .env.example .env        # add your Stripe TEST keys
npm run dev:server          # payments API on :8787
npm run dev                 # site on :3000 (proxies /api to :8787)
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC. Declined: `4000 0000 0000 0002`.

```bash
npm run lint   # type check
npm test       # API tests
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

Update `EXAM_SESSIONS` in `src/data/constants.ts` each admission cycle; sessions whose date has passed show as closed.
