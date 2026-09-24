import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { createApp, ONBOARDING_FEE } from './app.js';

/** In-memory stand-in for the parts of the Stripe SDK the server uses. */
function fakeStripe() {
  const intents = new Map();
  const calls = { create: 0, update: 0 };
  const idempotency = new Map();
  let seq = 0;
  return {
    intents,
    calls,
    paymentIntents: {
      async create(params, opts) {
        calls.create++;
        if (opts?.idempotencyKey && idempotency.has(opts.idempotencyKey)) {
          return intents.get(idempotency.get(opts.idempotencyKey));
        }
        const id = `pi_test${String(++seq).padStart(8, '0')}`;
        const intent = {
          id,
          client_secret: `${id}_secret_abc`,
          status: 'requires_payment_method',
          created: 1_700_000_000,
          ...params,
        };
        intents.set(id, intent);
        if (opts?.idempotencyKey) idempotency.set(opts.idempotencyKey, id);
        return intent;
      },
      async update(id, params) {
        calls.update++;
        const intent = intents.get(id);
        Object.assign(intent, params, { metadata: { ...intent.metadata, ...params.metadata } });
        return intent;
      },
      async retrieve(id) {
        const intent = intents.get(id);
        if (!intent) throw Object.assign(new Error('No such payment_intent'), { statusCode: 404 });
        return intent;
      },
    },
    webhooks: {
      constructEvent(body, signature, secret) {
        if (signature !== `valid:${secret}`) throw new Error('bad signature');
        return JSON.parse(body.toString());
      },
    },
  };
}

const applicant = {
  fullName: 'Lina Haddad',
  email: 'Lina@Example.com',
  phone: '+962 700 000 000',
  citizenship: 'Jordan',
  degree: 'Medicine',
  university: 'Medical University of Sofia',
  callDate: '2026-09-28',
  callWindow: 'Afternoon (14:00-16:00 Sofia time)',
};
const applicationId = 'app-1234567890abcdef';

let server;
let base;
let stripe;
const logs = [];

async function start(configOverrides = {}, stripeClient = fakeStripe()) {
  stripe = stripeClient;
  const app = createApp({
    stripe,
    config: {
      publishableKey: 'pk_test_123',
      webhookSecret: 'whsec_1',
      allowedOrigins: ['https://studybg.ac'],
      ...configOverrides,
    },
    log: (line) => logs.push(line),
  });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
}

function stop() {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
}

const post = (path, body, headers = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('payments API', () => {
  beforeEach(async () => {
    logs.length = 0;
    await start();
  });
  afterEach(stop);

  test('config exposes only the publishable key and the fixed fee', async () => {
    const res = await fetch(`${base}/api/config`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      publishableKey: 'pk_test_123',
      amount: 18000,
      currency: 'eur',
      testMode: true,
    });
  });

  test('creates a €180 intent with applicant metadata, ignoring any client-sent amount', async () => {
    const res = await post('/api/payment-intent', { applicationId, applicant, amount: 1 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.clientSecret, /_secret_/);
    assert.equal(body.paid, false);

    const intent = stripe.intents.get(body.paymentIntentId);
    assert.equal(intent.amount, ONBOARDING_FEE.amount);
    assert.equal(intent.currency, 'eur');
    assert.equal(intent.receipt_email, 'lina@example.com');
    assert.equal(intent.metadata.application_id, applicationId);
    assert.equal(intent.metadata.call_window, applicant.callWindow);
    assert.deepEqual(intent.automatic_payment_methods, { enabled: true });
  });

  test('identical repeated requests reuse one intent', async () => {
    const a = await (await post('/api/payment-intent', { applicationId, applicant })).json();
    const b = await (await post('/api/payment-intent', { applicationId, applicant })).json();
    assert.equal(a.paymentIntentId, b.paymentIntentId);
    assert.equal(stripe.intents.size, 1);
  });

  test('passing the existing intent id updates it instead of creating a second one', async () => {
    const first = await (await post('/api/payment-intent', { applicationId, applicant })).json();
    const changed = { ...applicant, university: 'Medical University of Plovdiv' };
    const second = await (
      await post('/api/payment-intent', { applicationId, applicant: changed, paymentIntentId: first.paymentIntentId })
    ).json();
    assert.equal(second.paymentIntentId, first.paymentIntentId);
    assert.equal(stripe.calls.update, 1);
    assert.equal(stripe.intents.get(first.paymentIntentId).metadata.university, 'Medical University of Plovdiv');
  });

  test("another application's intent id is not reused", async () => {
    const first = await (await post('/api/payment-intent', { applicationId, applicant })).json();
    const other = await (
      await post('/api/payment-intent', {
        applicationId: 'app-otherapplication1',
        applicant,
        paymentIntentId: first.paymentIntentId,
      })
    ).json();
    assert.notEqual(other.paymentIntentId, first.paymentIntentId);
    assert.equal(stripe.calls.update, 0);
  });

  test('rejects missing applicant details', async () => {
    const res = await post('/api/payment-intent', { applicationId, applicant: { fullName: '', email: 'nope' } });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /fullName.*email/);
  });

  test('status is only "paid" when Stripe says succeeded for the right amount', async () => {
    const { paymentIntentId } = await (await post('/api/payment-intent', { applicationId, applicant })).json();
    const url = `${base}/api/payment-intent/${paymentIntentId}?applicationId=${applicationId}`;

    assert.equal((await (await fetch(url)).json()).paid, false);

    stripe.intents.get(paymentIntentId).status = 'succeeded';
    const paid = await (await fetch(url)).json();
    assert.equal(paid.paid, true);
    assert.equal(paid.status, 'succeeded');

    stripe.intents.get(paymentIntentId).amount = 100;
    assert.equal((await (await fetch(url)).json()).paid, false);
  });

  test('status lookup refuses a mismatched application id', async () => {
    const { paymentIntentId } = await (await post('/api/payment-intent', { applicationId, applicant })).json();
    const res = await fetch(`${base}/api/payment-intent/${paymentIntentId}?applicationId=app-someoneelse01`);
    assert.equal(res.status, 404);
  });

  test('webhook verifies the signature and logs our payments', async () => {
    const event = {
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_x', amount: 18000, currency: 'eur', metadata: { source: 'studybg-wizard', applicant_name: 'Lina' } } },
    };
    const bad = await post('/api/stripe/webhook', event, { 'stripe-signature': 'forged' });
    assert.equal(bad.status, 400);

    const good = await post('/api/stripe/webhook', event, { 'stripe-signature': 'valid:whsec_1' });
    assert.equal(good.status, 200);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /payment_intent\.succeeded.*Lina/);
  });

  test('CORS allows the site origin and not others', async () => {
    const ok = await fetch(`${base}/api/health`, { headers: { origin: 'https://studybg.ac' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://studybg.ac');
    const other = await fetch(`${base}/api/health`, { headers: { origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});

describe('without Stripe keys', () => {
  before(async () => start({ publishableKey: undefined }, null));
  after(stop);

  test('payment endpoints answer 503 instead of crashing', async () => {
    assert.equal((await fetch(`${base}/api/config`)).status, 503);
    assert.equal((await post('/api/payment-intent', { applicationId, applicant })).status, 503);
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, paymentsReady: false });
  });
});
