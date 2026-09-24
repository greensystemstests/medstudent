import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { createApp, ONBOARDING_FEE } from './app.js';
import { computeVat } from './invoice.js';

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

/** In-memory stand-in for the ioredis subset kv.js uses (get/set/setnx/incr/eval). */
function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async set(k, v) {
      store.set(k, String(v));
      return 'OK';
    },
    async setnx(k, v) {
      if (store.has(k)) return 0;
      store.set(k, String(v));
      return 1;
    },
    async incr(k) {
      const n = (Number(store.get(k)) || 0) + 1;
      store.set(k, String(n));
      return n;
    },
    // Replicates RESERVE_SCRIPT's semantics (the fake doesn't run Lua, but must stay in lockstep with it).
    async eval(_script, _numKeys, numberKey, seqKey, initVal) {
      const existing = store.has(numberKey) ? store.get(numberKey) : null;
      if (existing) return Number(existing);
      if (!store.has(seqKey)) store.set(seqKey, String(initVal));
      const n = (Number(store.get(seqKey)) || 0) + 1;
      store.set(seqKey, String(n));
      store.set(numberKey, String(n));
      return n;
    },
  };
}

/** In-memory stand-in for the Resend SDK; can be told to fail its first N sends, to test retries. */
function fakeResend({ failFirst = 0 } = {}) {
  const sent = [];
  let failuresLeft = failFirst;
  return {
    sent,
    emails: {
      async send(payload) {
        if (failuresLeft > 0) {
          failuresLeft--;
          throw new Error('Resend hiccup');
        }
        sent.push(payload);
        return { id: `email_${sent.length}` };
      },
    },
  };
}

const seller = { name: 'StudyBg OOD', eik: '123456789', address: '1 Test Street', city: 'Sofia', vatNumber: '' };

function succeededEvent(paymentIntent) {
  return {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_x',
        amount: 18000,
        currency: 'eur',
        description: 'StudyBg onboarding & advisory fee',
        metadata: {
          source: 'studybg-wizard',
          applicant_name: 'Lina Haddad',
          applicant_email: 'lina@example.com',
          degree: 'Medicine',
          university: 'Medical University of Sofia',
          call_date: '2026-09-28',
          call_window: 'Afternoon (14:00-16:00 Sofia time)',
          ...paymentIntent?.metadata,
        },
        ...paymentIntent,
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

async function start(configOverrides = {}, stripeClient = fakeStripe(), billing = null) {
  stripe = stripeClient;
  const app = createApp({
    stripe,
    billing,
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
    assert.match(logs[0], /payment_intent\.succeeded.*Lina/);
    // No billing configured in this describe block, so invoicing is skipped (not silently — logged).
    assert.match(logs[1], /invoice\/email skipped/);
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
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, paymentsReady: false, billingReady: false });
  });
});

