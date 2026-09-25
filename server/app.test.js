import assert from "node:assert/strict";
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  test,
} from "node:test";
import { createApp } from "./app.js";
import { connectDb, migrate, createLoginCode, verifyLoginCode } from "./db.js";
import { computeVat } from "./invoice.js";
import { fileKeyFromEnv } from "./fileCrypto.js";
import { processOutbox } from "./billing.js";
import { sendChecked } from "./mail.js";
import {
  FORM_DEFAULTS,
  CALL_WINDOWS,
  callDays,
  POLICY_VERSION,
  validateApplication,
  preliminaryResult,
} from "../shared/admissions.js";

const DB_URL = process.env.TEST_DATABASE_URL;
if (DB_URL && !new URL(DB_URL).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must use a disposable database whose name ends with _test",
  );
const seller = {
  name: "Test Company",
  eik: "123456789",
  address: "1 Test Street",
  city: "Sofia",
  vatNumber: "",
};
function stripeFake() {
  const intents = new Map(),
    keys = new Map();
  return {
    intents,
    keys,
    paymentIntents: {
      async create(params, { idempotencyKey }) {
        if (keys.has(idempotencyKey))
          return intents.get(keys.get(idempotencyKey));
        const id = `pi_test${keys.size + 1}`;
        const pi = {
          id,
          client_secret: id + "_secret",
          status: "requires_payment_method",
          created: 1790000000,
          ...params,
        };
        keys.set(idempotencyKey, id);
        intents.set(id, pi);
        return pi;
      },
      async retrieve(id) {
        if (!intents.has(id)) throw new Error("Missing intent");
        return intents.get(id);
      },
      async cancel(id) {
        const pi = intents.get(id);
        pi.status = "canceled";
        return pi;
      },
      async search() {
        return { data: [] };
      },
    },
    webhooks: {
      constructEvent(body, sig) {
        if (sig !== "valid") throw new Error("bad signature");
        return JSON.parse(body.toString());
      },
    },
  };
}
const fullForm = (email) => ({
  ...FORM_DEFAULTS,
  fullName: "Synthetic Applicant",
  email,
  citizenshipCountry: "France",
  nationalityCategory: "eu_eea",
  schoolCountry: "France",
  graduationYear: "2026",
  universityId: "mu-plovdiv",
  degree: "Pharmacy",
  intakeSeason: "Next available intake",
  biologyGrade: "60",
  chemistryGrade: "80",
  englishProficiency: "native",
  hasDiploma: true,
  hasTranscript: true,
  examDate: "advisor",
  consultationDate: callDays()[0],
  consultationWindow: CALL_WINDOWS[0],
  termsAgreed: true,
  gdprAgreed: true,
  accuracySigned: true,
});

test("shared validation accepts university-specific average and rejects stale dates/forged enums", () => {
  const f = fullForm("synthetic@example.com");
  assert.deepEqual(validateApplication(f), []);
  assert.match(preliminaryResult("mu-plovdiv", "60", "80"), /meets/);
  assert.match(preliminaryResult("mu-pleven", "90", "90"), /review/);
  assert.ok(
    validateApplication({ ...f, consultationDate: "2000-01-01" }).length,
  );
  assert.ok(validateApplication({ ...f, degree: "Fake" }).length);
  assert.ok(validateApplication({ ...f, termsAgreed: "true" }).length);
});
test("provider errors and malformed responses never count as sent", async () => {
  await assert.rejects(
    () =>
      sendChecked(
        {
          emails: {
            send: async () => ({ data: null, error: { message: "rejected" } }),
          },
        },
        { to: "synthetic@example.com" },
      ),
    /rejected/,
  );
  await assert.rejects(() =>
    sendChecked({ emails: { send: async () => ({}) } }, {}),
  );
});

