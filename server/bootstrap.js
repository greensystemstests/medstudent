// Builds the whole API (Stripe, Resend, Postgres, Express app) from environment variables.
// Used by both entry points: server/index.js (a normal Node process) and the Supabase Edge Function
// (supabase/functions/studybg/index.ts). Keep this file free of anything runtime-specific.
import process from "node:process";
import { Resend } from "resend";
import Stripe from "stripe";
import { createApp } from "./app.js";
import {
  BOOKING_URL_DEFAULT,
  INVOICE_FROM_DEFAULT,
  SALE_NOTIFICATION_EMAIL_DEFAULT,
  SUPPORT_EMAIL_DEFAULT,
} from "./company.js";
import { connectDb, loadFlags, migrate } from "./db.js";
import { fileKeyFromEnv } from "./fileCrypto.js";
import { sellerFromEnv } from "./invoice.js";
import { processOutbox } from "./billing.js";
import { sendLoginCodeEmail } from "./mail.js";

const DEFAULT_ORIGINS = [
  "https://studybg.ac",
  "https://www.studybg.ac",
  "https://greensystemstests.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ runMigrations?: boolean, staticDir?: string, runtime?: 'node' | 'edge', waitUntil?: (p: Promise<unknown>) => void }} [options]
 */
export async function buildFromEnv(env = process.env, options = {}) {
  const { runMigrations = true, staticDir, runtime = "node", waitUntil } = options;
  const val = (key) => env[key]?.trim() || undefined;

  const secretKey = val("STRIPE_SECRET_KEY");
  const publishableKey = val("STRIPE_PUBLISHABLE_KEY");
  if (secretKey && !/^(sk|rk)_(test|live)_/.test(secretKey))
    throw new Error("STRIPE_SECRET_KEY must be a Stripe secret (sk_...) or restricted (rk_...) key.");
  if (publishableKey && !/^pk_(test|live)_/.test(publishableKey))
    throw new Error("STRIPE_PUBLISHABLE_KEY must be a Stripe publishable key (pk_...).");
  if (secretKey && publishableKey && secretKey.includes("_live_") !== publishableKey.includes("_live_"))
    throw new Error("STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY must both be test keys or both be live keys.");

  // Edge runtimes have no Node http agent: use the fetch-based client there.
  const stripe = secretKey
    ? new Stripe(secretKey, runtime === "edge" ? { httpClient: Stripe.createFetchHttpClient() } : {})
    : null;

  const resendKey = val("RESEND_API_KEY");
  const resend = resendKey ? new Resend(resendKey) : null;
  const seller = sellerFromEnv(env);
  const fromEmail = val("INVOICE_FROM_EMAIL") || INVOICE_FROM_DEFAULT;
  const supportEmail = val("SUPPORT_EMAIL") || SUPPORT_EMAIL_DEFAULT;
  const bookingUrl = val("BOOKING_URL") || BOOKING_URL_DEFAULT;
  const billing = {
    resend,
    seller,
    fromEmail,
    replyTo: supportEmail,
    bookingUrl,
    saleNotifyEmail: val("SALE_NOTIFICATION_EMAIL") || SALE_NOTIFICATION_EMAIL_DEFAULT,
    invoiceStartNumber: Math.max(1, Number(env.INVOICE_START_NUMBER) || 1),
  };

  // Supabase injects SUPABASE_DB_URL into every Edge Function; DATABASE_URL wins if set explicitly.
  const db = connectDb(val("DATABASE_URL") || val("SUPABASE_DB_URL"));
  if (db && runMigrations) await migrate(db);
  const fileKey = fileKeyFromEnv(val("FILE_ENCRYPTION_KEY"));
  const siteUrl = (val("SITE_URL") || "https://studybg.ac").replace(/\/+$/, "");
  const logLoginCodes = env.NODE_ENV !== "production" && !env.RENDER && env.LOG_LOGIN_CODES === "true";
  const deliverCode = resend
    ? (email, code) => sendLoginCodeEmail(resend, { from: fromEmail, replyTo: supportEmail, to: email, code, siteUrl })
    : logLoginCodes
      ? async (email, code) => console.log(`[dev] sign-in code for ${email}: ${code}`)
      : null;

  // Background job: retry pending emails (receipt + sale notice). Callable any time, cheap when idle.
  let sweeping = false;
  let lastSweep = 0;
  const sweep = async () => {
    if (sweeping || Date.now() - lastSweep < 15_000) return;
    sweeping = true;
    lastSweep = Date.now();
    try {
      await processOutbox(db, billing);
    } catch (error) {
      console.error("Outbox sweep failed:", error.message);
    } finally {
      sweeping = false;
    }
  };

  const envFlags = {
    checkoutEnabled: env.CHECKOUT_ENABLED === "true",
    legalApproved: env.LEGAL_APPROVED === "true",
  };
  const flags = loadFlags(db, envFlags);

  const app = createApp({
    stripe,
    billing,
    accounts: { db, fileKey, deliverCode },
    config: {
      publishableKey,
      flags: async () => {
        const f = await flags();
        // Legal pages are only "approved" once the seller details and a support address exist.
        return { checkoutEnabled: f.checkoutEnabled, legalApproved: f.legalApproved && Boolean(seller && supportEmail) };
      },
      supportEmail,
      bookingUrl,
      siteUrl,
      staffEmails: (env.STAFF_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
      buildSha: env.BUILD_SHA || env.RENDER_GIT_COMMIT || "local",
      webhookSecret: val("STRIPE_WEBHOOK_SECRET"),
      allowedOrigins: env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
        : DEFAULT_ORIGINS,
      staticDir,
      // On an edge runtime the isolate can stop after the response: waitUntil keeps it alive until the sweep ends.
      sweep: () => {
        const p = sweep();
        waitUntil?.(p);
        return p;
      },
    },
  });

  const stripeMode = !stripe || !publishableKey ? "NOT CONFIGURED" : secretKey.includes("_live_") ? "LIVE" : "test";
  const missing = [!db && "database URL", !resend && "RESEND_API_KEY", !seller && "company details"].filter(Boolean);
  const accountMissing = [!db && "database URL", !fileKey && "FILE_ENCRYPTION_KEY", !deliverCode && "RESEND_API_KEY"].filter(Boolean);
  const summary =
    `Stripe: ${stripeMode}, invoicing/email: ${missing.length ? `NOT CONFIGURED (missing ${missing.join(", ")})` : "ready"}, ` +
    `accounts: ${accountMissing.length ? `NOT CONFIGURED (missing ${accountMissing.join(", ")})` : "ready"}`;

  return { app, db, billing, sweep, summary };
}