describe('invoicing & receipt emails', () => {
  let kv;
  let resend;

  beforeEach(async () => {
    logs.length = 0;
    kv = fakeKv();
    resend = fakeResend();
    await start({}, fakeStripe(), {
      kv,
      resend,
      seller,
      fromEmail: 'billing@studybg.ac',
      saleNotifyEmail: 'owner@studybg.ac',
      invoiceStartNumber: 1,
    });
  });
  afterEach(stop);

  test('health reports billing as ready once kv/resend/seller/fromEmail are all set', async () => {
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, paymentsReady: true, billingReady: true });
  });

  test('a successful payment gets a PDF invoice emailed to the buyer, and a sale alert to the business', async () => {
    const res = await post('/api/stripe/webhook', succeededEvent(), { 'stripe-signature': 'valid:whsec_1' });
    assert.equal(res.status, 200);
    assert.equal(resend.sent.length, 2);

    const [receipt, alert] = resend.sent;
    assert.equal(receipt.to, 'lina@example.com');
    assert.match(receipt.subject, /Invoice 0000000001/);
    assert.equal(receipt.attachments[0].filename, 'StudyBg-Invoice-0000000001.pdf');
    assert.equal(receipt.attachments[0].content.subarray(0, 4).toString('latin1'), '%PDF');

    assert.equal(alert.to, 'owner@studybg.ac');
    assert.match(alert.subject, /New sale: €180\.00/);
    assert.match(alert.html, /Lina Haddad/);
    assert.match(alert.html, /Medical University of Sofia/);
  });

  test('invoice numbers are sequential across different payments, starting at invoiceStartNumber', async () => {
    await post('/api/stripe/webhook', succeededEvent({ id: 'pi_a' }), { 'stripe-signature': 'valid:whsec_1' });
    await post('/api/stripe/webhook', succeededEvent({ id: 'pi_b' }), { 'stripe-signature': 'valid:whsec_1' });
    assert.equal(resend.sent[0].attachments[0].filename, 'StudyBg-Invoice-0000000001.pdf');
    assert.equal(resend.sent[2].attachments[0].filename, 'StudyBg-Invoice-0000000002.pdf');
  });

  test('a redelivered webhook for the same payment does not resend or reuse a new number', async () => {
    const event = succeededEvent();
    await post('/api/stripe/webhook', event, { 'stripe-signature': 'valid:whsec_1' });
    const again = await post('/api/stripe/webhook', event, { 'stripe-signature': 'valid:whsec_1' });
    assert.equal(again.status, 200);
    assert.equal(resend.sent.length, 2); // still just the one receipt + one alert, not four
  });

  test('a transient email failure makes the webhook fail (so Stripe retries) without burning the invoice number', async () => {
    await stop(); // close the server beforeEach opened before swapping in a failing resend client
    resend = fakeResend({ failFirst: 1 });
    await start({}, fakeStripe(), { kv, resend, seller, fromEmail: 'billing@studybg.ac', invoiceStartNumber: 1 });

    const event = succeededEvent();
    const first = await post('/api/stripe/webhook', event, { 'stripe-signature': 'valid:whsec_1' });
    assert.equal(first.status, 500);
    assert.equal(resend.sent.length, 0);

    const retry = await post('/api/stripe/webhook', event, { 'stripe-signature': 'valid:whsec_1' });
    assert.equal(retry.status, 200);
    assert.equal(resend.sent.length, 1);
    assert.equal(resend.sent[0].attachments[0].filename, 'StudyBg-Invoice-0000000001.pdf');
  });

  test('a payment with no applicant email is skipped, not crashed on', async () => {
    const event = succeededEvent({ metadata: { applicant_email: '' } });
    const res = await post('/api/stripe/webhook', event, { 'stripe-signature': 'valid:whsec_1' });
    assert.equal(res.status, 200);
    assert.equal(resend.sent.length, 0);
  });

  test('a VAT-registered seller still emails a real, non-trivial PDF', async () => {
    await stop(); // close the server beforeEach opened before swapping in a VAT-registered seller
    await start(
      {},
      fakeStripe(),
      { kv: fakeKv(), resend, seller: { ...seller, vatNumber: 'BG123456789' }, fromEmail: 'billing@studybg.ac', invoiceStartNumber: 1 },
    );
    await post('/api/stripe/webhook', succeededEvent(), { 'stripe-signature': 'valid:whsec_1' });
    const pdf = resend.sent[0].attachments[0].content;
    assert.equal(pdf.subarray(0, 4).toString('latin1'), '%PDF');
    assert.ok(pdf.length > 1000, 'PDF has real content, not an empty page');
  });
});

describe('VAT math (computeVat)', () => {
  test('not VAT-registered: the full gross amount is the net amount, no VAT charged', () => {
    assert.deepEqual(computeVat(18000, false), { netMinor: 18000, vatMinor: 0 });
  });

  test('VAT-registered: net + VAT sum back exactly to the gross amount, at the 20% rate', () => {
    const { netMinor, vatMinor } = computeVat(18000, true);
    assert.equal(netMinor + vatMinor, 18000);
    assert.equal(Math.round(netMinor * 1.2), 18000);
  });

  test('rounding never loses or invents a cent, across a range of amounts', () => {
    for (const amount of [1, 99, 100, 12345, 18000, 999999]) {
      const { netMinor, vatMinor } = computeVat(amount, true);
      assert.equal(netMinor + vatMinor, amount);
    }
  });
});
