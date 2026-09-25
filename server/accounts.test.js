// Account API tests against a real Postgres. Set TEST_DATABASE_URL to run them
// (CI provides one); without it they're skipped. The database's tables are dropped and recreated.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createApp } from './app.js';
import { connectDb, migrate } from './db.js';
import { decryptFile, encryptFile, fileKeyFromEnv } from './fileCrypto.js';

const DB_URL = process.env.TEST_DATABASE_URL;
if(DB_URL&&!new URL(DB_URL).pathname.endsWith('_test'))throw new Error('Use a disposable database ending in _test');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)]);

function fakeStripe() {
  const intents = [
    { id: 'pi_lina0000000001', amount: 18000, currency: 'eur', status: 'succeeded', created: 1_790_000_000,
      metadata: { source: 'studybg-wizard', applicant_email: 'lina@example.com', applicant_name: 'Lina Haddad', degree: 'Medicine', university: 'Medical University of Sofia', intake: 'Autumn intake (October)', call_date: '2026-09-28', call_window: 'Afternoon' } },
    { id: 'pi_other000000001', amount: 18000, currency: 'eur', status: 'succeeded', created: 1_790_000_000,
      metadata: { source: 'studybg-wizard', applicant_email: 'someone@example.com', applicant_name: 'Someone Else' } },
  ];
  return {
    searches: [],
    paymentIntents: {
      async search({ query }) {
        this.searches?.push?.(query);
        return { data: intents };
      },
    },
  };
}

