import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { mountAccountRoutes } from "./accountRoutes.js";
import {
  mountWorkflow,
  sessionAuth,
  safe,
  ownApplication,
  createCheckout,
  httpError,
} from "./workflow.js";
import { recordPayment } from "./billing.js";
import { ONBOARDING_FEE, PAYMENT_SOURCE } from "./pricing.js";
import { POLICY_VERSION } from "../shared/admissions.js";
import { rateLimit } from "./rateLimit.js";
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
  const paymentsReady = Boolean(
    stripe &&
    config.publishableKey &&
    config.webhookSecret &&
    billingReady &&
    accountsConfigured &&
    config.checkoutEnabled &&
    config.legalApproved,
  );
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
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers["stripe-signature"],
          config.webhookSecret,
        );
      } catch {
        throw httpError(400, "Invalid webhook signature.");
      }
      const intent = event.data?.object;
      if (
        intent?.metadata?.source === PAYMENT_SOURCE &&
        event.type === "payment_intent.succeeded"
      ) {
        // Acknowledge only after the ledger and per-recipient jobs are durably recorded.
        await recordPayment(db, intent, billing?.invoiceStartNumber || 1);
      }
      log(JSON.stringify({ event: event.type, paymentIntentId: intent?.id }));
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
  mountAccountRoutes(app, {
    db: db || null,
    fileKey: accounts?.fileKey || null,
    deliverCode: accounts?.deliverCode || null,
    rateLimits: accounts?.rateLimits,
    stripe,
    log,
  });
  mountWorkflow(app, {
    db,
    fileKey: accounts?.fileKey,
    staffEmails: config.staffEmails || [],
    stripe,
    billing,
  });
  const status = async () => {
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
      paymentsReady: paymentsReady && databaseReady,
      billingReady: billingReady && databaseReady,
      accountsReady: accountsConfigured && databaseReady,
      policyVersion: POLICY_VERSION,
      legalApproved: !!config.legalApproved,
      company: config.legalApproved
        ? {
            name: billing?.seller?.name,
            address: billing?.seller?.address,
            city: billing?.seller?.city,
            registration: billing?.seller?.eik,
            email: config.supportEmail,
          }
        : null,
    };
  };
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
  app.post(
    "/api/payment-intent",
    rateLimit({ windowMs: 60_000, max: 20 }),
    auth,
    safe(async (req, res) => {
      if (!paymentsReady)
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
      res.json(describeIntent(pi));
    }),
  );
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, _req, res, _next) => {
    log(`API error: ${err.status || 500} ${err.message}`);
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
    app.use(express.static(config.staticDir, { index: false, maxAge: "1h" }));
    app.get(/.*/, (_req, res) =>
      res.sendFile(path.join(config.staticDir, "index.html")),
    );
  }
  return app;
}
