import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { mountAccountRoutes } from './accountRoutes.js';
import { formatMoney, renderInvoicePdf } from './invoice.js';
import { isInvoiceSent, markInvoiceSent, reserveInvoiceNumber, saveInvoiceRecord } from './kv.js';
import { sendReceiptEmail, sendSaleNotification } from './mail.js';
import { ONBOARDING_FEE, PAYMENT_SOURCE } from './pricing.js';
import { rateLimit } from './rateLimit.js';

export { ONBOARDING_FEE };

const APPLICATION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const PAYMENT_INTENT_ID_RE = /^pi_[A-Za-z0-9]{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UPDATABLE_STATUSES = new Set(['requires_payment_method', 'requires_confirmation']);

const clean = (value, max = 200) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';

/** Validates the checkout request body and builds the Stripe params from it. */
export function buildPaymentIntentParams(body) {
  const applicationId = clean(body?.applicationId, 64);
  const applicant = body?.applicant ?? {};
  const fullName = clean(applicant.fullName, 120);
  const email = clean(applicant.email, 200).toLowerCase();

  const errors = [];
  if (!APPLICATION_ID_RE.test(applicationId)) errors.push('applicationId is invalid');
  if (fullName.length < 2) errors.push('applicant.fullName is required');
  if (!EMAIL_RE.test(email)) errors.push('applicant.email is invalid');
  if (errors.length) return { errors };

  const university = clean(applicant.university);
  const degree = clean(applicant.degree, 40);

  // Metadata is what staff see in the Stripe Dashboard for each payment.
  const metadata = {
    source: PAYMENT_SOURCE,
    application_id: applicationId,
    applicant_name: fullName,
    applicant_email: email,
    applicant_phone: clean(applicant.phone, 40),
    citizenship: clean(applicant.citizenship, 80),
    degree,
    university,
    intake: clean(applicant.intake, 80),
    exam_session: clean(applicant.examSession, 80),
    call_date: clean(applicant.callDate, 40),
    call_window: clean(applicant.callWindow, 80),
    call_timezone: clean(applicant.callTimezone, 80),
  };

  return {
    applicationId,
    params: {
      description: `StudyBg onboarding & advisory fee: ${degree || 'Degree'} at ${university || 'university TBC'} (${fullName})`,
      receipt_email: email,
      metadata,
    },
  };
}

/** The subset of a PaymentIntent that is safe and useful to send to the browser. */
function describeIntent(intent) {
  const paid =
    intent.status === 'succeeded' &&
    intent.amount === ONBOARDING_FEE.amount &&
    intent.currency === ONBOARDING_FEE.currency;
  return {
    paymentIntentId: intent.id,
    status: intent.status,
    paid,
    amount: intent.amount,
    currency: intent.currency,
    receiptRef: intent.id.slice(-10).toUpperCase(),
    createdAt: new Date(intent.created * 1000).toISOString(),
  };
}

function isOurs(intent, applicationId) {
  return intent?.metadata?.source === PAYMENT_SOURCE && intent.metadata.application_id === applicationId;
}

/**
 * Builds the applicant/university-facing bits an invoice or sale-notification email needs
 * out of a PaymentIntent's metadata (see buildPaymentIntentParams above for what's in it).
 */
function applicantFromIntent(intent) {
  const md = intent.metadata || {};
  return {
    name: md.applicant_name || 'Applicant',
    email: md.applicant_email,
    degree: md.degree || '—',
    university: md.university || '—',
    callDate: md.call_date || '—',
    callWindow: md.call_window || '—',
  };
}

/**
 * Issues the sequential invoice PDF and emails it to the payer, plus a sale notification to
 * the business inbox. Safe to call more than once for the same PaymentIntent (Stripe redelivers
 * webhooks): the invoice number is assigned at most once, and the emails are sent at most once,
 * tracked separately so a failure between the two (e.g. PDF renders but the email send fails)
 * is retried on the next delivery instead of silently skipped or double-sent.
 */
async function issueInvoiceAndNotify(intent, billing, log) {
  if (await isInvoiceSent(billing.kv, intent.id)) return;

  const number = await reserveInvoiceNumber(billing.kv, intent.id, billing.invoiceStartNumber);
  const invoiceNumber = String(number).padStart(10, '0');
  const applicant = applicantFromIntent(intent);
  if (!applicant.email) {
    log(`invoice ${invoiceNumber}: PaymentIntent ${intent.id} has no applicant email, skipping.`);
    return;
  }

  const pdfBytes = await renderInvoicePdf({
    invoiceNumber,
    issueDate: new Date(),
    seller: billing.seller,
    buyer: { name: applicant.name, email: applicant.email },
    description: intent.description || 'StudyBg onboarding & advisory fee',
    amountMinor: intent.amount,
    currency: intent.currency,
    paymentRef: intent.id,
  });
  const totalText = formatMoney(intent.amount, intent.currency);

  await saveInvoiceRecord(billing.kv, invoiceNumber, {
    paymentIntentId: intent.id,
    issuedAt: new Date().toISOString(),
    amount: intent.amount,
    currency: intent.currency,
    buyerName: applicant.name,
    buyerEmail: applicant.email,
  });

  await sendReceiptEmail(billing.resend, {
    from: billing.fromEmail,
    to: applicant.email,
    buyerName: applicant.name,
    invoiceNumber,
    totalText,
    pdfBytes,
  });
  if (billing.saleNotifyEmail) {
    await sendSaleNotification(billing.resend, {
      from: billing.fromEmail,
      to: billing.saleNotifyEmail,
      buyerName: applicant.name,
      buyerEmail: applicant.email,
      totalText,
      invoiceNumber,
      applicant,
    });
  }

  // Marked only after both emails succeed, so a failure above is retried (same invoice number) rather than lost.
  await markInvoiceSent(billing.kv, intent.id);
  log(`invoice ${invoiceNumber} emailed for ${intent.id} (${totalText} — ${applicant.email})`);
}

/**
 * @param {object} deps
 * @param {import('stripe').Stripe | null} deps.stripe  null when STRIPE_SECRET_KEY is not configured
 * @param {{ publishableKey?: string, webhookSecret?: string, allowedOrigins: string[], staticDir?: string }} deps.config
 * @param {{ kv: import('ioredis').Redis, resend: import('resend').Resend, seller: object, fromEmail: string, saleNotifyEmail?: string, invoiceStartNumber: number } | null} [deps.billing]
 *   null (or any piece missing) disables invoicing/emails; the webhook still 200s Stripe, just skips them.
 * @param {{ db: import('pg').Pool | null, fileKey: Buffer | null, deliverCode: ((email: string, code: string) => Promise<void>) | null } | null} [deps.accounts]
 *   Accounts (sign-in, profile, documents). null (or any piece missing) makes /api/auth and /api/me answer 503.
 * @param {(line: string) => void} [deps.log]
 */
export function createApp({ stripe, config, billing = null, accounts = null, log = console.log }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const paymentsReady = Boolean(stripe && config.publishableKey);
  const billingReady = Boolean(billing?.kv && billing?.resend && billing?.seller && billing?.fromEmail);
  const notConfigured = (res) =>
    res.status(503).json({ error: 'Payments are not configured on the server yet.' });

  // Webhook must see the raw body for signature verification, so it is mounted before express.json().
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe || !config.webhookSecret) return notConfigured(res);
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.webhookSecret);
    } catch (err) {
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    const intent = event.data?.object;
    const isOurs = (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed')
      && intent?.metadata?.source === PAYMENT_SOURCE;

    if (isOurs) {
      log(JSON.stringify({ event: event.type, paymentIntentId: intent.id, amount: intent.amount, currency: intent.currency, ...intent.metadata }));
    }

    if (isOurs && event.type === 'payment_intent.succeeded') {
      if (!billingReady) {
        log(`invoice/email skipped for ${intent.id}: RESEND_API_KEY / REDIS_URL / COMPANY_* env vars not fully configured.`);
      } else {
        try {
          await issueInvoiceAndNotify(intent, billing, log);
        } catch (err) {
          log(`invoice/email error for ${intent.id}: ${err.message}`);
          // Non-2xx makes Stripe retry this delivery (with backoff, for up to ~3 days) instead
          // of silently losing the receipt on a transient failure (e.g. Resend hiccup).
          return res.status(500).json({ error: 'Failed to process invoice, will retry.' });
        }
      }
    }
    res.json({ received: true });
  });

  app.use(
    '/api',
    cors({
      origin: (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin)),
      methods: ['GET', 'POST', 'DELETE'],
    }),
  );
  app.use('/api', express.json({ limit: '16kb' }));

  const { accountsReady } = mountAccountRoutes(app, {
    db: accounts?.db ?? null,
    fileKey: accounts?.fileKey ?? null,
    deliverCode: accounts?.deliverCode ?? null,
    rateLimits: accounts?.rateLimits,
    stripe,
    log,
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, paymentsReady, billingReady, accountsReady }));

  app.get('/api/config', (_req, res) => {
    if (!paymentsReady) return notConfigured(res);
    res.json({
      publishableKey: config.publishableKey,
      amount: ONBOARDING_FEE.amount,
      currency: ONBOARDING_FEE.currency,
      testMode: config.publishableKey.startsWith('pk_test_'),
    });
  });

  // Creates the PaymentIntent for an application, or refreshes the details on the existing one
  // (e.g. the applicant went back and changed their university) so we never charge twice.
  app.post('/api/payment-intent', rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
    if (!paymentsReady) return notConfigured(res);
    const built = buildPaymentIntentParams(req.body);
    if (built.errors) return res.status(400).json({ error: built.errors.join('; ') });
    const { applicationId, params } = built;

    try {
      const existingId = clean(req.body.paymentIntentId, 80);
      if (PAYMENT_INTENT_ID_RE.test(existingId)) {
        const existing = await stripe.paymentIntents.retrieve(existingId).catch(() => null);
        if (existing && isOurs(existing, applicationId) && existing.status !== 'canceled') {
          const intent = UPDATABLE_STATUSES.has(existing.status)
            ? await stripe.paymentIntents.update(existing.id, params)
            : existing;
          return res.json({ ...describeIntent(intent), clientSecret: intent.client_secret });
        }
      }

      // Identical requests (double clicks, React strict-mode double effects) map to the same intent.
      const idempotencyKey = `studybg-pi-${crypto
        .createHash('sha256')
        .update(JSON.stringify(params))
        .digest('hex')
        .slice(0, 40)}`;
      const intent = await stripe.paymentIntents.create(
        {
          ...params,
          amount: ONBOARDING_FEE.amount,
          currency: ONBOARDING_FEE.currency,
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey },
      );
      res.json({ ...describeIntent(intent), clientSecret: intent.client_secret });
    } catch (err) {
      log(`payment-intent error: ${err.message}`);
      res.status(502).json({ error: 'Could not start the payment. Please try again.' });
    }
  });

  // Source of truth for "has this application paid?": asked of Stripe directly, never taken from the browser.
  app.get('/api/payment-intent/:id', async (req, res) => {
    if (!paymentsReady) return notConfigured(res);
    const id = clean(req.params.id, 80);
    const applicationId = clean(req.query.applicationId, 64);
    if (!PAYMENT_INTENT_ID_RE.test(id) || !APPLICATION_ID_RE.test(applicationId)) {
      return res.status(400).json({ error: 'Invalid payment reference.' });
    }
    try {
      const intent = await stripe.paymentIntents.retrieve(id);
      if (!isOurs(intent, applicationId)) return res.status(404).json({ error: 'Payment not found.' });
      res.json(describeIntent(intent));
    } catch (err) {
      if (err?.statusCode === 404 || err?.code === 'resource_missing') {
        return res.status(404).json({ error: 'Payment not found.' });
      }
      log(`payment status error: ${err.message}`);
      res.status(502).json({ error: 'Could not check the payment status. Please try again.' });
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Optionally serve the built frontend too, so this one service can host the whole site.
  if (config.staticDir && fs.existsSync(path.join(config.staticDir, 'index.html'))) {
    app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(config.staticDir, 'index.html')));
  }

  return app;
}
