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
- `POST /api/stripe/webhook`: verified Stripe events (`payment_intent.succeeded` / `payment_failed`), logged to the service logs.

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

Update `EXAM_SESSIONS` in `src/data/constants.ts` each admission cycle; sessions whose date has passed show as closed.
