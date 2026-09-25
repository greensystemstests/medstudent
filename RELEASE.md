# StudyBg release procedure

Final verification on 25 September 2026 on `codex/studybg-production-readiness`, based on the operator's latest commit `086eb04`. This branch is not deployed. Existing database and Key Value resource plans are unchanged.

## Before merging

1. Apply the supplied patch or project package using your existing authenticated coding environment, then publish a review branch. The Pages workflow now runs tests on `codex/**` branches and pull requests without deploying them.
2. Require the PostgreSQL 16 CI job to pass. The local PGlite test run covers the PostgreSQL schema and API paths but cannot validate independent-session locks. The code-verification and duplicate-webhook/outbox concurrency tests are deliberately reserved for full PostgreSQL.
3. Preview the built frontend with the matching API. Verify keyboard navigation, Quick Fit, pharmacy prefill, all wizard steps, sign-in, Save online, account resume, checkout cancellation, document review and review notes. Recheck at 320px and 200% zoom. Local server rendering is not a substitute for this browser pass.
4. Complete `src/data/legal.ts`, review the policy drafts and service promises, and update `shared/admissions.js` `POLICY_VERSION` when changing accepted terms. Verify consent and the lawful handling of medical/criminal-record documents before allowing real applicants to upload them. Do not treat the generic privacy checkbox as authorization for every sensitive-data use. Finalize retention, deletion/export and incident-handling procedures with the operator.

## Existing Render service

Service: `studybg-api` (`srv-daqf8597lnhs73cq11p0`), workspace Green1. The service was provisioned directly, so editing `render.yaml` does not update its dashboard settings.

- Set health-check path to `/api/health` and auto-deploy trigger to **After CI Checks Pass**. The connected Render operations do not expose these service-setting updates.
- Preserve the existing `DATABASE_URL` and `FILE_ENCRYPTION_KEY`. Never regenerate the file key for an existing document store.
- Configure Stripe secret/publishable keys in matching test/live mode and `STRIPE_WEBHOOK_SECRET` for `/api/stripe/webhook`.
- Configure verified Resend sender credentials, `RESEND_API_KEY`, `INVOICE_FROM_EMAIL`, and the intended `SALE_NOTIFICATION_EMAIL`.
- Complete `COMPANY_LEGAL_NAME`, `COMPANY_EIK`, `COMPANY_ADDRESS`, `COMPANY_CITY`, appropriate `COMPANY_VAT_NUMBER`, and monitored `SUPPORT_EMAIL`. Match the website identity and invoice identity.
- Set `STAFF_EMAILS` to the explicitly authorized reviewers. Empty denies staff access. Reviewers sign in normally, then use `/#/review`.
- Reconcile any historical Redis/manual invoice numbers and set `INVOICE_START_NUMBER` before the new counter is first initialized. Existing Stripe-only applications remain visible through legacy lookup but do not gain missing historical form data.
- Leave `CHECKOUT_ENABLED=false` and `LEGAL_APPROVED=false` until the above is ready. Setting these to true is an operator release decision, not something this patch has approved.

No new paid service is required by this branch. The old Redis service is retained, and no expiry or plan changes are part of this release.

## Release and acceptance

1. Run `npm ci`, `npm run lint`, `npm run test:render`, `TEST_DATABASE_URL=postgres://.../studybg_test npm test`, and `npm run build`. Only use a disposable `_test` database: tests clear its tables.
2. Merge the reviewed branch to `claude/intelligent-curie-jsa86h`. GitHub Pages and Render must deploy the same reviewed commit. Do not manually trigger Render immediately after an auto-deploying push.
3. Verify `/api/health` reports the expected build SHA and feature readiness. `/api/ready` should remain 503 while checkout is intentionally disabled.
4. With operator-controlled test email accounts and Stripe test keys, verify sign-in, server draft persistence, cross-device resume, successful and declined payments, webhook replay, exactly one invoice, per-recipient email retry and staff document review. Confirm inbox delivery in Resend; an API acceptance response alone is not delivery proof.
5. After approval, switch to matching live keys and the live webhook secret, then enable the two release gates. Recheck readiness and monitor failures. Never use a real applicant's personal documents for a smoke test.

## Operational limits and recovery

- The outbox worker runs every 30 seconds only while the free web service is awake. Jobs survive sleep/restarts, but notification timing is not guaranteed. Decide separately whether always-on delivery is needed.
- Invoice and email idempotency are separate. Provider acceptance is recorded; bounce/delivery webhooks are not implemented. Staff can inspect processing failures.
- An uncertain payment create or email attempt beyond the 23-hour retry window is held for manual provider reconciliation. Confirm the external outcome before modifying its database state; do not blindly reset or resend it.
- Real staff review exists. Automated appointment booking, courier booking, residence reminders and the full six-stage operations system remain future work; demo screens are clearly separate.
- Migrations are additive. If rolling back, first disable checkout and retain the new tables/outbox for reconciliation. Rolling code back alone must not discard recorded payments or pending notifications.
