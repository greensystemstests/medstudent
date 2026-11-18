import crypto from "node:crypto";
import { safe, httpError } from "../workflow.js";
import { REF_CODE_RE, cleanRefCode } from "../source.js";
import { requireAdmin } from "./middleware.js";
import { UUID_RE, logAdmin } from "./store.js";

const WINDOWS = { "7d": 7, "30d": 30, "90d": 90, all: null };
const MAX_COMMISSION_EUR = 1000;
const MAX_MONEY_EUR = 100000;

const text = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, max) : "");
const euros = (v) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "") ? Math.round(Number(v) * 100) : NaN);
const sinceOf = (w) => {
  const days = WINDOWS[w] === undefined ? 30 : WINDOWS[w];
  return days === null ? "1970-01-01" : new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
};

const slugOf = (name) => {
  const slug = text(name, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return REF_CODE_RE.test(slug) ? slug : "ref";
};

function cleanDestination(v) {
  const d = text(v, 100) || "/";
  if (!/^\/[A-Za-z0-9\-_/]*$/.test(d)) throw httpError(400, "The landing page must be a path on this site, such as / or /apply/.");
  return d;
}

const linkOut = (r, stats) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  sourceId: r.source_id,
  sourceName: r.source_name,
  commissionCents: r.commission_cents,
  destination: r.destination,
  status: r.status,
  notes: r.notes,
  createdBy: r.created_by,
  createdAt: r.created_at,
  stats: stats ?? undefined,
});

/**
 * Referral links, managed by admins only: who the link is for, which brand/channel it belongs to, the fixed commission
 * per paying student, and the numbers (visits, sign-ups, payments, what is owed). Partners never sign in to anything.
 */
