import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { sha256 } from "../db.js";
import { encryptFile, decryptFile } from "../fileCrypto.js";
import { SUPER_ROLE_KEY, roleCan } from "../../shared/adminPermissions.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const normalizeEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 200) : "");
/** Admin sign-in codes share the login_codes table under a key no real email can have (it has a space). */
export const adminCodeKey = (email) => `admin sign-in ${email}`;

export const FULL_SESSION_HOURS = 8;
export const IDLE_MINUTES = 120;
export const STAGE_MINUTES = 10;
export const MAX_STAGE_ATTEMPTS = 5;

const ADMIN_SELECT = `
  SELECT a.*, r.key AS role_key, r.name AS role_name, r.permissions AS role_permissions,
         r.students_scope AS role_scope
  FROM admin_users a JOIN admin_roles r ON r.id = a.role_id`;

export async function adminByEmail(db, email) {
  return (await db.query(`${ADMIN_SELECT} WHERE a.email = $1`, [email])).rows[0] || null;
}
export async function adminById(db, id) {
  return (await db.query(`${ADMIN_SELECT} WHERE a.id = $1`, [id])).rows[0] || null;
}

export const isSuper = (row) => row?.role_key === SUPER_ROLE_KEY;

/** What the browser may see about an admin. Never the secret, its ciphertext or recovery hashes. */
export function publicAdmin(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    twoFactorEnabled: Boolean(row.totp_enrolled_at),
    recoveryCodesLeft: (row.recovery_hashes || []).length,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    role: {
      id: row.role_id,
      key: row.role_key,
      name: row.role_name,
      permissions: row.role_permissions,
      studentsScope: row.role_scope,
    },
  };
}
export const adminCan = (row, permission) =>
  row?.status === "active" &&
  roleCan({ key: row.role_key, permissions: row.role_permissions }, permission);

// --- the authenticator secret, encrypted at rest with the same key that protects uploaded files ---
export function sealTotpSecret(fileKey, adminId, secret) {
  const { iv, authTag, content } = encryptFile(fileKey, Buffer.from(secret, "utf8"), {
    userId: adminId,
    documentId: "totp",
  });
  return { iv, tag: authTag, content };
}
export function openTotpSecret(fileKey, row) {
  if (!row.totp_content) return null;
  return decryptFile(
    fileKey,
    { iv: row.totp_iv, authTag: row.totp_tag, content: row.totp_content },
    { userId: row.id, documentId: "totp" },
  ).toString("utf8");
}

// --- sessions ---
export async function createAdminSession(db, adminId, stage, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  const minutes = stage === "full" ? FULL_SESSION_HOURS * 60 : STAGE_MINUTES;
  await db.query(
    `INSERT INTO admin_sessions (token_hash, admin_id, stage, expires_at, ip, user_agent)
     VALUES ($1,$2,$3, now() + make_interval(mins => $4), $5, $6)`,
    [sha256(token), adminId, stage, minutes, req?.ip || null, String(req?.get?.("user-agent") || "").slice(0, 300)],
  );
  await db.query("DELETE FROM admin_sessions WHERE expires_at < now()");
  return token;
}
export const dropAdminSession = (db, token) => db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [sha256(token)]);
export const dropAdminSessions = (db, adminId) => db.query("DELETE FROM admin_sessions WHERE admin_id = $1", [adminId]);

/** The live session for a token plus its admin, or null. Idle full sessions expire. */
export async function sessionForToken(db, token) {
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT s.token_hash, s.stage, s.attempts, s.last_seen_at, s.admin_id
     FROM admin_sessions s
     WHERE s.token_hash = $1 AND s.expires_at > now()
       AND (s.stage <> 'full' OR s.last_seen_at > now() - make_interval(mins => $2))`,
    [sha256(token), IDLE_MINUTES],
  );
  const session = rows[0];
  if (!session) return null;
  const admin = await adminById(db, session.admin_id);
  if (!admin || admin.status !== "active") return null;
  await db.query(
    "UPDATE admin_sessions SET last_seen_at = now() WHERE token_hash = $1 AND last_seen_at < now() - interval '1 minute'",
    [session.token_hash],
  );
  return { session, admin };
}

/** Counts a failed second-factor attempt. After too many the half-signed-in session is destroyed. */
export async function countStageAttempt(db, tokenHash) {
  const { rows } = await db.query(
    "UPDATE admin_sessions SET attempts = attempts + 1 WHERE token_hash = $1 RETURNING attempts",
    [tokenHash],
  );
  const attempts = rows[0]?.attempts ?? MAX_STAGE_ATTEMPTS + 1;
  if (attempts >= MAX_STAGE_ATTEMPTS) {
    await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
    return { locked: true };
  }
  return { locked: false };
}

export async function logAdmin(db, admin, action, subject = null, detail = {}, req = null) {
  await db.query(
    "INSERT INTO admin_audit (admin_id, admin_email, action, subject, detail, ip) VALUES ($1,$2,$3,$4,$5,$6)",
    [admin?.id || null, admin?.email || "", action, subject, detail, req?.ip || null],
  );
}
