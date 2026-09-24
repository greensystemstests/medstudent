import crypto from 'node:crypto';
import pg from 'pg';

/**
 * @param {string | undefined} url  DATABASE_URL (Render Postgres). null when unset, so the API
 *   still runs (payments work) and account features answer 503 until it's configured.
 */
export function connectDb(url) {
  if (!url) return null;
  // Render's external connection strings require TLS; the internal ones (same region) don't.
  const needsTls = /sslmode=require|\.render\.com/.test(url);
  return new pg.Pool({ connectionString: url, max: 5, ssl: needsTls ? { rejectUnauthorized: false } : false });
}

export async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email         text NOT NULL UNIQUE,
      full_name     text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS login_codes (
      email      text PRIMARY KEY,
      code_hash  text NOT NULL,
      attempts   int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS documents (
      id         uuid PRIMARY KEY,
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category   text NOT NULL,
      filename   text NOT NULL,
      mime_type  text NOT NULL,
      size_bytes int NOT NULL,
      status     text NOT NULL DEFAULT 'received',
      key_id     text NOT NULL,
      iv         bytea NOT NULL,
      auth_tag   bytea NOT NULL,
      content    bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS documents_user_idx ON documents(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS activity (
      id         bigserial PRIMARY KEY,
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       text NOT NULL,
      detail     text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS activity_user_idx ON activity(user_id, created_at DESC);
  `);
}

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function sameHash(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const LOGIN_CODE_TTL_MIN = 10;
const LOGIN_CODE_MAX_ATTEMPTS = 5;
const LOGIN_CODE_RESEND_SECONDS = 30;
const SESSION_TTL_DAYS = 30;

/**
 * Creates (or replaces) the one-time sign-in code for an email.
 * @returns {Promise<{ code: string } | { retryAfterSeconds: number }>}
 */
export async function createLoginCode(db, email) {
  const { rows } = await db.query(
    `SELECT extract(epoch FROM now() - created_at) AS age FROM login_codes WHERE email = $1`,
    [email],
  );
  if (rows[0] && Number(rows[0].age) < LOGIN_CODE_RESEND_SECONDS) {
    return { retryAfterSeconds: Math.ceil(LOGIN_CODE_RESEND_SECONDS - Number(rows[0].age)) };
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await db.query(
    `INSERT INTO login_codes (email, code_hash, attempts, created_at, expires_at)
     VALUES ($1, $2, 0, now(), now() + make_interval(mins => $3))
     ON CONFLICT (email) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, attempts = 0, created_at = now(), expires_at = EXCLUDED.expires_at`,
    [email, sha256(code), LOGIN_CODE_TTL_MIN],
  );
  return { code };
}

/**
 * Checks a sign-in code; on success consumes it, creates the user if new, and opens a session.
 * @returns {Promise<{ token: string, user: object, isNewUser: boolean } | { error: string }>}
 */
export async function verifyLoginCode(db, email, code) {
  const { rows } = await db.query(
    `UPDATE login_codes SET attempts = attempts + 1
     WHERE email = $1 AND expires_at > now()
     RETURNING code_hash, attempts`,
    [email],
  );
  const entry = rows[0];
  if (!entry) return { error: 'This code has expired. Please request a new one.' };
  if (entry.attempts > LOGIN_CODE_MAX_ATTEMPTS) {
    await db.query(`DELETE FROM login_codes WHERE email = $1`, [email]);
    return { error: 'Too many attempts. Please request a new code.' };
  }
  if (!/^\d{6}$/.test(code) || !sameHash(entry.code_hash, sha256(code))) {
    return { error: 'That code is not correct. Please check the email and try again.' };
  }
  await db.query(`DELETE FROM login_codes WHERE email = $1`, [email]);

  const inserted = await db.query(
    `INSERT INTO users (email, last_login_at) VALUES ($1, now())
     ON CONFLICT (email) DO UPDATE SET last_login_at = now()
     RETURNING id, email, full_name, created_at, (xmax = 0) AS is_new`,
    [email],
  );
  const user = inserted.rows[0];

  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), user.id, SESSION_TTL_DAYS],
  );
  // Housekeeping, cheap enough to do on each sign-in.
  await db.query(`DELETE FROM sessions WHERE expires_at < now()`);
  await db.query(`DELETE FROM login_codes WHERE expires_at < now() - interval '1 day'`);

  const { is_new: isNewUser, ...publicUser } = user;
  return { token, user: publicUser, isNewUser };
}

export async function userForToken(db, token) {
  if (!token || token.length > 100) return null;
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.full_name, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  return rows[0] || null;
}

export async function deleteSession(db, token) {
  await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
}

export async function setFullNameIfMissing(db, userId, fullName) {
  if (!fullName) return;
  await db.query(`UPDATE users SET full_name = $2 WHERE id = $1 AND full_name IS NULL`, [userId, fullName.slice(0, 120)]);
}

export async function logActivity(db, userId, type, detail = '') {
  await db.query(`INSERT INTO activity (user_id, type, detail) VALUES ($1, $2, $3)`, [userId, type, detail.slice(0, 300)]);
}

export async function listActivity(db, userId, limit = 50) {
  const { rows } = await db.query(
    `SELECT id::text, type, detail, created_at FROM activity WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

const DOCUMENT_COLUMNS = `id, category, filename, mime_type, size_bytes, status, created_at`;

export async function documentUsage(db, userId) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS count, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM documents WHERE user_id = $1`,
    [userId],
  );
  return { count: rows[0].count, bytes: Number(rows[0].bytes) };
}

export async function insertDocument(db, doc) {
  const { rows } = await db.query(
    `INSERT INTO documents (id, user_id, category, filename, mime_type, size_bytes, key_id, iv, auth_tag, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${DOCUMENT_COLUMNS}`,
    [doc.id, doc.userId, doc.category, doc.filename, doc.mimeType, doc.sizeBytes, doc.keyId, doc.iv, doc.authTag, doc.content],
  );
  return rows[0];
}

export async function listDocuments(db, userId) {
  const { rows } = await db.query(
    `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

/** Includes the encrypted content. Scoped to the owner: another user's id returns null. */
export async function getDocumentWithContent(db, userId, documentId) {
  const { rows } = await db.query(
    `SELECT ${DOCUMENT_COLUMNS}, key_id, iv, auth_tag, content FROM documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId],
  );
  return rows[0] || null;
}

export async function deleteDocument(db, userId, documentId) {
  const { rows } = await db.query(
    `DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING ${DOCUMENT_COLUMNS}`,
    [documentId, userId],
  );
  return rows[0] || null;
}
