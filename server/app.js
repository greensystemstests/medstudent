import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { mountAccountRoutes } from "./accountRoutes.js";
import { mountAdmin } from "./admin/index.js";
import {
  mountWorkflow,
  sessionAuth,
  safe,
  ownApplication,
  createCheckout,
  createHostedCheckout,
  settleCheckoutSession,
  httpError,
} from "./workflow.js";
import { paidExtras, recordPayment } from "./billing.js";
import { ONBOARDING_FEE, PAYMENT_SOURCE } from "./pricing.js";
import { POLICY_VERSION } from "../shared/admissions.js";
import { rateLimit } from "./rateLimit.js";
import { mountPublicContent } from "./admin/content.js";
import { CLIENT_KINDS, createMonitor, routeOf } from "./monitor.js";
import { userForToken } from "./db.js";
export { ONBOARDING_FEE };

export function describeIntent(intent) {
  const paid =
    intent.status === "succeeded" &&
    intent.amount === ONBOARDING_FEE.amount &&
    intent.currency === ONBOARDING_FEE.currency;
  return {
    paymentIntentId: intent.id,
    status: intent.status,
    paid,
    amount: intent.amount,
    currency: intent.currency,
    receiptRef: intent.id.slice(-10).toUpperCase(),
    createdAt: new Date(intent.created * 1000).toISOString(),
  };
}
export function createApp({
  stripe,
  config,
  billing = null,
  accounts = null,
  log = console.log,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const db = accounts?.db;
  const monitor = createMonitor(db, log);
  const billingReady = Boolean(
    db &&
    billing?.resend &&
    billing?.seller &&
    billing?.fromEmail &&
    billing?.saleNotifyEmail,
  );
  const accountsConfigured = Boolean(
    db && accounts?.fileKey && accounts?.deliverCode,
  );
  // Go-live switches: read per request (cached briefly) from the database in production, so turning
  // payments on is one SQL update, not a redeploy. Tests and local runs pass fixed values in config.
  const flags = config.flags || (async () => ({
    checkoutEnabled: Boolean(config.checkoutEnabled),
    legalApproved: Boolean(config.legalApproved),
  }));
  const paymentsReady = async () => {
    const f = await flags();
    return Boolean(
      stripe &&
      config.publishableKey &&
      config.webhookSecret &&
      billingReady &&
      accountsConfigured &&
      f.checkoutEnabled &&
      f.legalApproved,
    );
  };
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    safe(async (req, res) => {
      if (!stripe || !config.webhookSecret || !db)
        throw httpError(
          503,
          "Payment event storage is unavailable. Retry required.",
        );
      let event;
      try {
        // The async variant works on every runtime (Node and the Edge Function's Web Crypto).
        event = await stripe.webhooks.constructEventAsync(
          req.body,
          req.headers["stripe-signature"],
          config.webhookSecret,
        );
      } catch {
        await monitor.record({ source: "server", kind: "webhook_failed", message: "Stripe webhook signature check failed (wrong signing secret, or not from Stripe)", route: "/api/stripe/webhook", status: 400 });
        throw Object.assign(httpError(400, "Invalid webhook signature."), { recorded: true });
      }
      // Lets the admin see that Stripe is really reaching us, and in which mode (test or live).
      await db
        .query(
          `INSERT INTO app_settings (key, value) VALUES ('last_webhook', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [JSON.stringify({ type: event.type, live: Boolean(event.livemode) })],
        )
        .catch(() => {});
      if (event.type === "checkout.session.async_payment_failed")
        await monitor.record({ source: "server", kind: "payment_failed", message: "A delayed payment method failed after the student left checkout", route: "/api/stripe/webhook", status: 200 });
      const intent = event.data?.object;
      if (
        intent?.metadata?.source === PAYMENT_SOURCE &&
        event.type === "payment_intent.succeeded"
      ) {
        // Acknowledge only after the ledger and per-recipient jobs are durably recorded.
        await recordPayment(db, intent, billing?.invoiceStartNumber || 1);
      }
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      )
        await settleCheckoutSession(
          db,
          stripe,
          intent,
          billing?.invoiceStartNumber || 1,
        );
      log(JSON.stringify({ event: event.type, paymentIntentId: intent?.id }));
      void config.sweep?.(); // send the receipt now rather than waiting for the next scheduled sweep
      res.json({ received: true });
    }),
  );
  app.use(
    "/api",
    cors({
      origin: (origin, cb) =>
        cb(null, !origin || config.allowedOrigins.includes(origin)),
      methods: ["GET", "POST", "DELETE"],
    }),
  );
  app.use("/api", express.json({ limit: "32kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  // Problems seen in the visitor's browser. Always answers 204 (the page never waits on it or retries).
  app.post(
    "/api/client-events",
    rateLimit({ windowMs: 60_000, max: accounts?.rateLimits?.clientEvents ?? 30 }),
    safe(async (req, res) => {
      const b = req.body || {};
      if (CLIENT_KINDS.includes(b.kind) && db) {
        const header = req.get("authorization") || "";
        const user = header.startsWith("Bearer ") ? await userForToken(db, header.slice(7)).catch(() => null) : null;
        await monitor.record({
          source: "client",
          kind: b.kind,
          message: b.message,
          route: typeof b.route === "string" ? b.route : undefined,
          page: typeof b.page === "string" && b.page.startsWith("/") ? b.page : undefined,
          step: Number.isInteger(b.step) ? b.step : undefined,
          status: Number.isInteger(b.status) ? b.status : undefined,
          userId: user?.id,
        });
      }
      res.status(204).end();
    }),
  );
  mountAccountRoutes(app, {
    billing,
    bookingUrl: config.bookingUrl || null,
    db: db || null,
    fileKey: accounts?.fileKey || null,
    deliverCode: accounts?.deliverCode || null,
    rateLimits: accounts?.rateLimits,
    stripe,
    log,
    monitor,
  });
  mountWorkflow(app, {
    db,
    fileKey: accounts?.fileKey,
    staffEmails: config.staffEmails || [],
    stripe,
    billing,
  });
  const status = async () => {
    const f = await flags();
    const ready = await paymentsReady();
    let databaseReady = false;
    if (db) {
      try {
        await db.query("SELECT 1");
        databaseReady = true;
      } catch {}
    }
    return {
      ok: !db || databaseReady,
      build: config.buildSha || "local",
      paymentsReady: ready && databaseReady,
      billingReady: billingReady && databaseReady,
      accountsReady: accountsConfigured && databaseReady,
      policyVersion: POLICY_VERSION,
      legalApproved: f.legalApproved,
      company: f.legalApproved
        ? {
            name: billing?.seller?.name,
            address: billing?.seller?.address,
            postcode: billing?.seller?.postcode,
            city: billing?.seller?.city,
            country: billing?.seller?.country,
            registration: billing?.seller?.companyNumber,
            vatNumber: billing?.seller?.vatNumber,
            email: config.supportEmail,
          }
        : null,
    };
  };
  mountPublicContent(app, { db: db || null });
  mountAdmin(app, {
    db: db || null,
    fileKey: accounts?.fileKey || null,
    deliverAdminCode: accounts?.deliverAdminCode || null,
    deliverAdminInvite: accounts?.deliverAdminInvite || null,
    rateLimits: accounts?.rateLimits,
    log,
    monitor,
    // What the admin's Monitoring page shows about the running system (no secrets, only yes/no and modes).
    systemStatus: async () => ({ ...(await status()), flags: await flags(), stripeMode: config.stripeMode || (stripe ? "unknown" : "none") }),
  });
  app.get(
    "/api/health",
    safe(async (_req, res) => {
      const s = await status();
      res.status(s.ok ? 200 : 503).json(s);
    }),
  );
  app.get(
    "/api/ready",
    safe(async (_req, res) => {
      const s = await status();
      res.status(s.paymentsReady ? 200 : 503).json(s);
    }),
  );
  app.get(
    "/api/config",
    safe(async (_req, res) => {
      const s = await status();
      if (!s.paymentsReady)
        throw httpError(
          503,
          "Online payments are not available yet. You can keep your draft and return later.",
        );
      res.json({
        publishableKey: config.publishableKey,
        amount: ONBOARDING_FEE.amount,
        currency: ONBOARDING_FEE.currency,
        testMode: config.publishableKey.startsWith("pk_test_"),
      });
    }),
  );
  const auth = sessionAuth(db);
  // A paid response also carries the invoice summary and the booking link. They are produced here and
  // nowhere else, only for the signed-in owner, and only once the payment is confirmed.
  const describePaid = async (user, pi) => {
    const described = describeIntent(pi);
    if (!described.paid) return described;
    return { ...described, ...(await paidExtras(db, config, user, pi)) };
  };
  app.post(
    "/api/payment-intent",
    rateLimit({ windowMs: 60_000, max: 20 }),
    auth,
    safe(async (req, res) => {
      if (!(await paymentsReady()))
        throw httpError(503, "Online payments are not available yet.");
      if (req.body.policyVersion !== POLICY_VERSION)
        throw httpError(
          409,
          "Service terms have changed. Refresh and review them before checkout.",
        );
      const pi = await createCheckout(
        db,
        stripe,
        req.user,
        req.body.applicationId,
        req.body.version,
      );
      if (describeIntent(pi).paid)
        await recordPayment(db, pi, billing.invoiceStartNumber || 1);
      res.json({ ...describeIntent(pi), clientSecret: pi.client_secret });
    }),
  );
  // Stripe Checkout (embedded form): returns the client_secret the browser renders the form with.
  app.post(
    "/api/checkout-session",
    rateLimit({ windowMs: 60_000, max: 20 }),
    auth,
    safe(async (req, res) => {
      if (!(await paymentsReady()))
        throw httpError(503, "Online payments are not available yet.");
      if (req.body.policyVersion !== POLICY_VERSION)
        throw httpError(
          409,
          "Service terms have changed. Refresh and review them before checkout.",
        );
      const session = await createHostedCheckout(
        db,
        stripe,
        req.user,
        req.body.applicationId,
        req.body.version,
      );
      res.json({ sessionId: session.id, client_secret: session.client_secret });
    }),
  );
  // Called by the return page; the webhook does the same, whichever arrives first.
  app.get(
    "/api/checkout-session/:id",
    auth,
    safe(async (req, res) => {
      if (!stripe)
        throw httpError(503, "Payment status is temporarily unavailable.");
      const row = await ownApplication(
        db,
        String(req.query.applicationId),
        req.user.id,
      );
      if (!row.checkout_session_id || row.checkout_session_id !== req.params.id)
        throw httpError(404, "Payment not found.");
      const session = await stripe.checkout.sessions.retrieve(req.params.id);
      const pi = await settleCheckoutSession(
        db,
        stripe,
        session,
        billing?.invoiceStartNumber || 1,
      );
      if (pi) return res.json(await describePaid(req.user, pi));
      res.json({
        paid: false,
        status: session.status === "expired" ? "expired" : "processing",
      });
    }),
  );
  app.get(
    "/api/payment-intent/:id",
    auth,
    safe(async (req, res) => {
      if (!stripe)
        throw httpError(503, "Payment status is temporarily unavailable.");
      const row = await ownApplication(
        db,
        String(req.query.applicationId),
        req.user.id,
      );
      if (row.payment_intent_id !== req.params.id)
        throw httpError(404, "Payment not found.");
      const pi = await stripe.paymentIntents.retrieve(req.params.id);
      if (
        pi.metadata?.application_id !== row.id ||
        pi.metadata?.source !== PAYMENT_SOURCE
      )
        throw httpError(404, "Payment not found.");
      if (describeIntent(pi).paid)
        await recordPayment(db, pi, billing?.invoiceStartNumber || 1);
      res.json(await describePaid(req.user, pi));
    }),
  );
  // Cron/webhook nudge: retries any pending receipt emails. Harmless to call anytime: it only touches
  // jobs that are already due, at most once every few seconds, and returns nothing.
  app.all("/api/internal/sweep", (_req, res) => {
    void config.sweep?.();
    res.status(202).json({ ok: true });
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(async (err, req, res, _next) => {
    log(`API error: ${err.status || 500} ${err.message}`);
    // Unexpected failures only: ordinary refusals (400, 401, 404, 409…) and "not set up yet" (503) aren't bugs.
    if (!err.recorded && (!err.status || [500, 502, 504].includes(err.status)))
      await monitor.record({ source: "server", kind: "server_error", message: err.message, route: `${req.method} ${req.path}`, status: err.status || 500 });
    res
      .status(err.status || 500)
      .json({
        error: err.status
          ? err.message
          : "The request could not be completed. Please try again.",
      });
  });
  if (
    config.staticDir &&
    fs.existsSync(path.join(config.staticDir, "index.html"))
  ) {
    const root = path.resolve(config.staticDir);
    // The public site is https://studybg.ac. Copies on other hosts (e.g. *.onrender.com) stay out of search.
    app.use((req, res, next) => {
      if (/\.onrender\.com$/i.test(req.hostname || ""))
        res.setHeader("X-Robots-Tag", "noindex");
      next();
    });
    app.use(express.static(root, { index: false, redirect: false, maxAge: "1h" }));
    // Each page is pre-rendered to <path>/index.html at build time (scripts/prerender.mjs).
    // HTML is never cached, so a deploy is picked up straight away.
    app.get(/.*/, (req, res) => {
      const page = path.resolve(root, `.${path.posix.normalize(req.path)}`, "index.html");
      const inside = page.startsWith(root + path.sep);
      res.setHeader("Cache-Control", "no-cache");
      if (inside && fs.existsSync(page)) {
        if (!req.path.endsWith("/")) {
          const query = req.originalUrl.slice(req.path.length);
          return res.redirect(301, `${req.path}/${query}`);
        }
        return res.sendFile(page);
      }
      const notFound = path.join(root, "404.html");
      if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
      return res.sendFile(path.join(root, "index.html"));
    });
  }
  return app;
}
