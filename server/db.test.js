// Connection-setup tests. No database needed: pg.Pool connects lazily.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertDirectConnection, connectDb } from './db.js';

const DIRECT = 'postgresql://u:p@ep-cool-123456.eu-central-1.aws.neon.tech/studybg?sslmode=require';
const POOLED = 'postgresql://u:p@ep-cool-123456-pooler.eu-central-1.aws.neon.tech/studybg?sslmode=require';

test('no DATABASE_URL means no database (account features answer 503)', () => {
  assert.equal(connectDb(undefined), null);
  assert.equal(connectDb(''), null);
});

test("Neon's pooled endpoint is refused; direct, Render and local URLs are accepted", () => {
  assert.throws(() => assertDirectConnection(POOLED), /pooled endpoint/);
  assert.throws(() => connectDb(POOLED), /direct connection string/);
  for (const ok of [
    DIRECT,
    'postgres://u:p@dpg-abc123-a/studybg_db',
    'postgres://u:p@localhost:5432/studybg_test',
    'not a url at all',
  ])
    assert.doesNotThrow(() => assertDirectConnection(ok));
});

test('a dropped idle connection is logged, never an uncaught exception', async () => {
  const pool = connectDb(DIRECT);
  const logged = [];
  const original = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    assert.doesNotThrow(() => pool.emit('error', new Error('terminating connection')));
  } finally {
    console.error = original;
    await pool.end();
  }
  assert.match(logged[0], /idle connection error: terminating connection/);
});

test('Neon connections use TLS even if sslmode is missing from the URL', async () => {
  const pool = connectDb('postgresql://u:p@ep-cool-123456.eu-central-1.aws.neon.tech/studybg');
  try {
    assert.ok(pool.options.ssl, 'ssl should be enabled for *.neon.tech');
  } finally {
    await pool.end();
  }
});