describe('accounts API', { skip: !DB_URL && 'TEST_DATABASE_URL not set' }, () => {
  let db;
  let server;
  let base;
  const codes = new Map();
  const fileKey = fileKeyFromEnv('test-file-encryption-key-please-change');

  const call = (path, { token, method = 'GET', json, body, headers = {} } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: json ? JSON.stringify(json) : body,
    });

  async function signIn(email) {
    const req = await call('/api/auth/request-code', { method: 'POST', json: { email } });
    assert.equal(req.status, 200, await req.clone().text());
    const res = await call('/api/auth/verify', { method: 'POST', json: { email, code: codes.get(email) } });
    assert.equal(res.status, 200);
    return (await res.json()).token;
  }

  const upload = (token, buf, { category = 'diploma', filename = 'diploma.pdf' } = {}) =>
    call(`/api/me/documents?category=${category}&filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      token,
      body: buf,
      headers: { 'content-type': 'application/octet-stream' },
    });

  before(async () => {
    db = connectDb(DB_URL);
    await db.query('DROP TABLE IF EXISTS staff_audit,email_outbox,invoices,invoice_counter,application_consents,applications,activity, documents, sessions, login_codes, users CASCADE');
    await migrate(db);
    await migrate(db); // idempotent
    const app = createApp({
      stripe: fakeStripe(),
      config: { publishableKey: 'pk_test_1', allowedOrigins: [] },
      accounts: {
        db,
        fileKey,
        deliverCode: async (email, code) => codes.set(email, code),
        rateLimits: { requestCode: 1000, verify: 1000, upload: 1000 }, // every test request comes from 127.0.0.1
      },
      log: () => {},
    });
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  });

  beforeEach(async () => {
    codes.clear();
    await db.query('TRUNCATE activity, documents, sessions, login_codes, users CASCADE');
  });

  test('health reports accounts ready', async () => {
    assert.equal((await (await call('/api/health')).json()).accountsReady, true);
  });

  test('sign-in: code by email, wrong code rejected, right code opens a session', async () => {
    assert.equal((await call('/api/auth/request-code', { method: 'POST', json: { email: 'not-an-email' } })).status, 400);

    const req = await call('/api/auth/request-code', { method: 'POST', json: { email: ' Lina@Example.com ' } });
    assert.deepEqual(await req.json(), { sent: true });
    const code = codes.get('lina@example.com');
    assert.match(code, /^\d{6}$/);

    const wrong = await call('/api/auth/verify', { method: 'POST', json: { email: 'lina@example.com', code: code === '000000' ? '111111' : '000000' } });
    assert.equal(wrong.status, 401);

    const ok = await call('/api/auth/verify', { method: 'POST', json: { email: 'lina@example.com', code } });
    const body = await ok.json();
    assert.equal(ok.status, 200);
    assert.ok(body.token.length > 30);
    assert.equal(body.user.email, 'lina@example.com');

    // The code is single-use.
    const reuse = await call('/api/auth/verify', { method: 'POST', json: { email: 'lina@example.com', code } });
    assert.equal(reuse.status, 401);

    // Only a hash of the session token is stored.
    const { rows } = await db.query('SELECT token_hash FROM sessions');
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token_hash, body.token);
  });

  test('requesting another code within 30s is refused', async () => {
    await call('/api/auth/request-code', { method: 'POST', json: { email: 'lina@example.com' } });
    const again = await call('/api/auth/request-code', { method: 'POST', json: { email: 'lina@example.com' } });
    assert.equal(again.status, 429);
  });

  test('a code is burned after 5 wrong attempts', async () => {
    await call('/api/auth/request-code', { method: 'POST', json: { email: 'lina@example.com' } });
    const code = codes.get('lina@example.com');
    const wrongCode = code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) {
      await call('/api/auth/verify', { method: 'POST', json: { email: 'lina@example.com', code: wrongCode } });
    }
    const late = await call('/api/auth/verify', { method: 'POST', json: { email: 'lina@example.com', code } });
    assert.equal(late.status, 401);
    assert.match((await late.json()).error, /Too many attempts|expired/);
  });

  test('profile needs a session and shows only this email\'s paid applications', async () => {
    assert.equal((await call('/api/me')).status, 401);
    assert.equal((await call('/api/me', { token: 'forged' })).status, 401);

    const token = await signIn('lina@example.com');
    const me = await (await call('/api/me', { token })).json();
    assert.equal(me.user.email, 'lina@example.com');
    assert.equal(me.user.fullName, 'Lina Haddad'); // filled in from the paid application
    assert.equal(me.applications.length, 1);
    assert.equal(me.applications[0].university, 'Medical University of Sofia');
    assert.equal(me.applications[0].amount, 18000);
  });

  test('upload, list and open a document; the bytes at rest are encrypted', async () => {
    const token = await signIn('lina@example.com');
    const res = await upload(token, PDF, { filename: '../../etc/passwd My Diploma.pdf' });
    assert.equal(res.status, 201);
    const { document } = await res.json();
    assert.equal(document.category, 'diploma');
    assert.equal(document.mimeType, 'application/pdf');
    assert.equal(document.filename, '.._.._etc_passwd My Diploma.pdf');
    assert.equal(document.status, 'received');

    const list = await (await call('/api/me/documents', { token })).json();
    assert.equal(list.documents.length, 1);
    assert.equal(list.usage.count, 1);

    const file = await call(`/api/me/documents/${document.id}/file?download=1`, { token });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'application/pdf');
    assert.match(file.headers.get('content-disposition'), /^attachment;/);
    assert.equal(file.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), PDF);

    const { rows } = await db.query('SELECT content FROM documents WHERE id = $1', [document.id]);
    assert.ok(!rows[0].content.includes(Buffer.from('%PDF')), 'stored content must not be plaintext');

    const { activity } = await (await call('/api/me/activity', { token })).json();
    assert.equal(activity[0].type, 'document_downloaded');
  });

  test('uploads are checked by content, not by the name or type the browser claims', async () => {
    const token = await signIn('lina@example.com');
    const text = await upload(token, Buffer.from('hello, I am a text file'), { filename: 'fake.pdf' });
    assert.equal(text.status, 415);
    const png = await upload(token, PNG, { category: 'passport', filename: 'passport.pdf' });
    assert.equal(png.status, 201);
    assert.equal((await png.json()).document.filename, 'passport.png');
    assert.equal((await upload(token, PDF, { category: 'nonsense' })).status, 400);
    assert.equal((await upload(token, Buffer.alloc(0))).status, 400);
  });

  test('files over 10 MB are rejected', async () => {
    const token = await signIn('lina@example.com');
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await upload(token, big);
    assert.equal(res.status, 413);
    assert.match((await res.json()).error, /10 MB/);
  });

  test("one user can't list, open or delete another user's documents", async () => {
    const lina = await signIn('lina@example.com');
    const { document } = await (await upload(lina, PDF)).json();
    const omar = await signIn('omar@example.com');

    assert.equal((await (await call('/api/me/documents', { token: omar })).json()).documents.length, 0);
    assert.equal((await call(`/api/me/documents/${document.id}/file`, { token: omar })).status, 404);
    assert.equal((await call(`/api/me/documents/${document.id}`, { token: omar, method: 'DELETE' })).status, 404);
    assert.equal((await call(`/api/me/documents/${document.id}/file`, { token: lina })).status, 200);
  });

  test('delete removes the file, and the activity log records what happened', async () => {
    const token = await signIn('lina@example.com');
    const { document } = await (await upload(token, PDF)).json();
    await call(`/api/me/documents/${document.id}/file`, { token });
    assert.equal((await call(`/api/me/documents/${document.id}`, { token, method: 'DELETE' })).status, 200);
    assert.equal((await call(`/api/me/documents/${document.id}/file`, { token })).status, 404);

    const { activity } = await (await call('/api/me/activity', { token })).json();
    assert.deepEqual(
      activity.map((a) => a.type),
      ['document_deleted', 'document_opened', 'document_uploaded', 'account_created'],
    );
    assert.equal(activity[0].detail, 'High school diploma: diploma.pdf');
  });

  test('sign out ends the session; expired sessions are refused', async () => {
    const token = await signIn('lina@example.com');
    assert.equal((await call('/api/auth/logout', { token, method: 'POST' })).status, 200);
    assert.equal((await call('/api/me', { token })).status, 401);

    const second = await signIn('lina@example.com');
    await db.query(`UPDATE sessions SET expires_at = now() - interval '1 minute'`);
    assert.equal((await call('/api/me', { token: second })).status, 401);
  });
});

describe('accounts not configured', () => {
  let server;
  let base;
  before(async () => {
    const app = createApp({
      stripe: null,
      config: { publishableKey: undefined, allowedOrigins: [] },
      accounts: null,
      log: () => {},
    });
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  test('account routes answer 503 while every other route is unaffected', async () => {
    assert.equal((await fetch(`${base}/api/auth/request-code`, { method: 'POST' })).status, 503);
    assert.equal((await fetch(`${base}/api/me`)).status, 503);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).accountsReady, false);
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  });
});

describe('file encryption', () => {
  const key = fileKeyFromEnv('another-long-test-secret-value');
  const ids = { userId: 'u1', documentId: 'd1' };

  test('round-trips, and a blob moved to another user or document cannot be decrypted', () => {
    const sealed = encryptFile(key, PDF, ids);
    assert.deepEqual(decryptFile(key, sealed, ids), PDF);
    assert.throws(() => decryptFile(key, sealed, { ...ids, userId: 'u2' }));
    assert.throws(() => decryptFile(key, sealed, { ...ids, documentId: 'd2' }));
    assert.throws(() => decryptFile(fileKeyFromEnv('a-different-long-secret-value'), sealed, ids));
  });

  test('refuses a missing or too-short key', () => {
    assert.equal(fileKeyFromEnv(''), null);
    assert.equal(fileKeyFromEnv('short'), null);
  });
});
