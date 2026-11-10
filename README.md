# StudyBg – Medical Gateway

Guidance and admissions platform for English-taught Medicine, Dentistry and Pharmacy degrees in Bulgaria:
a public marketing site, an 8-step application wizard that ends in a €180 Stripe payment, and (in demo
mode) a sample student portal and staff operations view.

## Architecture

| Part | What | Hosted on |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind (`src/`) | GitHub Pages → `studybg.ac` |
| API (accounts, payments, invoices) | Express + Stripe (`server/`) | Supabase Edge Function + Postgres, see [SUPABASE.md](SUPABASE.md) |

The browser never holds the Stripe secret key and never decides the amount. The API:

- `GET  /api/config`: publishable key + the fixed fee (€180.00 EUR)
- `POST /api/payment-intent`: requires a verified session and a server-saved application version. Reserves and creates an immutable €180 PaymentIntent with a stable idempotency key. Cancel the unpaid checkout from My Account before editing.
- `GET  /api/payment-intent/:id?applicationId=…`: asks Stripe whether the payment really succeeded. The wizard only unlocks the confirmation page on this answer.
- `POST /api/checkout-session`: same checks as above, but returns the `client_secret` of a Stripe **Checkout Session** (`ui_mode: form`). The payment step shows Stripe's embedded payment form with it, and Stripe returns the browser to `/apply/?checkout=success&session_id=…`. This is the flow the site uses. See [STRIPE_INTEGRATION_TODO.md](STRIPE_INTEGRATION_TODO.md).
- `GET  /api/checkout-session/:id?applicationId=…`: used by the return page; asks Stripe whether the session was paid and records it (same as the webhook, whichever comes first).
- `POST /api/stripe/webhook`: verified Stripe events (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`), logged to the service logs. On a successful payment this is also where the invoice and emails below are triggered — the API never trusts the browser to say "I paid," only this signed, server-to-server event.

### Invoices & receipt emails

Every successful payment automatically gets:

- **A PDF invoice/receipt** (`server/invoice.js`), bilingual (Czech/English), with a gap-free sequential
  number, the company's legal details, the applicant's details, and the €180.00 VAT-inclusive total split into net and
  21% VAT (the VAT is also stated in CZK at the Czech National Bank rate).
- **Emailed to the applicant** as an attachment, via [Resend](https://resend.com).
- **A "New sale" email to you** (`SALE_NOTIFICATION_EMAIL`) with the amount, applicant and call slot.

Invoice numbering, immutable invoice PDFs and per-recipient retry jobs are stored in Postgres (`server/billing.js`). Signed webhooks acknowledge payment only after the ledger and jobs commit. The in-process dispatcher checks pending jobs every 30 seconds while the service is awake. Provider errors stay pending; accepted messages record their provider ID. An ambiguous attempt older than 23 hours requires manual provider reconciliation rather than automatic retry. “Accepted” is not proof of inbox delivery. The existing Redis resource is retained but is no longer used for this ledger.

**This is not a substitute for advice from a Bulgarian accountant.** The PDF is built to look like standard
Bulgarian invoicing software output, but whether it fully satisfies your specific registration (VAT status,
any e-invoicing/SAF-T obligations) needs sign-off from your accountant before you rely on it for filing.

### Student accounts & documents (`#/account`)

Students sign in with just their email: we email a 6-digit code (valid 10 minutes, 5 tries, one at a time),
no passwords. Once signed in they get a profile, in the same look as the rest of the site, with three tabs:

- **Overview**: their paid application(s) (read from Postgres, with Stripe lookup for older payments) and a checklist of the 5 required
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

Every page has its own address and is pre-rendered to `dist/<path>/index.html` at build time
(`scripts/prerender.mjs`), so search engines and AI crawlers that don't run JavaScript still get the full
page. Old `#/…` links (e.g. `/#/apply`) keep working and are rewritten to the new address.

| Page | URL | Indexed |
|---|---|---|
| Public site (free eligibility check, university comparison, €180 Admissions Gateway) | `/` | yes |
| Guide: how to study medicine in Bulgaria in English | `/study-medicine-in-bulgaria/` | yes |
| The four universities compared | `/universities/` | yes |
| One page per university | `/universities/medical-university-of-sofia/` (also `-plovdiv`, `-varna`, `-pleven`) | yes |
| Admissions calendar | `/admissions-calendar/` | yes |
| Privacy Policy · Terms & Conditions · GDPR · Accessibility Statement | `/privacy/`, `/terms/`, `/gdpr/`, `/accessibility/` | yes |
| Application (8 steps + payment) | `/apply/` | no |
| Student account / sign in | `/account/` | no |
| Real staff review (allowlisted accounts only) | `/review/` | no |
| Account preview with sample data (no sign-in) | `/account/?demo=1` | no |
| Sample student portal / staff ops (demo) | `/portal-demo/?demo=1`, `/staff-demo/?demo=1` | no |
| Anything else | `404.html` (real 404 status) | no |

## SEO

- Per-page `<title>`, description, canonical (always `https://studybg.ac/…`), Open Graph/Twitter tags and
  schema.org JSON-LD (Organization, WebSite, Service with the €180 Offer, FAQPage, Article, BreadcrumbList,
  CollegeOrUniversity) come from `src/data/seo.ts`. Page text for the guides lives in `src/data/guides.ts`;
  university facts come only from `shared/admissions.js`, the reviewed official sources.
- `public/robots.txt` allows all crawlers, including AI assistants; `dist/sitemap.xml` is generated from the
  indexable pages; `public/llms.txt` is a plain-text summary for AI tools.
- The Render copy of the site (`*.onrender.com`) sends `X-Robots-Tag: noindex`, so only `studybg.ac` is listed.
- After the first deploy: add `studybg.ac` in Google Search Console and Bing Webmaster Tools (DNS
  verification) and submit `https://studybg.ac/sitemap.xml`.

## Application flow

1. About you & your school → 2. University & intake → 3. Grades & English (university-specific review) →
4. Documents (diploma and transcript now; medical/police certificates only later, if the route needs them) → 5. Entrance exam →
6. Translation help (optional) → 7. Review & request your call → 8. Payment (€180 Admissions Gateway).

Every step is validated before the next one opens, and the stepper can't jump past the first incomplete step.
Progress is saved in the browser (`localStorage`). After signing in, Save online stores the full draft in Postgres with optimistic version checks. My Account lists drafts and submitted applications. Checkout records the accepted policy version and form snapshot.

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

## Going live

Everything about hosting, secrets, the go-live switch and deploying the API is in [SUPABASE.md](SUPABASE.md).
In short: add the secrets in Supabase, point the Stripe webhook at `<API base>/api/stripe/webhook`
(`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`), verify the sender
domain in Resend, test with Stripe's test card, then flip the two `app_settings` switches.

The company that charges and invoices (Plasma Ltd, Czech Republic) is defined in `server/company.js` (invoices) and
`src/data/legal.ts` (legal pages and footer). Update `LEGAL_LAST_UPDATED` and `POLICY_VERSION` (`shared/admissions.js`)
whenever the legal text changes.

Admissions sources and validation live in `shared/admissions.js`. Future exam selection stays advisor-confirmed until verified, dated, university-specific sessions are published. Do not roll old dates forward automatically.

## Release gates and review workflow

See [RELEASE.md](RELEASE.md) for the required release sequence and outstanding operator configuration. `CHECKOUT_ENABLED` and `LEGAL_APPROVED` default to false. Set both only after all prerequisites and matching public policies are verified. `SUPPORT_EMAIL` is required with the approved legal identity. `STAFF_EMAILS` is a comma-separated allowlist; empty denies all staff access.

Staff can inspect submitted forms and encrypted documents, set review states and notes, and queue generic notification emails. Student accounts display document status and review notes. Access and decisions are recorded in the staff audit log. Meeting scheduling, automated permit reminders and provider delivery-event ingestion are not implemented.

`GET /api/health` reports build and feature readiness and checks database connectivity. `GET /api/ready` returns 503 unless the entire checkout prerequisite set is ready. Render should use `/api/health` for liveness; checkout monitoring should use `/api/ready`.
