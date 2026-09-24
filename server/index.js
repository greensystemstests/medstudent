import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import Stripe from 'stripe';
import { createApp } from './app.js';

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

const app = createApp({
  stripe,
  config: {
    publishableKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    allowedOrigins,
    staticDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'),
  },
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  const mode = !stripe || !publishableKey ? 'NOT CONFIGURED' : secretKey.includes('_live_') ? 'LIVE' : 'test';
  console.log(`StudyBg API listening on :${port} (Stripe: ${mode})`);
});