export function mountAffiliates(router, { db }) {
  const view = requireAdmin(db, { permission: "affiliates.view" });
  const manage = requireAdmin(db, { permission: "affiliates.manage" });

  async function linkOr404(id) {
    if (!UUID_RE.test(String(id))) throw httpError(404, "Link not found.");
    const { rows } = await db.query("SELECT l.*, s.name AS source_name FROM referral_links l JOIN referral_sources s ON s.id = l.source_id WHERE l.id = $1", [id]);
    if (!rows[0]) throw httpError(404, "Link not found.");
    return rows[0];
  }
  async function sourceOr400(id) {
    if (!UUID_RE.test(String(id))) throw httpError(400, "Choose a source for this link.");
    const { rows } = await db.query("SELECT id FROM referral_sources WHERE id = $1", [id]);
    if (!rows[0]) throw httpError(400, "Choose a source for this link.");
    return id;
  }

  /** What each link has brought in. Counts for a period follow the sign-up date; money balances are always for all time. */
  async function statsByLink(since) {
    const out = new Map();
    const get = (id) => {
      if (!out.has(id))
        out.set(id, { clicks: 0, clicksTotal: 0, signups: 0, started: 0, paid: 0, earnedPeriod: 0, signupsAll: 0, paidAll: 0, earnedAll: 0, adjustments: 0, payouts: 0, owed: 0 });
      return out.get(id);
    };
    for (const r of (await db.query(`SELECT link_id, coalesce(sum(clicks) FILTER (WHERE day >= $1), 0)::int AS win, coalesce(sum(clicks), 0)::int AS total FROM referral_clicks GROUP BY link_id`, [since])).rows) {
      Object.assign(get(r.link_id), { clicks: r.win, clicksTotal: r.total });
    }
    const users = await db.query(
      `WITH pu AS (
         SELECT u.referral_link_id AS link_id, u.created_at, u.referral_commission_cents AS c,
                count(a.id) > 0 AS started, min(a.paid_at) AS paid_at
         FROM users u LEFT JOIN applications a ON a.user_id = u.id
         WHERE u.referral_link_id IS NOT NULL GROUP BY u.id)
       SELECT link_id,
              count(*) FILTER (WHERE created_at >= $1)::int AS signups,
              count(*) FILTER (WHERE created_at >= $1 AND started)::int AS started,
              count(*) FILTER (WHERE created_at >= $1 AND paid_at IS NOT NULL)::int AS paid,
              coalesce(sum(c) FILTER (WHERE created_at >= $1 AND paid_at IS NOT NULL), 0)::int AS earned_period,
              count(*)::int AS signups_all,
              count(*) FILTER (WHERE paid_at IS NOT NULL)::int AS paid_all,
              coalesce(sum(c) FILTER (WHERE paid_at IS NOT NULL), 0)::int AS earned_all
       FROM pu GROUP BY link_id`,
      [since],
    );
    for (const r of users.rows)
      Object.assign(get(r.link_id), { signups: r.signups, started: r.started, paid: r.paid, earnedPeriod: r.earned_period, signupsAll: r.signups_all, paidAll: r.paid_all, earnedAll: r.earned_all });
    for (const r of (
      await db.query(
        `SELECT link_id, coalesce(sum(amount_cents) FILTER (WHERE kind = 'payout'), 0)::int AS payouts,
                coalesce(sum(amount_cents) FILTER (WHERE kind = 'adjustment'), 0)::int AS adjustments
         FROM referral_payments GROUP BY link_id`,
      )
    ).rows)
      Object.assign(get(r.link_id), { payouts: r.payouts, adjustments: r.adjustments });
    for (const s of out.values()) s.owed = s.earnedAll + s.adjustments - s.payouts;
    return get;
  }

  async function owedFor(linkId) {
    const get = await statsByLink("1970-01-01");
    return get(linkId).owed;
  }

  // ----- the dashboard: totals, each source (brand), each link -----
  router.get(
    "/affiliates",
    view,
    safe(async (req, res) => {
      const window = Object.hasOwn(WINDOWS, req.query.window) ? req.query.window : "30d";
      const get = await statsByLink(sinceOf(window));
      const links = (await db.query("SELECT l.*, s.name AS source_name FROM referral_links l JOIN referral_sources s ON s.id = l.source_id ORDER BY l.created_at DESC")).rows.map((r) => linkOut(r, get(r.id)));
      const sources = (await db.query("SELECT id, name FROM referral_sources ORDER BY lower(name)")).rows;
      const sum = (rows, k) => rows.reduce((n, r) => n + r.stats[k], 0);
      const roll = (rows) => ({
        links: rows.length,
        clicks: sum(rows, "clicks"),
        signups: sum(rows, "signups"),
        started: sum(rows, "started"),
        paid: sum(rows, "paid"),
        earnedPeriod: sum(rows, "earnedPeriod"),
        owed: sum(rows, "owed"),
        payouts: sum(rows, "payouts"),
      });
      res.json({
        window,
        totals: roll(links),
        bySource: sources
          .map((s) => ({ id: s.id, name: s.name, ...roll(links.filter((l) => l.sourceId === s.id)) }))
          .filter((s) => s.links > 0)
          .sort((a, b) => b.signups - a.signups || b.clicks - a.clicks || a.name.localeCompare(b.name)),
        sources: sources.map((s) => ({ ...s, links: links.filter((l) => l.sourceId === s.id).length })),
        links,
      });
    }),
  );

  router.get(
    "/affiliates/links/:id",
    view,
    safe(async (req, res) => {
      const row = await linkOr404(req.params.id);
      const get = await statsByLink("1970-01-01");
      const days = (await db.query("SELECT day::text AS day, clicks FROM referral_clicks WHERE link_id = $1 AND day > (now() AT TIME ZONE 'UTC')::date - 30 ORDER BY day", [row.id])).rows;
      const byDay = new Map(days.map((d) => [d.day, d.clicks]));
      const daily = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
        daily.push({ day: d, clicks: byDay.get(d) ?? 0 });
      }
      const payments = (await db.query("SELECT id, kind, amount_cents, note, created_by, created_at FROM referral_payments WHERE link_id = $1 ORDER BY created_at DESC, id DESC", [row.id])).rows.map((p) => ({
        id: Number(p.id),
        kind: p.kind,
        amountCents: p.amount_cents,
        note: p.note,
        createdBy: p.created_by,
        createdAt: p.created_at,
      }));
      res.json({ link: linkOut(row, get(row.id)), daily, payments });
    }),
  );

  // ----- links -----
  function readLink(body, { creating }) {
    const name = text(body?.name, 80);
    if (name.length < 2) throw httpError(400, "Give the link a name (who or what it is for).");
    const commission = euros(body?.commissionEur);
    if (!Number.isInteger(commission) || commission < 0 || commission > MAX_COMMISSION_EUR * 100)
      throw httpError(400, `Commission must be an amount between €0 and €${MAX_COMMISSION_EUR}.`);
    const status = body?.status === "paused" ? "paused" : "active";
    return { name, commission, destination: cleanDestination(body?.destination), notes: text(body?.notes, 500), status: creating ? "active" : status };
  }

  router.post(
    "/affiliates/links",
    manage,
    safe(async (req, res) => {
      const v = readLink(req.body, { creating: true });
      const sourceId = await sourceOr400(req.body?.sourceId);
      let code = req.body?.code ? cleanRefCode(req.body.code) : "";
      if (req.body?.code && !code) throw httpError(400, "The code must be 3 to 40 characters: lowercase letters, numbers and hyphens.");
      const auto = !code;
      if (auto) code = slugOf(v.name);
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const { rows } = await db.query(
            `INSERT INTO referral_links (code, name, source_id, commission_cents, destination, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [code, v.name, sourceId, v.commission, v.destination, v.notes, req.admin.email],
          );
          await logAdmin(db, req.admin, "affiliate_link_created", code, { name: v.name, commissionCents: v.commission }, req);
          return res.json({ id: rows[0].id, code });
        } catch (err) {
          if (err.code !== "23505") throw err;
          if (!auto) throw httpError(409, "That code is already used by another link. Choose a different one.");
          code = `${slugOf(v.name).slice(0, 34)}-${crypto.randomBytes(2).toString("hex")}`;
        }
      }
      throw httpError(409, "Could not find a free code. Try typing one.");
    }),
  );

  router.post(
    "/affiliates/links/:id",
    manage,
    safe(async (req, res) => {
      const row = await linkOr404(req.params.id);
      const v = readLink(req.body, { creating: false });
      const sourceId = await sourceOr400(req.body?.sourceId);
      await db.query(
        `UPDATE referral_links SET name=$2, source_id=$3, commission_cents=$4, destination=$5, status=$6, notes=$7, updated_at=now() WHERE id=$1`,
        [row.id, v.name, sourceId, v.commission, v.destination, v.status, v.notes],
      );
      await logAdmin(
        db,
        req.admin,
        "affiliate_link_updated",
        row.code,
        { name: v.name, status: v.status, commissionCents: v.commission, previousCommissionCents: row.commission_cents },
        req,
      );
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/affiliates/links/:id",
    manage,
    safe(async (req, res) => {
      const row = await linkOr404(req.params.id);
      const used = (
        await db.query(
          `SELECT (SELECT count(*) FROM referral_clicks WHERE link_id = $1) + (SELECT count(*) FROM users WHERE referral_link_id = $1) + (SELECT count(*) FROM referral_payments WHERE link_id = $1) AS n`,
          [row.id],
        )
      ).rows[0].n;
      if (Number(used) > 0) throw httpError(409, "This link already has visits, sign-ups or payments, so it can't be deleted. Pause it instead.");
      await db.query("DELETE FROM referral_links WHERE id = $1", [row.id]);
      await logAdmin(db, req.admin, "affiliate_link_deleted", row.code, { name: row.name }, req);
      res.json({ ok: true });
    }),
  );

  // ----- money: what was paid out to the partner, and corrections -----
  router.post(
    "/affiliates/links/:id/payments",
    manage,
    safe(async (req, res) => {
      const row = await linkOr404(req.params.id);
      const kind = req.body?.kind === "adjustment" ? "adjustment" : "payout";
      const amount = euros(req.body?.amountEur);
      const note = text(req.body?.note, 300);
      if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_MONEY_EUR * 100) throw httpError(400, "Enter an amount.");
      if (kind === "payout") {
        if (amount < 0) throw httpError(400, "A payout is a positive amount. Use a correction for anything else.");
        const owed = await owedFor(row.id);
        if (amount > owed)
          throw httpError(409, `Only €${(Math.max(owed, 0) / 100).toFixed(2)} is owed on this link, so a payout of €${(amount / 100).toFixed(2)} is too much. (Use a correction if the earnings need adjusting first.)`);
      } else if (!note) throw httpError(400, "Add a short note saying what the correction is for.");
      const { rows } = await db.query("INSERT INTO referral_payments (link_id, kind, amount_cents, note, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id", [row.id, kind, amount, note, req.admin.email]);
      await logAdmin(db, req.admin, "affiliate_payment", row.code, { kind, amountCents: amount, note }, req);
      res.json({ ok: true, id: Number(rows[0].id) });
    }),
  );

  router.delete(
    "/affiliates/links/:id/payments/:paymentId",
    manage,
    safe(async (req, res) => {
      const row = await linkOr404(req.params.id);
      const pid = Number(req.params.paymentId);
      if (!Number.isInteger(pid)) throw httpError(404, "Entry not found.");
      const { rows } = await db.query("DELETE FROM referral_payments WHERE id = $1 AND link_id = $2 RETURNING kind, amount_cents, note", [pid, row.id]);
      if (!rows[0]) throw httpError(404, "Entry not found.");
      await logAdmin(db, req.admin, "affiliate_payment_removed", row.code, { kind: rows[0].kind, amountCents: rows[0].amount_cents, note: rows[0].note }, req);
      res.json({ ok: true });
    }),
  );

  // ----- sources (the brands and channels links belong to) -----
  const cleanSourceName = (v) => {
    const name = text(v, 40);
    if (name.length < 2) throw httpError(400, "Give the source a name, for example “Instagram” or “Partner agency”.");
    return name;
  };
  const sourceConflict = (err) => {
    if (err.code === "23505") throw httpError(409, "There is already a source with that name.");
    throw err;
  };

  router.post(
    "/affiliates/sources",
    manage,
    safe(async (req, res) => {
      const name = cleanSourceName(req.body?.name);
      try {
        const { rows } = await db.query("INSERT INTO referral_sources (name) VALUES ($1) RETURNING id", [name]);
        await logAdmin(db, req.admin, "affiliate_source_created", name, {}, req);
        res.json({ id: rows[0].id });
      } catch (err) {
        sourceConflict(err);
      }
    }),
  );

  router.post(
    "/affiliates/sources/:id",
    manage,
    safe(async (req, res) => {
      if (!UUID_RE.test(req.params.id)) throw httpError(404, "Source not found.");
      const name = cleanSourceName(req.body?.name);
      try {
        const { rows } = await db.query("UPDATE referral_sources SET name = $2 WHERE id = $1 RETURNING id", [req.params.id, name]);
        if (!rows[0]) throw httpError(404, "Source not found.");
      } catch (err) {
        sourceConflict(err);
      }
      // People who already signed up keep the name they were labelled with at the time; new sign-ups use the new name.
      await logAdmin(db, req.admin, "affiliate_source_renamed", name, {}, req);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/affiliates/sources/:id",
    manage,
    safe(async (req, res) => {
      if (!UUID_RE.test(req.params.id)) throw httpError(404, "Source not found.");
      const { rows: src } = await db.query("SELECT name, (SELECT count(*) FROM referral_links WHERE source_id = $1)::int AS links FROM referral_sources WHERE id = $1", [req.params.id]);
      if (!src[0]) throw httpError(404, "Source not found.");
      if (src[0].links > 0) throw httpError(409, "Links still use this source. Move or delete them first.");
      await db.query("DELETE FROM referral_sources WHERE id = $1", [req.params.id]);
      await logAdmin(db, req.admin, "affiliate_source_deleted", src[0].name, {}, req);
      res.json({ ok: true });
    }),
  );
}
