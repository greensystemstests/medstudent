# Stripe Checkout integration: remaining steps

StudyBg takes the €180 Admissions Gateway payment with Stripe's **embedded Checkout form**
(`ui_mode: "form"`). On step 8 the applicant signs in, the application is saved and locked, the server
creates a Checkout Session, and Stripe's payment form appears **on our page** (it runs in a Stripe iframe,
so card details never touch our server).

Checkout stays **off** until `CHECKOUT_ENABLED=true` and `LEGAL_APPROVED=true` are set on Render (see
[RELEASE.md](RELEASE.md)). Nothing in this change turns payments on.

> **Access check before going live.** In Stripe's SDK the embedded *form* (`ui_mode: "form"` and
> `stripe.initCheckoutFormSdk`) is marked as needing beta access. If your Stripe account isn't enabled for it,
> the first payment attempt fails when the session is created. Test with the steps below, or ask
> https://support.stripe.com to enable it. No call to the real Stripe API has been made from this repository.

## Values to Replace

None of the sample placeholders were left in the code. Both `sample_only` parameters already had real
values that fit this app, so they were kept:

**Files containing these values:**
- [server/workflow.js](server/workflow.js) (`createHostedCheckout`)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `payment` | Correct as is: the €180 Admissions Gateway is a one-time charge, not a subscription. |
| line_items | One item built from `price_data`: "StudyBg Admissions Gateway", €180.00 EUR (from [server/pricing.js](server/pricing.js)) | Optional. The server stays the source of truth for the price. To use a Price from the Stripe Dashboard instead (for reporting), create a one-time €180 EUR Price and replace `price_data` with `price: "price_..."`. |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [server/workflow.js](server/workflow.js) (`createHostedCheckout`)
- [server/app.test.js](server/app.test.js) (a test checks every value below)
- [src/components/CheckoutForm.tsx](src/components/CheckoutForm.tsx) (appearance, layout)

| Parameter | Value |
|-----------|-------|
| ui_mode | `form` (installed `stripe` SDK 22.6.2 defaults to API version `2026-08-26.dahlia`, later than the required `2026-03-25.dahlia`) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| submit_type | `auto` |
| name_collection | `{ individual: { enabled: true, optional: true } }` |
| saved_payment_method_options | `{ payment_method_save: "enabled" }` |
| integration_identifier | `custom_embedded_web_0001` |
| payment_method_collection | Not sent: it only applies to `subscription` mode, and this is `payment` mode. |
| Appearance (client) | theme `stripe`, labels `auto`, inputs `spaced`, `colorPrimary #0570de`, `borderRadius 4px`, `fontSizeBase 16px`, `spacingUnit 4px` (and the other variables from Checkout Studio) |
| Layout (client) | `expanded` |

Parameters from the earlier hosted-page setup that are **no longer sent**, because they aren't part of
this configuration: `origin_context`, `allow_promotion_codes`, `success_url`, `cancel_url`.

Other parameters the integration adds so the payment links back to the application:

| Parameter | Value | Why |
|-----------|-------|-----|
| customer_email | The signed-in applicant's email | Prefills the form; must match the application. |
| customer_creation | `always` | Gives Stripe a Customer to save the card to, which `payment_method_save: enabled` needs. |
| client_reference_id | Application id | Find the application from the Stripe Dashboard. |
| metadata, payment_intent_data.metadata | Applicant, programme, university, call slot, `source: studybg-wizard` | The invoice and email pipeline reads these from the PaymentIntent. |
| payment_intent_data.receipt_email, description | Applicant email, "StudyBg onboarding: …" | Same as before. |

## Setup

### Environment variables (Render → studybg-api → Environment)

