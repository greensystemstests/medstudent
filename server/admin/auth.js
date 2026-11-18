import { createLoginCode, consumeLoginCode, sha256 } from "../db.js";
import { safe, httpError } from "../workflow.js";
import { rateLimit } from "../rateLimit.js";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "../totp.js";
import {
  EMAIL_RE,
  FULL_SESSION_HOURS,
  adminByEmail,
  adminById,
  adminCodeKey,
  countStageAttempt,
  createAdminSession,
  dropAdminSession,
  logAdmin,
  normalizeEmail,
  openTotpSecret,
  publicAdmin,
  sealTotpSecret,
} from "./store.js";
import { anyAdminSession, requireAdmin } from "./middleware.js";

const GENERIC_CODE_ERROR = "That code didn't work. Check the email, or request a new code.";

/**
 * Sign-in is two steps, both required:
 *  1. an emailed 6-digit code (proves the mailbox), then
 *  2. a 6-digit code from an authenticator app such as Google Authenticator (proves the device).
 * The first time, step 2 is the app's enrolment: scan a QR code, confirm one code, keep the recovery codes.
 */
export function mountAdminAuth(router, { db, fileKey, deliverAdminCode, log, rateLimits = {}, monitor = null }) {
  const limit = rateLimit({ windowMs: 60_000, max: rateLimits.adminAuth ?? 20 });
  const full = requireAdmin(db);

  router.post(
    "/auth/request-code",
    limit,
    safe(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      if (!EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email address.");
      const admin = await adminByEmail(db, email);
      // Same answer for everyone, so this can't be used to find out which emails are admins.
      if (!admin || admin.status !== "active") return res.json({ sent: true });
      if (!deliverAdminCode) throw httpError(503, "Email sign-in isn't set up yet.");
      const issued = await createLoginCode(db, adminCodeKey(email));
      if (issued.retryAfterSeconds) return res.json({ sent: true });
      try {
        await deliverAdminCode(email, issued.code);
      } catch (error) {
        log?.(`admin request-code error: ${error.message}`);
        await monitor?.record({ source: "server", kind: "email_failed", message: `Admin sign-in code email: ${error.message}`, route: "/api/admin/auth/request-code", status: 502 });
        await db.query("DELETE FROM login_codes WHERE email = $1", [adminCodeKey(email)]);
        throw httpError(502, "We could not send the code right now. Please try again.");
      }
      res.json({ sent: true });
    }),
  );

  router.post(
    "/auth/verify-code",
    limit,
    safe(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const code = String(req.body?.code || "").trim();
      const admin = EMAIL_RE.test(email) ? await adminByEmail(db, email) : null;
      if (!admin || admin.status !== "active") throw httpError(401, GENERIC_CODE_ERROR);
      const checked = await consumeLoginCode(db, adminCodeKey(email), code);
      if (checked.error) {
        await logAdmin(db, admin, "signin_code_failed", null, {}, req);
        throw httpError(401, GENERIC_CODE_ERROR);
      }
      await db.query("DELETE FROM admin_sessions WHERE admin_id = $1 AND stage <> 'full'", [admin.id]);
      const stage = admin.totp_enrolled_at ? "totp" : "enroll";
      const token = await createAdminSession(db, admin.id, stage, req);
      res.json({ token, stage, email: admin.email });
    }),
  );

  // Where is this sign-in? Lets the page resume after a refresh.
  router.get(
    "/auth/me",
    anyAdminSession(db),
    safe(async (req, res) => {
      const stage = req.adminSession.stage;
      res.json(
        stage === "full"
          ? { stage, admin: publicAdmin(req.admin) }
          : { stage, email: req.admin.email },
      );
    }),
  );

  router.post(
    "/auth/logout",
    anyAdminSession(db),
    safe(async (req, res) => {
      await logAdmin(db, req.admin, "signout", null, {}, req);
      await dropAdminSession(db, req.adminToken);
      res.json({ ok: true });
    }),
  );

  /** Swaps the half-signed-in token for a full one (a new token, so an old one can't be reused). */
  async function promote(req, adminId) {
    await dropAdminSession(db, req.adminToken);
    const token = await createAdminSession(db, adminId, "full", req);
    const admin = await adminById(db, adminId);
    return { token, stage: "full", admin: publicAdmin(admin), expiresInHours: FULL_SESSION_HOURS };
  }

  const stageGuard = (stage) => requireAdmin(db, { stage });
  const bearerFor = (req) => (req.get("authorization") || "").slice(7);

  router.post(
    "/auth/verify-totp",
    limit,
    stageGuard("totp"),
    safe(async (req, res) => {
      req.adminToken = bearerFor(req);
      const row = req.admin;
      const counted = await countStageAttempt(db, req.adminSession.token_hash);
      if (counted.locked) throw httpError(401, "Too many attempts. Please sign in again.");

      const recovery = normalizeRecoveryCode(req.body?.recoveryCode);
      if (recovery) {
        const hash = sha256(recovery);
        const used = await db.query(
          `UPDATE admin_users SET recovery_hashes = array_remove(recovery_hashes, $2), last_login_at = now()
           WHERE id = $1 AND $2 = ANY(recovery_hashes) RETURNING id`,
          [row.id, hash],
        );
        if (!used.rows[0]) throw httpError(401, "That recovery code isn't valid.");
        await logAdmin(db, row, "recovery_code_used", null, {}, req);
      } else {
        const secret = openTotpSecret(fileKey, row);
        const step = secret ? verifyTotp(secret, req.body?.code, { lastStep: row.totp_last_step }) : null;
        // The step is stored atomically, so one code can't be used twice, even by two requests at once.
        const stored =
          step === null
            ? null
            : await db.query(
                `UPDATE admin_users SET totp_last_step = $2, last_login_at = now()
                 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING id`,
                [row.id, step],
              );
        if (!stored?.rows[0]) {
          await logAdmin(db, row, "signin_totp_failed", null, {}, req);
          throw httpError(401, "That code didn't work. Wait for the next one and try again.");
        }
      }
      await logAdmin(db, row, "signin", null, {}, req);
      res.json(await promote(req, row.id));
    }),
  );

  // First sign-in: create the secret and show it as a QR code.
  router.post(
    "/auth/enroll/start",
    limit,
    stageGuard("enroll"),
    safe(async (req, res) => {
      const secret = generateTotpSecret();
      const sealed = sealTotpSecret(fileKey, req.admin.id, secret);
      await db.query(
        `UPDATE admin_users SET totp_iv=$2, totp_tag=$3, totp_content=$4, totp_enrolled_at=NULL, totp_last_step=NULL
         WHERE id=$1 AND totp_enrolled_at IS NULL`,
        [req.admin.id, sealed.iv, sealed.tag, sealed.content],
      );
      res.json({ secret, uri: otpauthUri({ secret, email: req.admin.email }) });
    }),
  );

  router.post(
    "/auth/enroll/confirm",
    limit,
    stageGuard("enroll"),
    safe(async (req, res) => {
      req.adminToken = bearerFor(req);
      const row = await adminById(db, req.admin.id);
      if (row.totp_enrolled_at) throw httpError(409, "Two-step sign-in is already set up.");
      const secret = openTotpSecret(fileKey, row);
      if (!secret) throw httpError(409, "Start the setup again to get a new QR code.");
      const counted = await countStageAttempt(db, req.adminSession.token_hash);
      if (counted.locked) throw httpError(401, "Too many attempts. Please sign in again.");
      const step = verifyTotp(secret, req.body?.code);
      if (step === null)
        throw httpError(401, "That code didn't match. Check the time on your phone and try the newest code.");
      const codes = generateRecoveryCodes();
      const done = await db.query(
        `UPDATE admin_users SET totp_enrolled_at = now(), totp_last_step = $2, recovery_hashes = $3, last_login_at = now()
         WHERE id = $1 AND totp_enrolled_at IS NULL RETURNING id`,
        [row.id, step, codes.map((c) => sha256(normalizeRecoveryCode(c)))],
      );
      if (!done.rows[0]) throw httpError(409, "Two-step sign-in is already set up.");
      await logAdmin(db, row, "totp_enrolled", null, {}, req);
      await logAdmin(db, row, "signin", null, {}, req);
      res.json({ ...(await promote(req, row.id)), recoveryCodes: codes });
    }),
  );

  // Fresh recovery codes (the old ones stop working). Needs a current authenticator code.
  router.post(
    "/auth/recovery-codes",
    limit,
    full,
    safe(async (req, res) => {
      const row = await adminById(db, req.admin.id);
      const secret = openTotpSecret(fileKey, row);
      const step = secret ? verifyTotp(secret, req.body?.code, { lastStep: row.totp_last_step }) : null;
      const stored =
        step === null
          ? null
          : await db.query(
              `UPDATE admin_users SET totp_last_step = $2 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING id`,
              [row.id, step],
            );
      if (!stored?.rows[0])
        throw httpError(401, "That code didn't work. Wait for the next one and try again.");
      const codes = generateRecoveryCodes();
      await db.query("UPDATE admin_users SET recovery_hashes = $2 WHERE id = $1", [
        row.id,
        codes.map((c) => sha256(normalizeRecoveryCode(c))),
      ]);
      await logAdmin(db, row, "recovery_codes_regenerated", null, {}, req);
      res.json({ recoveryCodes: codes });
    }),
  );
}
