import { cleanRefCode } from "./source.js";

// Referral links: the visit counter and the sign-up attribution. Both only ever touch an active link,
// and neither can make a visit or an account creation fail.

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|monitor|curl|wget|python-requests|scanner/i;

/** Counts one visit for the code's link (today's bucket). No address, browser or person is recorded. */
export async function recordReferralVisit(db, rawCode, userAgent) {
  const code = cleanRefCode(rawCode);
  if (!code || !db || BOT_RE.test(String(userAgent || ""))) return false;
  try {
    const { rowCount } = await db.query(
      `INSERT INTO referral_clicks (link_id, day, clicks)
       SELECT id, (now() AT TIME ZONE 'UTC')::date, 1 FROM referral_links WHERE code = $1 AND status = 'active'
       ON CONFLICT (link_id, day) DO UPDATE SET clicks = referral_clicks.clicks + 1`,
      [code],
    );
    return rowCount > 0;
  } catch {
    return false;
  }
}

/**
 * Ties a brand-new account to the referral link it arrived through. The commission is fixed at this
 * moment (changing a link's commission later only affects people who sign up afterwards), and the
 * link's source (its brand) becomes the account's "came from" label. Runs inside the sign-up
 * transaction in a savepoint, so a problem here can never stop someone creating their account.
 */
export async function attachReferral(tx, userId, source) {
  const code = cleanRefCode(source?.ref);
  if (!code) return false;
  try {
    await tx.query("SAVEPOINT referral");
    const { rows } = await tx.query(
      `SELECT l.id, l.commission_cents, s.name AS source_name
       FROM referral_links l JOIN referral_sources s ON s.id = l.source_id
       WHERE l.code = $1 AND l.status = 'active'`,
      [code],
    );
    if (rows[0]) {
      await tx.query(
        `UPDATE users SET referral_link_id = $2, referral_commission_cents = $3,
           signup_source = coalesce(signup_source, '{}'::jsonb) || jsonb_build_object('ref_label', $4::text)
         WHERE id = $1`,
        [userId, rows[0].id, rows[0].commission_cents, rows[0].source_name],
      );
    }
    await tx.query("RELEASE SAVEPOINT referral");
    return Boolean(rows[0]);
  } catch {
    try {
      await tx.query("ROLLBACK TO SAVEPOINT referral");
    } catch {
      // the outer transaction decides what happens next
    }
    return false;
  }
}
