# Stripe Checkout integration: remaining steps

StudyBg now takes the €180 Admissions Gateway payment on a **Stripe-hosted Checkout page**. The payment
step saves the application, asks the API for a Checkout Session, and redirects the applicant to Stripe.
Stripe sends them back to the site when they pay or cancel.

Checkout stays **off** until `CHECKOUT_ENABLED=true` and `LEGAL_APPROVED=true` are set on Render (see
[RELEASE.md](RELEASE.md)). Nothing in this change turns payments on.

## Values to Replace

None of the sample placeholders were left in the code. Each `sample_only` parameter was given a real
value that fits this app:

**Files containing these values:**
- [server/workflow.js](server/workflow.js) (`createHostedCheckout`)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `payment` | Correct as is: the €180 Admissions Gateway is a one-time charge, not a subscription. |
| success_url | `${SITE_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#/apply` | Nothing to change if `SITE_URL` on Render is the address of the public site (default `https://studybg.ac`). Keep `{CHECKOUT_SESSION_ID}`; the return page uses it. |
| cancel_url | `${SITE_URL}/?checkout=cancel#/apply` | Nothing to change if `SITE_URL` is correct. |
| line_items | One item built from `price_data`: "StudyBg Admissions Gateway", €180.00 EUR (from [server/pricing.js](server/pricing.js)) | Optional. The server stays the source of truth for the price. To use a Price from the Stripe Dashboard instead (for reporting), create a one-time €180 EUR Price and replace `price_data` with `price: "price_..."`. |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [server/workflow.js](server/workflow.js) (`createHostedCheckout`)
- [server/app.test.js](server/app.test.js) (tests that check every value below)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` (installed `stripe` SDK is 22.6.2, which is 21.0.0 or later) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: true }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| submit_type | `auto` |
| saved_payment_method_options | `{ payment_method_save: "enabled" }` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |
| payment_method_collection | Not sent: it only applies to `subscription` mode, and this is `payment` mode. |

Other parameters the integration adds so the payment links back to the application:

| Parameter | Value | Why |
|-----------|-------|-----|
| customer_email | The signed-in applicant's email | Prefills Checkout; must match the application. |
| customer_creation | `always` | Gives Stripe a Customer to save the card to, which `payment_method_save: enabled` needs. |
| client_reference_id | Application id | Find the application from the Stripe Dashboard. |
| metadata, payment_intent_data.metadata | Applicant, programme, university, call slot, `source: studybg-wizard` | The existing invoice and email pipeline reads these from the PaymentIntent. |
| payment_intent_data.receipt_email, description | Applicant email, "StudyBg onboarding: …" | Same as before. |

## Setup

### Environment variables (Render → studybg-api → Environment)

| Variable | Status |
|----------|--------|
| `STRIPE_SECRET_KEY` | You said this is set. Server only; never prefix it with `VITE_`. |
| `STRIPE_PUBLISHABLE_KEY` | You said this is set. Must be the same mode (test or live) as the secret key. The browser no longer loads Stripe.js; the API still reports test mode from this key. |
| `STRIPE_WEBHOOK_SECRET` | **Needed.** From the webhook endpoint below. Without it, checkout stays unavailable. |
| `RESEND_API_KEY`, `INVOICE_FROM_EMAIL`, `SALE_NOTIFICATION_EMAIL` | You said Resend is set. `INVOICE_FROM_EMAIL` must use a domain verified in Resend. |
| `SITE_URL` | Public site address used in the return URLs. Default `https://studybg.ac`. |
| `COMPANY_LEGAL_NAME`, `COMPANY_EIK`, `COMPANY_ADDRESS`, `COMPANY_CITY`, `COMPANY_VAT_NUMBER`, `SUPPORT_EMAIL` | **Needed** (company details weren't included in the message). |
| `CHECKOUT_ENABLED`, `LEGAL_APPROVED` | Leave `false` until the test run below passes and the legal pages are approved. |

### Stripe webhook (Dashboard → Developers → Webhooks)

Endpoint: `https://studybg-api.onrender.com/api/stripe/webhook`. Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

### Database

On start, the server adds one nullable column, `applications.checkout_session_id`
(`ADD COLUMN IF NOT EXISTS`). Nothing is dropped or rewritten.

## Files changed

No new server files. Changes:

- [server/workflow.js](server/workflow.js): `createHostedCheckout` (creates the Checkout Session), `settleCheckoutSession` (links the paid session's PaymentIntent to the application and records the payment), shared lock/reservation helpers, and reopen now expires an open session.
- [server/app.js](server/app.js): `POST /api/checkout-session`, `GET /api/checkout-session/:id`, and the `checkout.session.*` webhook events.
- [server/db.js](server/db.js): the `checkout_session_id` column.
- [server/index.js](server/index.js): passes `SITE_URL` to the app.
- [src/components/PaymentStep.tsx](src/components/PaymentStep.tsx): "Pay €180.00 on Stripe" button that redirects; the embedded card form was removed.
- [src/App.tsx](src/App.tsx), [src/components/WizardView.tsx](src/components/WizardView.tsx), [src/lib/api.ts](src/lib/api.ts): handle the return from Stripe (paid, waiting for confirmation, or cancelled).
- [server/app.test.js](server/app.test.js): three tests for the hosted flow.

## How it works

1. On step 8 the applicant signs in and selects **Pay €180.00 on Stripe**.
2. The site saves the application. `POST /api/checkout-session` checks the session, the saved version and the terms version, records the consent snapshot, locks the form, and creates the Checkout Session (one per application attempt, with an idempotency key).
3. The browser goes to the Stripe page. The applicant pays, or cancels.
4. **Paid:** Stripe redirects to `?checkout=success&session_id=…`. The return page calls `GET /api/checkout-session/:id`, and Stripe also sends `checkout.session.completed`. Whichever arrives first links the PaymentIntent to the application and runs the existing `recordPayment`: application marked paid, one invoice, receipt email and sale email. Repeats are harmless.
5. **Cancelled:** back on step 8 with "Nothing was charged"; the applicant can try again (the same open session is reused).
6. **Editing after checkout started:** "Cancel checkout & edit" in My Account expires the open Stripe session first, so an old page can't be paid.

The older embedded endpoint (`POST /api/payment-intent`) is still on the server but the site no longer
calls it, and it refuses applications that already have a Checkout Session.

## Testing

Use **test** keys on Render first (`sk_test_…`, `pk_test_…`).

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |

Any future expiry, any CVC, any postcode. Run through:

1. A successful payment: confirmation page, application shows **Paid, waiting for review** in My Account, one invoice, receipt email to the applicant, sale email to you.
2. A declined card: Stripe shows the error; nothing recorded.
3. Cancel on the Stripe page: back on step 8, nothing charged.
4. Resend the `checkout.session.completed` event from the Dashboard: still exactly one invoice.

Local checks already run on this branch: 36/36 API tests (PostgreSQL 16, 0 skipped) and a browser round trip against a fake Stripe (paid, paid with a late webhook, cancelled).

## Next steps

- Send the company details so the legal pages, invoices and footer can be completed.
- Add `STRIPE_WEBHOOK_SECRET` and the `COMPANY_*` variables on Render.
- Test-mode run as above, then switch to live keys and a live webhook secret, then set `CHECKOUT_ENABLED` and `LEGAL_APPROVED` to `true`.
- Optional: brand the Checkout page (Dashboard → Settings → Branding: logo, colour `#006644`), and remove the now-unused `@stripe/react-stripe-js` and `@stripe/stripe-js` packages.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
