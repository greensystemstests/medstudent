import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { createApp } from './app.js';
import { connectDb, migrate } from './db.js';
import { fileKeyFromEnv } from './fileCrypto.js';
import { sellerFromEnv } from './invoice.js';
import { connectKv } from './kv.js';
import { sendLoginCodeEmail } from './mail.js';

const DEFAULT_ORIGINS = [
  'https://studybg.ac',
  'https://www.studybg.ac',
  'https://greensystemstests.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim();

if (secretKey && !/^(sk|rk)_(test|live)_/.test(secretKey)) {
  throw new Error('STRIPE_SECRET_KEY must be a Stripe secret (sk_...) or restricted (rk_...) key.');
}
if (publishableKey && !/^pk_(test|live)_/.test(publishableKey)) {
  throw new Error('STRIPE_PUBLISHABLE_KEY must be a Stripe publishable key (pk_...).');
}
if (secretKey && publishableKey && secretKey.includes('_live_') !== publishableKey.includes('_live_')) {
  throw new Error('STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY must both be test keys or both be live keys.');
}

const stripe = secretKey ? new Stripe(secretKey) : null;
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

// Invoicing/email: every piece below is optional individually, but createApp only turns
// invoicing on once all of them are present (see billingReady in app.js).
const kv = connectKv(process.env.REDIS_URL?.trim());
const resendKey = process.env.RESEND_API_KEY?.trim();
const resend = resendKey ? new Resend(resendKey) : null;
const seller = sellerFromEnv(process.env);
const fromEmail = process.env.INVOICE_FROM_EMAIL?.trim();
const startNumber = Math.max(1, Number(process.env.INVOICE_START_NUMBER) || 1);

const billing = { kv, resend, seller, fromEmail, saleNotifyEmail: process.env.SALE_NOTIFICATION_EMAIL?.trim(), invoiceStartNumber: startNumber };

// Accounts: sign-in codes go out by email (same Resend setup as receipts). LOG_LOGIN_CODES=true
// prints them to the server log instead — for local development only, never in production.
const db = connectDb(process.env.DATABASE_URL?.trim());
if (db) await migrate(db);
const fileKey = fileKeyFromEnv(process.env.FILE_ENCRYPTION_KEY?.trim());
const siteUrl = (process.env.SITE_URL?.trim() || 'https://studybg.ac').replace(/\/+$/, '');
const logLoginCodes = process.env.LOG_LOGIN_CODES === 'true';
const deliverCode =
  resend && fromEmail
    ? (email, code) => sendLoginCodeEmail(resend, { from: fromEmail, to: email, code, siteUrl })
    : logLoginCodes
      ? async (email, code) => console.log(`[dev] sign-in code for ${email}: ${code}`)
      : null;

const app = createApp({
  stripe,
  billing,
  accounts: { db, fileKey, deliverCode },
  config: {
    publishableKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    allowedOrigins,
    staticDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'),
  },
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  const stripeMode = !stripe || !publishableKey ? 'NOT CONFIGURED' : secretKey.includes('_live_') ? 'LIVE' : 'test';
  const missing = [!kv && 'REDIS_URL', !resend && 'RESEND_API_KEY', !seller && 'COMPANY_* fields', !fromEmail && 'INVOICE_FROM_EMAIL'].filter(Boolean);
  const billingMode = missing.length ? `NOT CONFIGURED (missing ${missing.join(', ')})` : 'ready';
  const accountMissing = [!db && 'DATABASE_URL', !fileKey && 'FILE_ENCRYPTION_KEY', !deliverCode && 'RESEND_API_KEY + INVOICE_FROM_EMAIL'].filter(Boolean);
  const accountsMode = accountMissing.length ? `NOT CONFIGURED (missing ${accountMissing.join(', ')})` : 'ready';
  console.log(`StudyBg API listening on :${port} (Stripe: ${stripeMode}, invoicing/email: ${billingMode}, accounts: ${accountsMode})`);
});
