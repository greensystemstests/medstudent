import { safe, httpError } from "../workflow.js";
import { requireAdmin } from "./middleware.js";
import { adminCan, logAdmin } from "./store.js";

const WINDOWS = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };
const windowOf = (v) => WINDOWS[v] ?? WINDOWS["7d"];
const FP_RE = /^[0-9a-f]{16}$/;

/** Site and user-flow monitoring: system status, grouped errors, where people get stuck, the funnel. */
export function mountMonitoring(router, { db, systemStatus }) {
  const view = requireAdmin(db, { permission: "monitoring.view" });
  const manage = requireAdmin(db, { permission: "monitoring.manage" });

  // ----- is the system healthy right now? -----
  router.get(
    "/monitoring/status",
    view,
    safe(async (_req, res) => {
      const s = systemStatus ? await systemStatus() : {};
      const webhook = (await db.query("SELECT value, updated_at FROM app_settings WHERE key = 'last_webhook'")).rows[0];
      let last = null;
      if (webhook) {
        try {
          last = { ...JSON.parse(webhook.value), at: webhook.updated_at };
        } catch {
          last = null;
        }
      }
      const emails = (
        await db.query(
          `SELECT count(*) FILTER (WHERE state = 'pending')::int AS pending,
                  count(*) FILTER (WHERE state = 'pending' AND attempts > 0)::int AS retrying,
                  count(*) FILTER (WHERE state = 'needs_review')::int AS needs_review,
                  coalesce(extract(epoch FROM now() - min(created_at) FILTER (WHERE state = 'pending')) / 60, 0)::int AS oldest_pending_minutes
           FROM email_outbox`,
        )
      ).rows[0];
      const errors = (
        await db.query(
          `SELECT count(*) FILTER (WHERE kind <> 'validation')::int AS total,
                  count(*) FILTER (WHERE source = 'server' AND kind <> 'validation')::int AS server,
                  count(*) FILTER (WHERE source = 'client' AND kind <> 'validation')::int AS client
           FROM error_events WHERE created_at > now() - interval '24 hours'`,
        )
      ).rows[0];
      res.json({
        database: s.ok !== false,
        build: s.build ?? "unknown",
        stripeMode: s.stripeMode ?? "none",
        paymentsReady: Boolean(s.paymentsReady),
        billingReady: Boolean(s.billingReady),
        accountsReady: Boolean(s.accountsReady),
        checkoutEnabled: Boolean(s.flags?.checkoutEnabled),
        legalApproved: Boolean(s.flags?.legalApproved),
        lastWebhook: last,
        emails: { pending: emails.pending, retrying: emails.retrying, needsReview: emails.needs_review, oldestPendingMinutes: emails.oldest_pending_minutes },
        errors24h: errors,
      });
    }),
  );

  // ----- errors, grouped: one row per problem, not one per occurrence -----
  router.get(
    "/monitoring/errors",
    view,
    safe(async (req, res) => {
      const params = [windowOf(req.query.window)];
      let kindSql = "";
      if (typeof req.query.kind === "string" && /^[a-z_]{2,40}$/.test(req.query.kind)) {
        params.push(req.query.kind);
        kindSql = `AND kind = $${params.length}`;
      }
      const { rows } = await db.query(
        `WITH g AS (
           SELECT fingerprint, kind, source,
                  (array_agg(message ORDER BY id DESC))[1] AS message,
                  (array_agg(coalesce(route, page) ORDER BY id DESC))[1] AS location,
                  count(*)::int AS count, min(created_at) AS first_seen, max(created_at) AS last_seen,
                  count(DISTINCT user_id)::int AS users, max(status) AS status
           FROM error_events
           WHERE created_at > now() - $1::interval AND kind <> 'validation' ${kindSql}
           GROUP BY fingerprint, kind, source)
         SELECT g.*, s.status AS state, s.note, s.updated_by, s.updated_at AS state_at,
                (s.status = 'resolved' AND g.last_seen > s.updated_at) AS recurred
         FROM g LEFT JOIN error_group_state s ON s.fingerprint = g.fingerprint
         ORDER BY g.last_seen DESC LIMIT 300`,
        params,
      );
      const stateOf = (r) => (r.state === "ignored" ? "ignored" : r.state === "resolved" && !r.recurred ? "resolved" : "open");
      const groups = rows.map((r) => ({
        fingerprint: r.fingerprint,
        kind: r.kind,
        source: r.source,
        message: r.message,
        location: r.location || "",
        count: r.count,
        users: r.users,
        status: r.status,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        state: stateOf(r),
        recurred: Boolean(r.recurred),
        note: r.note || "",
        stateBy: r.updated_by || null,
        stateAt: r.state_at || null,
      }));
      const counts = { open: 0, resolved: 0, ignored: 0 };
      for (const g of groups) counts[g.state] += 1;
      const want = ["open", "resolved", "ignored"].includes(req.query.state) ? req.query.state : "open";
      res.json({ groups: req.query.state === "all" ? groups : groups.filter((g) => g.state === want), counts });
    }),
  );

  router.get(
    "/monitoring/errors/:fingerprint",
    view,
    safe(async (req, res) => {
      if (!FP_RE.test(req.params.fingerprint)) throw httpError(404, "Not found.");
      // Who was affected is only shown to people who may see every student, so an "assigned only" role can't learn about others.
      const mayIdentify = adminCan(req.admin, "students.view") && req.admin.role_scope === "all";
      const { rows } = await db.query(
        `SELECT e.id, e.created_at, e.kind, e.source, e.message, e.route, e.page, e.status, e.step, e.user_id,
                u.email AS user_email,
                (SELECT a.id FROM applications a WHERE a.user_id = e.user_id ORDER BY a.updated_at DESC LIMIT 1) AS application_id
         FROM error_events e LEFT JOIN users u ON u.id = e.user_id
         WHERE e.fingerprint = $1 ORDER BY e.id DESC LIMIT 50`,
        [req.params.fingerprint],
      );
      if (!rows.length) throw httpError(404, "Not found.");
      res.json({
        events: rows.map((r) => ({
          id: r.id,
          at: r.created_at,
          kind: r.kind,
          source: r.source,
          message: r.message,
          route: r.route,
          page: r.page,
          status: r.status,
          step: r.step,
          signedIn: Boolean(r.user_id),
          user: mayIdentify && r.user_id ? { email: r.user_email, applicationId: r.application_id } : null,
        })),
      });
    }),
  );

  router.post(
    "/monitoring/errors/:fingerprint/state",
    manage,
    safe(async (req, res) => {
      if (!FP_RE.test(req.params.fingerprint)) throw httpError(404, "Not found.");
      const status = req.body?.status;
      if (!["open", "resolved", "ignored"].includes(status)) throw httpError(400, "Choose open, resolved or ignored.");
      const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 300) : "";
      const exists = await db.query("SELECT 1 FROM error_events WHERE fingerprint = $1 LIMIT 1", [req.params.fingerprint]);
      if (!exists.rows[0]) throw httpError(404, "Not found.");
      if (status === "open") await db.query("DELETE FROM error_group_state WHERE fingerprint = $1", [req.params.fingerprint]);
      else
        await db.query(
          `INSERT INTO error_group_state (fingerprint, status, note, updated_by) VALUES ($1,$2,$3,$4)
           ON CONFLICT (fingerprint) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [req.params.fingerprint, status, note, req.admin.email],
        );
      await logAdmin(db, req.admin, "error_state", `error:${req.params.fingerprint}`, { status }, req);
      res.json({ ok: true });
    }),
  );

  // ----- user flow: where people stop, and what blocks them -----
  router.get(
    "/monitoring/flow",
    view,
    safe(async (req, res) => {
      const interval = windowOf(req.query.window);
      const [accounts, apps, blocks, topBlocks] = await Promise.all([
        db.query("SELECT count(*)::int AS n FROM users WHERE created_at > now() - $1::interval", [interval]),
        db.query(
          `SELECT count(*)::int AS started,
                  ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `count(*) FILTER (WHERE current_step >= ${n})::int AS step${n}`).join(", ")},
                  count(*) FILTER (WHERE checkout_started_at IS NOT NULL)::int AS checkout,
                  count(*) FILTER (WHERE paid_at IS NOT NULL)::int AS paid,
                  count(*) FILTER (WHERE status = 'checkout' AND paid_at IS NULL AND checkout_started_at < now() - interval '1 hour')::int AS abandoned_checkout
           FROM applications WHERE created_at > now() - $1::interval`,
          [interval],
        ),
        db.query(
          `SELECT step, count(*)::int AS count FROM error_events
           WHERE kind = 'validation' AND step IS NOT NULL AND created_at > now() - $1::interval GROUP BY step ORDER BY step`,
          [interval],
        ),
        db.query(
          `SELECT step, (array_agg(message ORDER BY id DESC))[1] AS message, count(*)::int AS count
           FROM error_events WHERE kind = 'validation' AND created_at > now() - $1::interval
           GROUP BY step, fingerprint ORDER BY count(*) DESC LIMIT 12`,
          [interval],
        ),
      ]);
      const a = apps.rows[0];
      res.json({
        accountsCreated: accounts.rows[0].n,
        applicationsSaved: a.started,
        reachedStep: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ step: n, count: a[`step${n}`] })),
        checkoutStarted: a.checkout,
        paid: a.paid,
        abandonedCheckout: a.abandoned_checkout,
        blocksByStep: blocks.rows,
        topBlocks: topBlocks.rows,
      });
    }),
  );
}