| Variable | Status |
|----------|--------|
| `STRIPE_SECRET_KEY` | Server only; never prefix it with `VITE_`. |
| `STRIPE_PUBLISHABLE_KEY` | Must be the same mode (test or live) as the secret key. The server sends it to the browser through `GET /api/config`, so it is **not** a `VITE_` variable. |
| `STRIPE_WEBHOOK_SECRET` | **Needed.** From the webhook endpoint below. Without it, checkout stays unavailable. |
| `RESEND_API_KEY`, `INVOICE_FROM_EMAIL`, `SALE_NOTIFICATION_EMAIL` | `INVOICE_FROM_EMAIL` must use a domain verified in Resend. |
| `SITE_URL` | Public site address (default `https://studybg.ac`), used in email links. |
| `COMPANY_LEGAL_NAME`, `COMPANY_EIK`, `COMPANY_ADDRESS`, `COMPANY_CITY`, `COMPANY_VAT_NUMBER`, `SUPPORT_EMAIL` | **Needed** (company details weren't provided). |
| `FILE_ENCRYPTION_KEY` | Any long random string. Never change it later, or stored documents become unreadable. |
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

### Stripe.js

Loaded from `https://js.stripe.com/dahlia/stripe.js` (never bundled or self-hosted) by
[src/components/CheckoutForm.tsx](src/components/CheckoutForm.tsx), **only when the applicant reaches the
payment form**, not on every page. It uses `@stripe/stripe-js/pure` for that: the package's main entry
would load Stripe.js on every page.

## Files

- [server/workflow.js](server/workflow.js): `createHostedCheckout` creates the Checkout Session (and closes a leftover hosted-page session without a `client_secret`); `settleCheckoutSession` links the paid session's PaymentIntent to the application and records the payment.
- [server/app.js](server/app.js): `POST /api/checkout-session` returns `{ sessionId, client_secret }`; `GET /api/checkout-session/:id` confirms with Stripe; the `checkout.session.*` webhook events.
- [server/db.js](server/db.js): the `checkout_session_id` column.
- [src/components/CheckoutForm.tsx](src/components/CheckoutForm.tsx): loads Stripe.js, initialises the form SDK, mounts the form in `#checkout-form`, handles `confirm`.
- [src/components/PaymentStep.tsx](src/components/PaymentStep.tsx): "Continue to payment" saves the application, creates the session and shows the form.
- [src/App.tsx](src/App.tsx), [src/lib/api.ts](src/lib/api.ts): the return to `/apply/?checkout=success&session_id=…` and the server check.
- [server/app.test.js](server/app.test.js): tests for the Checkout Studio settings, price, locking, settlement and reopening.

## How it works

1. On step 8 the applicant signs in and selects **Continue to payment**.
2. The site saves the application. `POST /api/checkout-session` checks the session, the saved version and the terms version, records the consent snapshot, locks the form, and creates (or reuses) the Checkout Session, one per application attempt with an idempotency key. It returns `client_secret`.
3. Stripe's form appears in the payment card. The applicant pays.
4. `confirm` runs with `redirect: "if_required"` and a return URL of `/apply/?checkout=success&session_id=…`. Cards that need no bank redirect finish in place; the page then goes to the return URL, and bank-redirect methods land there on their own.
5. **Paid:** the return page calls `GET /api/checkout-session/:id`, and Stripe also sends `checkout.session.completed`. Whichever arrives first links the PaymentIntent to the application and runs `recordPayment`: application marked paid, one invoice, receipt email and sale email. Repeats are harmless.
6. **Declined:** Stripe's message shows under the form; nothing is recorded and the applicant can try again.
7. **Editing after payment started:** "Cancel checkout & edit" in My Account expires the open session first, so an old form can't be paid.

The older embedded card endpoint (`POST /api/payment-intent`) is still on the server but the site no longer
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
2. A declined card: the form shows the error; nothing recorded.
3. A 3D Secure card: the bank step completes and you land on the confirmation page.
4. Reload while the form is open: **Continue to payment** shows the same session again.
5. Resend the `checkout.session.completed` event from the Dashboard: still exactly one invoice.

Checks already run on this branch: 42/42 API tests (PostgreSQL 16, 0 skipped) and a browser run against a
**stand-in for Stripe.js** (paid, declined then paid, reload, phone width; axe 0 violations). The stand-in
checks this repository's wiring, not Stripe's form.

## Next steps

- Send the company details so the legal pages, invoices and footer can be completed.
- Make sure the Stripe account has access to the embedded form (see the access check at the top).
- Add `STRIPE_WEBHOOK_SECRET` and the `COMPANY_*` variables on Render.
- Test-mode run as above, then switch to live keys and a live webhook secret, then set `CHECKOUT_ENABLED` and `LEGAL_APPROVED` to `true`.
- Optional: remove the unused `@stripe/react-stripe-js` package.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