describe(
  "durable application, checkout and review API",
  { skip: !DB_URL && "TEST_DATABASE_URL not set" },
  () => {
    let db,
      server,
      base,
      stripe,
      billing,
      app,
      token,
      otherToken,
      sent,
      failReceipt;
    const codes = new Map();
    const call = (
      path,
      { method = "GET", json, auth = token, headers = {} } = {},
    ) =>
      fetch(base + path, {
        method,
        headers: {
          ...(json ? { "content-type": "application/json" } : {}),
          ...(auth ? { authorization: `Bearer ${auth}` } : {}),
          ...headers,
        },
        body: json ? JSON.stringify(json) : undefined,
      });
    async function login(email) {
      await call("/api/auth/request-code", {
        method: "POST",
        auth: null,
        json: { email },
      });
      const r = await call("/api/auth/verify", {
        method: "POST",
        auth: null,
        json: { email, code: codes.get(email) },
      });
      assert.equal(r.status, 200, await r.clone().text());
      return (await r.json()).token;
    }
    async function draft() {
      const r = await call("/api/applications/app-test-000000001", {
        method: "POST",
        json: { form: fullForm("synthetic@example.com"), currentStep: 8 },
      });
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    }
    async function checkout(a) {
      const r = await call("/api/payment-intent", {
        method: "POST",
        json: {
          applicationId: a.id,
          version: a.version,
          policyVersion: POLICY_VERSION,
          amount: 1,
        },
      });
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    }
    async function webhook(pi) {
      return call("/api/stripe/webhook", {
        method: "POST",
        auth: null,
        json: { type: "payment_intent.succeeded", data: { object: pi } },
        headers: { "stripe-signature": "valid" },
      });
    }
    before(async () => {
      db = connectDb(DB_URL);
      await db.query(
        "DROP TABLE IF EXISTS staff_audit,email_outbox,invoices,invoice_counter,application_consents,applications,activity,documents,sessions,login_codes,users CASCADE",
      );
      await migrate(db);
      await migrate(db);
    });
    beforeEach(async () => {
      await db.query(
        "TRUNCATE staff_audit,email_outbox,invoices,invoice_counter,application_consents,applications,activity,documents,sessions,login_codes,users CASCADE",
      );
      codes.clear();
      stripe = stripeFake();
      sent = [];
      failReceipt = false;
      billing = {
        seller,
        fromEmail: "billing@example.com",
        saleNotifyEmail: "owner@example.com",
        invoiceStartNumber: 501,
        resend: {
          emails: {
            async send(payload, opts) {
              if (failReceipt && payload.to === "synthetic@example.com")
                return {
                  data: null,
                  error: { message: "temporary provider rejection" },
                };
              const existing = sent.find((x) => x.key === opts?.idempotencyKey);
              if (existing) return { data: { id: existing.id }, error: null };
              const id = "mail_" + (sent.length + 1);
              sent.push({ id, payload, key: opts?.idempotencyKey });
              return { data: { id }, error: null };
            },
          },
        },
      };
      app = createApp({
        stripe,
        billing,
        accounts: {
          db,
          fileKey: fileKeyFromEnv("local-test-file-key"),
          deliverCode: async (e, c) => codes.set(e, c),
          rateLimits: { requestCode: 1000, verify: 1000, upload: 1000 },
        },
        config: {
          publishableKey: "pk_test_fake",
          webhookSecret: "whsec_fake",
          allowedOrigins: ["https://studybg.ac"],
          checkoutEnabled: true,
          legalApproved: true,
          staffEmails: ["reviewer@example.com"],
        },
        log: () => {},
      });
      await new Promise((r) => (server = app.listen(0, r)));
      base = `http://127.0.0.1:${server.address().port}`;
      token = await login("synthetic@example.com");
      otherToken = await login("other@example.com");
    });
    afterEach(async () => {
      if (server) {
        server.closeAllConnections();
        await new Promise((r) => server.close(r));
      }
    });
    test("readiness includes accounts and payment prerequisites", async () => {
      assert.equal((await call("/api/ready")).status, 200);
      assert.equal(
        (await (await call("/api/health")).json()).paymentsReady,
        true,
      );
    });
    test("saves the complete application; enforces ownership and optimistic version checks", async () => {
      const a = await draft();
      assert.equal(a.form.biologyGrade, "60");
      assert.equal(a.form.schoolCountry, "France");
      assert.equal(a.form.termsAgreed, true);
      assert.equal(
        (await call(`/api/applications/${a.id}`, { auth: otherToken })).status,
        404,
      );
      assert.equal(
        (await call(`/api/applications/${a.id}`, { auth: null })).status,
        401,
      );
      assert.equal(
        (
          await call(`/api/applications/${a.id}`, {
            method: "POST",
            json: { ...a, version: 0 },
          })
        ).status,
        409,
      );
    });
    test("checkout uses fixed server price, locks the form, and reuses the intent", async () => {
      const a = await draft(),
        pi = await checkout(a),
        again = await checkout(a);
      assert.equal(pi.amount, 18000);
      assert.equal(pi.paymentIntentId, again.paymentIntentId);
      assert.equal(stripe.keys.size, 1);
      assert.equal(
        (await call(`/api/applications/${a.id}`, { method: "POST", json: a }))
          .status,
        409,
      );
      const { rows } = await db.query("SELECT * FROM application_consents");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].form_snapshot.biologyGrade, "60");
      assert.equal(
        (
          await call(
            `/api/payment-intent/${pi.paymentIntentId}?applicationId=${a.id}`,
            { auth: otherToken },
          )
        ).status,
        404,
      );
    });
    test("cancels unpaid checkout before editing; retains each accepted version", async () => {
      const a = await draft(),
        pi = await checkout(a);
      const reopened = await (
        await call(`/api/applications/${a.id}/reopen`, {
          method: "POST",
          json: {},
        })
      ).json();
      assert.equal(stripe.intents.get(pi.paymentIntentId).status, "canceled");
      const again = await checkout(reopened);
      assert.notEqual(again.paymentIntentId, pi.paymentIntentId);
      assert.equal(
        (await db.query("SELECT * FROM application_consents")).rows.length,
        2,
      );
    });
    test("an uncertain create is durably reserved and cannot generate a new charge after idempotency expires", async () => {
      const a = await draft();
      stripe.paymentIntents.create = async () => {
        throw new Error("provider timeout");
      };
      assert.equal(
        (
          await call("/api/payment-intent", {
            method: "POST",
            json: {
              applicationId: a.id,
              version: a.version,
              policyVersion: POLICY_VERSION,
            },
          })
        ).status,
        500,
      );
      const row = (await db.query("SELECT * FROM applications")).rows[0];
      assert.ok(row.checkout_started_at);
      assert.equal(row.status, "checkout");
      assert.equal(
        (
          await call(`/api/applications/${a.id}/reopen`, {
            method: "POST",
            json: {},
          })
        ).status,
        409,
      );
      await db.query(
        "UPDATE applications SET checkout_started_at=now()-interval '25 hours'",
      );
      assert.equal(
        (
          await call("/api/payment-intent", {
            method: "POST",
            json: {
              applicationId: a.id,
              version: a.version,
              policyVersion: POLICY_VERSION,
            },
          })
        ).status,
        409,
      );
    });
    test("webhook persists invoice and recipient jobs before acknowledgment; redelivery deduplicates", async () => {
      const a = await draft(),
        p = await checkout(a),
        pi = stripe.intents.get(p.paymentIntentId);
      pi.status = "succeeded";
      assert.equal((await webhook(pi)).status, 200);
      assert.equal((await webhook(pi)).status, 200);
      assert.equal(sent.length, 0);
      assert.equal((await db.query("SELECT * FROM invoices")).rows.length, 1);
      assert.equal(
        (await db.query("SELECT * FROM email_outbox")).rows.length,
        2,
      );
      assert.equal(
        (await (await call(`/api/applications/${a.id}`)).json()).payment.status,
        "paid",
      );
      await processOutbox(db, billing);
      assert.equal(sent.length, 2);
      assert.equal(
        sent[0].payload.attachments[0].filename,
        "StudyBg-Invoice-0000000501.pdf",
      );
      assert.ok(
        (await db.query("SELECT pdf FROM invoices")).rows[0].pdf.length > 1000,
      );
      await processOutbox(db, billing);
      assert.equal(sent.length, 2);
    });
    test("failed receipt remains pending while accepted sale alert is not resent", async () => {
      const a = await draft(),
        p = await checkout(a),
        pi = stripe.intents.get(p.paymentIntentId);
      pi.status = "succeeded";
      await webhook(pi);
      failReceipt = true;
      await processOutbox(db, billing, { log: () => {} });
      let jobs = (
        await db.query("SELECT kind,state FROM email_outbox ORDER BY kind")
      ).rows;
      assert.equal(jobs.find((j) => j.kind === "receipt").state, "pending");
      assert.equal(jobs.find((j) => j.kind === "sale").state, "accepted");
      failReceipt = false;
      await db.query("UPDATE email_outbox SET next_attempt_at=now()");
      await processOutbox(db, billing);
      assert.equal(sent.length, 2);
      assert.equal(
        sent.filter((s) => s.payload.to === "owner@example.com").length,
        1,
      );
    });
    test("old ambiguous email attempt requires review instead of automatic resend", async () => {
      const a = await draft(),
        p = await checkout(a),
        pi = stripe.intents.get(p.paymentIntentId);
      pi.status = "succeeded";
      await webhook(pi);
      await db.query(
        "UPDATE email_outbox SET first_attempt_at=now()-interval '25 hours'",
      );
      await processOutbox(db, billing);
      assert.equal(sent.length, 0);
      assert.equal(
        (
          await db.query(
            "SELECT count(*) FROM email_outbox WHERE state='needs_review'",
          )
        ).rows[0].count,
        "2",
      );
    });
    test("staff access is deny-by-default and reviews create applicant activity and durable notifications", async () => {
      const a = await draft(),
        p = await checkout(a),
        pi = stripe.intents.get(p.paymentIntentId);
      pi.status = "succeeded";
      await webhook(pi);
      assert.equal((await call("/api/staff/applications")).status, 403);
      const reviewer = await login("reviewer@example.com");
      assert.equal(
        (await call("/api/staff/applications", { auth: reviewer })).status,
        200,
      );
      assert.equal(
        (
          await call(`/api/staff/applications/${a.id}/review`, {
            method: "POST",
            auth: reviewer,
            json: {
              status: "action_needed",
              note: "Please upload a clearer transcript.",
            },
          })
        ).status,
        200,
      );
      assert.equal(
        (await db.query("SELECT * FROM staff_audit")).rows.length,
        1,
      );
      assert.equal(
        (
          await db.query(
            "SELECT * FROM email_outbox WHERE kind='status_notice'",
          )
        ).rows.length,
        1,
      );
    });
    test("invalid signatures, mismatched amounts and stale policy versions are rejected", async () => {
      const a = await draft();
      assert.equal(
        (
          await call("/api/payment-intent", {
            method: "POST",
            json: {
              applicationId: a.id,
              version: a.version,
              policyVersion: "old",
            },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await call("/api/stripe/webhook", {
            method: "POST",
            json: {},
            headers: { "stripe-signature": "bad" },
          })
        ).status,
        400,
      );
      const p = await checkout(a),
        pi = stripe.intents.get(p.paymentIntentId);
      pi.status = "succeeded";
      pi.amount = 1;
      assert.equal((await webhook(pi)).status, 500);
      assert.equal((await db.query("SELECT * FROM invoices")).rows.length, 0);
    });
    test("staff document review is audited and visible to its owner", async () => {
      const pdf = Buffer.from("%PDF-1.4 synthetic test document");
      const uploaded = await fetch(
        base + "/api/me/documents?category=transcript&filename=transcript.pdf",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/octet-stream",
          },
          body: pdf,
        },
      );
      assert.equal(uploaded.status, 201, await uploaded.clone().text());
      const { document } = await uploaded.json();
      assert.equal(
        (await call(`/api/staff/documents/${document.id}/file`)).status,
        403,
      );
      const reviewer = await login("reviewer@example.com");
      const file = await call(`/api/staff/documents/${document.id}/file`, {
        auth: reviewer,
      });
      assert.equal(file.status, 200, await file.clone().text());
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
      assert.equal(
        (
          await call(`/api/staff/documents/${document.id}/review`, {
            auth: reviewer,
            method: "POST",
            json: {
              status: "action_needed",
              note: "Please provide the second page.",
            },
          })
        ).status,
        200,
      );
      const docs = await (await call("/api/me/documents")).json();
      assert.equal(docs.documents[0].status, "action_needed");
      assert.equal(
        docs.documents[0].reviewNote,
        "Please provide the second page.",
      );
      assert.equal(
        (await db.query("SELECT * FROM staff_audit")).rows.length,
        2,
      );
    });

    test("payment reconciliation survives webhook arriving before intent persistence", async () => {
      const a = await draft(),
        p = await checkout(a),
        pi = stripe.intents.get(p.paymentIntentId);
      pi.status = "succeeded";
      await db.query(
        "UPDATE applications SET payment_intent_id=NULL WHERE id=$1",
        [a.id],
      );
      assert.equal((await webhook(pi)).status, 200);
      await db.query(
        "UPDATE applications SET payment_intent_id=$2 WHERE id=$1",
        [a.id, pi.id],
      );
      assert.equal(
        (await call(`/api/payment-intent/${pi.id}?applicationId=${a.id}`))
          .status,
        200,
      );
      assert.equal(
        (await (await call(`/api/applications/${a.id}`)).json()).payment.status,
        "paid",
      );
      await db.query("UPDATE applications SET status='in_review' WHERE id=$1", [
        a.id,
      ]);
      await webhook(pi);
      assert.equal(
        (await (await call(`/api/applications/${a.id}`)).json()).status,
        "in_review",
      );
      assert.equal((await db.query("SELECT * FROM invoices")).rows.length, 1);
    });

    // Real PostgreSQL is required to exercise independent-session advisory locks.
    test(
      "concurrent code verification consumes a code exactly once",
      { skip: process.env.PGLITE_TEST === "true" },
      async () => {
        const { code } = await createLoginCode(db, "race@example.com");
        const r = await Promise.all([
          verifyLoginCode(db, "race@example.com", code),
          verifyLoginCode(db, "race@example.com", code),
        ]);
        assert.equal(r.filter((x) => x.token).length, 1);
      },
    );
    test(
      "concurrent duplicate webhooks allocate only one invoice",
      { skip: process.env.PGLITE_TEST === "true" },
      async () => {
        const a = await draft(),
          p = await checkout(a),
          pi = stripe.intents.get(p.paymentIntentId);
        pi.status = "succeeded";
        const r = await Promise.all([webhook(pi), webhook(pi), webhook(pi)]);
        assert.ok(r.every((x) => x.status === 200));
        assert.equal((await db.query("SELECT * FROM invoices")).rows.length, 1);
        await Promise.all([
          processOutbox(db, billing),
          processOutbox(db, billing),
        ]);
        assert.equal(sent.length, 2);
      },
    );
    after(async () => {
      await db.end();
    });
  },
);
describe("VAT math (computeVat)", () => {
  test("not VAT-registered: the full gross amount is the net amount, no VAT charged", () => {
    assert.deepEqual(computeVat(18000, false), {
      netMinor: 18000,
      vatMinor: 0,
    });
  });

  test("VAT-registered: net + VAT sum back exactly to the gross amount, at the 20% rate", () => {
    const { netMinor, vatMinor } = computeVat(18000, true);
    assert.equal(netMinor + vatMinor, 18000);
    assert.equal(Math.round(netMinor * 1.2), 18000);
  });

  test("rounding never loses or invents a cent, across a range of amounts", () => {
    for (const amount of [1, 99, 100, 12345, 18000, 999999]) {
      const { netMinor, vatMinor } = computeVat(amount, true);
      assert.equal(netMinor + vatMinor, amount);
    }
  });
});
