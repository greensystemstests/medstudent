import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { after, before, describe, test } from "node:test";
import { createApp } from "./app.js";
import { connectDb, migrate } from "./db.js";
import { fileKeyFromEnv } from "./fileCrypto.js";
import { createAdminSession } from "./admin/store.js";
import { ADMIN_MONITORING_SQL } from "./admin/schema.js";
import { createMonitor, fingerprintOf, routeOf } from "./monitor.js";

const DB_URL = process.env.TEST_DATABASE_URL;
if (DB_URL && !new URL(DB_URL).pathname.endsWith("_test"))
  throw new Error("Refusing to run: TEST_DATABASE_URL must name a database ending in _test.");

test("one problem gets one fingerprint however the ids and numbers differ; addresses are redacted", () => {
  assert.equal(routeOf("/api/applications/app-1a2b3c4d5e6f?x=1"), "/api/applications/:id");
  assert.equal(routeOf("/api/me/documents/0b7e2c1a-1111-4222-8333-444455556666/file"), "/api/me/documents/:id/file");
  assert.equal(fingerprintOf("api_error", "Request failed (500) for app-123456789", "/api/applications/app-aaaaaaaa"), fingerprintOf("api_error", "Request failed (500) for app-987654321", "/api/applications/app-bbbbbbbb"));
  assert.notEqual(fingerprintOf("api_error", "Request failed (500)", "/a"), fingerprintOf("js_error", "Request failed (500)", "/a"));
  assert.notEqual(fingerprintOf("js_error", "x is undefined", "/a"), fingerprintOf("js_error", "y is undefined", "/a"));
  assert.match(fingerprintOf("a", "b", "c"), /^[0-9a-f]{16}$/);
});

test("the production migration for phase 3 matches the code", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261118000200_admin_monitoring.sql", import.meta.url), "utf8");
  const squash = (x) => x.replace(/\s+/g, " ").trim();
  assert.equal(squash(sql.split("-- schema:start")[1].split("-- schema:end")[0]), squash(ADMIN_MONITORING_SQL));
  assert.ok(sql.includes("'error_events'") && sql.includes("'error_group_state'"));
});

describe("admin: monitoring", { skip: !DB_URL && "TEST_DATABASE_URL not set" }, () => {
  let db, server, base, tightServer, tightBase;
  let failSessions = false;
  let failEmails = false;
  const fileKey = fileKeyFromEnv("a-long-test-secret-for-admin-tests");
  const tokens = {};
  // A database that can be told to fail one kind of lookup, to see how failures are recorded.
  const flaky = () =>
    new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "query")
          return (sql, ...rest) => {
            if (failSessions && /FROM sessions/.test(String(sql))) return Promise.reject(new Error("connection reset by peer"));
            return target.query(sql, ...rest);
          };
        return Reflect.get(target, prop, receiver);
      },
    });
  const call = (path, { method = "GET", json, token, headers = {}, b = base } = {}) =>
    fetch(b + path, {
      method,
      headers: { ...(json ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: json ? JSON.stringify(json) : undefined,
    });
  const get = async (path, token) => (await call(path, { token })).json();
  const rows = async (sql, ...p) => (await db.query(sql, p)).rows;
  const post = (kind, extra = {}, opts = {}) => call("/api/client-events", { method: "POST", json: { kind, ...extra }, ...opts });

  async function makeRole(name, permissions, scope = "all") {
    return (await db.query("INSERT INTO admin_roles (name, permissions, students_scope) VALUES ($1,$2,$3) RETURNING id", [name, permissions, scope])).rows[0].id;
  }
  async function makeAdmin(key, roleId) {
    const { rows } = await db.query("INSERT INTO admin_users (email, full_name, role_id, totp_enrolled_at) VALUES ($1,$2,$3,now()) RETURNING id", [`${key}@example.com`, key, roleId]);
    tokens[key] = await createAdminSession(db, rows[0].id, "full", null);
  }

  before(async () => {
    db = connectDb(DB_URL);
    await db.query("DROP TABLE IF EXISTS error_group_state, error_events, student_notes, admin_audit, admin_sessions, admin_users, admin_roles CASCADE");
    for (const t of ["email_outbox", "activity", "documents", "application_consents", "applications", "users", "app_settings"]) await db.query(`DELETE FROM ${t}`);
    await migrate(db);
    const stripe = {
      webhooks: {
        constructEventAsync: async (body, sig) => {
          if (sig !== "valid") throw new Error("No signatures found matching the expected signature");
          return JSON.parse(body.toString());
        },
      },
    };
    const make = (extra = {}, accounts = {}) =>
      createApp({
        stripe,
        config: { allowedOrigins: [], webhookSecret: "whsec_test", stripeMode: "test", flags: async () => ({ checkoutEnabled: true, legalApproved: false }), ...extra },
        accounts: {
          db: flaky(),
          fileKey,
          deliverCode: async () => {
            if (failEmails) throw new Error("The studybg.ac domain is not verified");
          },
          rateLimits: { clientEvents: 100000, requestCode: 100000, adminAuth: 100000 },
          ...accounts,
        },
        log: () => {},
      });
    await new Promise((r) => (server = make().listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}`;
    await new Promise((r) => (tightServer = make({}, { rateLimits: { clientEvents: 3 } }).listen(0, r)));
    tightBase = `http://127.0.0.1:${tightServer.address().port}`;

    const sup = (await db.query("SELECT id FROM admin_roles WHERE key='super_admin'")).rows[0].id;
    await makeAdmin("boss", sup);
    await makeAdmin("ops", await makeRole("Ops", ["monitoring.view", "monitoring.manage"]));
    await makeAdmin("watcher", await makeRole("Watcher", ["monitoring.view"]));
    await makeAdmin("scoped", await makeRole("Scoped watcher", ["monitoring.view", "students.view"], "assigned"));
    await makeAdmin("editor", (await db.query("SELECT id FROM admin_roles WHERE key='content_editor'")).rows[0].id);
  });
  after(async () => {
    server?.close();
    tightServer?.close();
    await db?.end?.();
  });

  test("browser problems are stored cleaned, and junk is ignored", async () => {
    await db.query("DELETE FROM error_events");
    assert.equal((await post("js_error", { message: "Cannot read properties of undefined (reading 'x') for maja@example.com", page: "/apply/?email=a@b.co#top", step: 3 })).status, 204);
    const [e] = await rows("SELECT * FROM error_events");
    assert.equal(e.source, "client");
    assert.equal(e.kind, "js_error");
    assert.equal(e.page, "/apply/");
    assert.equal(e.step, 3);
    assert.ok(!e.message.includes("maja@example.com") && e.message.includes("[email]"), "email addresses are redacted");
    assert.equal(e.user_id, null);
    // not a known kind / empty message / non-local page: answered 204, nothing stored (or stored without the bad part)
    assert.equal((await post("hack", { message: "x" })).status, 204);
    assert.equal((await post("js_error", { message: "   " })).status, 204);
    await post("js_error", { message: "long".repeat(200), page: "https://evil.example/x", step: 99 });
    const all = await rows("SELECT message, page, step FROM error_events ORDER BY id");
    assert.equal(all.length, 2);
    assert.equal(all[1].message.length, 300);
    assert.equal(all[1].page, null);
    assert.equal(all[1].step, null);
  });

  test("a signed-in student's problem is linked to their account; a bad token is simply anonymous", async () => {
    await db.query("DELETE FROM error_events");
    const u = (await db.query("INSERT INTO users (email) VALUES ('linked@example.com') RETURNING id")).rows[0].id;
    const token = crypto.randomBytes(24).toString("base64url");
    await db.query("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 day')", [crypto.createHash("sha256").update(token).digest("hex"), u]);
    await post("payment_form", { message: "The payment form didn't load" }, { token });
    await post("payment_form", { message: "The payment form didn't load (again)" }, { token: "garbage" });
    const r = await rows("SELECT user_id FROM error_events ORDER BY id");
    assert.equal(r[0].user_id, u);
    assert.equal(r[1].user_id, null);
  });

  test("a flood of one identical problem is capped, and the client endpoint is rate limited", async () => {
    await db.query("DELETE FROM error_events");
    for (let i = 0; i < 30; i++) await post("js_error", { message: "same problem" });
    assert.equal((await rows("SELECT count(*)::int AS n FROM error_events"))[0].n, 20);
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await call("/api/client-events", { method: "POST", json: { kind: "js_error", message: "x" }, b: tightBase })).status);
    assert.deepEqual(codes, [204, 204, 204, 429, 429]);
  });

  test("unexpected server failures are recorded; ordinary refusals are not", async () => {
    await db.query("DELETE FROM error_events");
    assert.equal((await call("/api/me", { token: "nope" })).status, 401);
    assert.equal((await call("/api/auth/request-code", { method: "POST", json: { email: "bad" } })).status, 400);
    assert.equal((await call("/api/nothing-here")).status, 404);
    assert.equal((await rows("SELECT count(*)::int AS n FROM error_events"))[0].n, 0, "401, 400 and 404 are not bugs");
    failSessions = true;
    const r = await call("/api/me", { token: "any-token" });
    failSessions = false;
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { error: "Something went wrong. Please try again." }, "the visitor gets no internals");
    const [e] = await rows("SELECT * FROM error_events");
    assert.equal(e.source, "server");
    assert.equal(e.kind, "server_error");
    assert.equal(e.route, "GET /api/me");
    assert.equal(e.status, 500);
    assert.match(e.message, /connection reset/);
  });

  test("a sign-in email that can't be sent is recorded with the provider's reason", async () => {
    await db.query("DELETE FROM error_events");
    failEmails = true;
    const r = await call("/api/auth/request-code", { method: "POST", json: { email: "someone@example.com" } });
    failEmails = false;
    assert.equal(r.status, 502);
    const all = await rows("SELECT kind, message FROM error_events");
    assert.equal(all.length, 1, "recorded once, not twice");
    assert.equal(all[0].kind, "email_failed");
    assert.match(all[0].message, /domain is not verified/);
  });

  test("stripe webhook: bad signatures are recorded, good ones are noted so the admin can see Stripe is reaching us", async () => {
    await db.query("DELETE FROM error_events");
    await db.query("DELETE FROM app_settings WHERE key='last_webhook'");
    const bad = await call("/api/stripe/webhook", { method: "POST", json: { type: "charge.refunded", data: { object: {} } }, headers: { "stripe-signature": "bad" } });
    assert.equal(bad.status, 400);
    let [e] = await rows("SELECT kind, status FROM error_events");
    assert.deepEqual([e.kind, e.status], ["webhook_failed", 400]);
    assert.equal((await rows("SELECT count(*)::int AS n FROM error_events"))[0].n, 1, "recorded once");
    const ok = await call("/api/stripe/webhook", { method: "POST", json: { type: "checkout.session.async_payment_failed", livemode: false, data: { object: { id: "cs_x" } } }, headers: { "stripe-signature": "valid" } });
    assert.equal(ok.status, 200);
    const last = JSON.parse((await rows("SELECT value FROM app_settings WHERE key='last_webhook'"))[0].value);
    assert.deepEqual(last, { type: "checkout.session.async_payment_failed", live: false });
    assert.ok((await rows("SELECT 1 FROM error_events WHERE kind='payment_failed'")).length === 1);
  });

  test("only people with monitoring access can look; only some can resolve", async () => {
    assert.equal((await call("/api/admin/monitoring/errors")).status, 401);
    for (const path of ["status", "errors", "flow"]) {
      assert.equal((await call(`/api/admin/monitoring/${path}`, { token: tokens.editor })).status, 403, path);
      assert.equal((await call(`/api/admin/monitoring/${path}`, { token: tokens.watcher })).status, 200, path);
    }
    const fp = (await rows("SELECT fingerprint FROM error_events LIMIT 1"))[0].fingerprint;
    const set = (token, status) => call(`/api/admin/monitoring/errors/${fp}/state`, { method: "POST", token, json: { status, note: "n" } });
    assert.equal((await set(tokens.watcher, "resolved")).status, 403);
    assert.equal((await set(tokens.ops, "bogus")).status, 400);
    assert.equal((await call("/api/admin/monitoring/errors/not-a-fingerprint/state", { method: "POST", token: tokens.ops, json: { status: "resolved" } })).status, 404);
    assert.equal((await call("/api/admin/monitoring/errors/0000000000000000/state", { method: "POST", token: tokens.ops, json: { status: "resolved" } })).status, 404);
  });

  test("errors are grouped by problem, with counts, people affected, windows and filters", async () => {
    await db.query("DELETE FROM error_events");
    await db.query("DELETE FROM error_group_state");
    const u1 = (await db.query("INSERT INTO users (email) VALUES ('a@example.com') ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id")).rows[0].id;
    const u2 = (await db.query("INSERT INTO users (email) VALUES ('b@example.com') ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id")).rows[0].id;
    const ev = (kind, message, extra = {}) => post(kind, { message, ...extra });
    for (let i = 0; i < 3; i++) await ev("js_error", "Cannot read properties of undefined", { page: "/apply/" });
    await ev("payment_form", "The payment form didn't load", { page: "/apply/" });
    await db.query("INSERT INTO error_events (source,kind,fingerprint,message,route,user_id) VALUES ('server','server_error',$1,'boom','GET /api/me',$2),('server','server_error',$1,'boom','GET /api/me',$3)", [fingerprintOf("server_error", "boom", "GET /api/me"), u1, u2]);
    await db.query("INSERT INTO error_events (source,kind,fingerprint,message,page,created_at) VALUES ('client','js_error','aaaaaaaaaaaaaaaa','old problem','/x', now() - interval '10 days')");
    await ev("validation", "Enter a valid email address.", { page: "/apply/", step: 1 });

    const week = await get("/api/admin/monitoring/errors?window=7d", tokens.boss);
    const kinds = week.groups.map((g) => g.kind).sort();
    assert.deepEqual(kinds, ["js_error", "payment_form", "server_error"], "validation blocks aren't errors; the 10-day-old one is outside the window");
    const js = week.groups.find((g) => g.kind === "js_error");
    assert.equal(js.count, 3);
    assert.equal(js.location, "/apply/");
    assert.equal(week.groups.find((g) => g.kind === "server_error").users, 2);
    const month = await get("/api/admin/monitoring/errors?window=30d", tokens.boss);
    assert.equal(month.groups.length, 4);
    const day = await get("/api/admin/monitoring/errors?window=24h&kind=payment_form", tokens.boss);
    assert.deepEqual(day.groups.map((g) => g.kind), ["payment_form"]);
    assert.deepEqual(week.counts, { open: 3, resolved: 0, ignored: 0 });
  });

  test("resolving hides a problem until it happens again; ignoring keeps it hidden; reopening brings it back", async () => {
    const t = tokens.ops;
    const list = async (state = "open") => (await get(`/api/admin/monitoring/errors?window=7d&state=${state}`, t)).groups;
    const target = (await list()).find((g) => g.kind === "payment_form");
    const url = `/api/admin/monitoring/errors/${target.fingerprint}/state`;
    assert.equal((await call(url, { method: "POST", token: t, json: { status: "resolved", note: "Fixed in v13" } })).status, 200);
    assert.ok(!(await list()).some((g) => g.fingerprint === target.fingerprint), "resolved problems leave the open list");
    const resolved = (await list("resolved")).find((g) => g.fingerprint === target.fingerprint);
    assert.equal(resolved.note, "Fixed in v13");
    assert.equal(resolved.stateBy, "ops@example.com");
    // It happens again: back in the open list, flagged as having come back.
    await db.query("UPDATE error_group_state SET updated_at = now() - interval '1 hour' WHERE fingerprint = $1", [target.fingerprint]);
    await post("payment_form", { message: "The payment form didn't load", page: "/apply/" });
    const back = (await list()).find((g) => g.fingerprint === target.fingerprint);
    assert.ok(back && back.recurred === true);
    // Ignored never comes back by itself.
    await call(url, { method: "POST", token: t, json: { status: "ignored" } });
    await post("payment_form", { message: "The payment form didn't load", page: "/apply/" });
    assert.ok(!(await list()).some((g) => g.fingerprint === target.fingerprint));
    assert.ok((await list("ignored")).some((g) => g.fingerprint === target.fingerprint));
    await call(url, { method: "POST", token: t, json: { status: "open" } });
    assert.ok((await list()).some((g) => g.fingerprint === target.fingerprint));
    const log = await get("/api/admin/audit?limit=50", tokens.boss);
    assert.ok(log.entries.some((e) => e.action === "error_state"));
  });

  test("who was affected is shown only to people allowed to see every student", async () => {
    const fp = fingerprintOf("server_error", "boom", "GET /api/me");
    const detail = async (token) => (await get(`/api/admin/monitoring/errors/${fp}`, token)).events;
    const boss = await detail(tokens.boss);
    assert.equal(boss.length, 2);
    assert.ok(boss.every((e) => e.signedIn && e.user?.email));
    assert.ok(boss[0].user.email.endsWith("@example.com"));
    for (const who of ["watcher", "scoped"]) {
      const events = await detail(tokens[who]);
      assert.ok(events.every((e) => e.signedIn === true && e.user === null), `${who} sees that people were affected, not who`);
    }
    assert.equal((await call("/api/admin/monitoring/errors/ffffffffffffffff", { token: tokens.boss })).status, 404);
    assert.equal((await call("/api/admin/monitoring/errors/zzz", { token: tokens.boss })).status, 404);
  });

  test("system status: mode, switches, last Stripe event, queued emails, errors today", async () => {
    await db.query("DELETE FROM email_outbox");
    await db.query("INSERT INTO email_outbox (id,kind,payload,state,attempts,created_at) VALUES ('a','receipt','{}','pending',0, now()-interval '20 minutes'),('b','receipt','{}','pending',2, now()),('c','receipt','{}','needs_review',1, now()),('d','receipt','{}','accepted',1, now())");
    const s = await get("/api/admin/monitoring/status", tokens.watcher);
    assert.equal(s.stripeMode, "test");
    assert.equal(s.checkoutEnabled, true);
    assert.equal(s.legalApproved, false);
    assert.equal(s.database, true);
    assert.deepEqual(s.emails, { pending: 2, retrying: 1, needsReview: 1, oldestPendingMinutes: 20 });
    assert.equal(s.lastWebhook.type, "checkout.session.async_payment_failed");
    assert.equal(s.lastWebhook.live, false);
    assert.ok(s.errors24h.total >= 1 && s.errors24h.server + s.errors24h.client === s.errors24h.total);
    assert.ok(!JSON.stringify(s).match(/sk_|whsec|secret/i), "no secrets in the status");
  });

  test("the flow view: how far people get, and what stops them", async () => {
    await db.query("DELETE FROM error_events");
    for (const t of ["application_consents", "applications"]) await db.query(`DELETE FROM ${t}`);
    const mk = async (email, step, { checkout = false, paid = false, status = "draft" } = {}) => {
      const u = (await db.query("INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id", [email])).rows[0].id;
      await db.query(
        `INSERT INTO applications (id,user_id,form,current_step,status,checkout_started_at,paid_at) VALUES ($1,$2,'{}',$3,$4,${checkout ? "now() - interval '3 hours'" : "NULL"},${paid ? "now()" : "NULL"})`,
        [`app-flow-${crypto.randomBytes(4).toString("hex")}`, u, step, status],
      );
    };
    await mk("f1@example.com", 1);
    await mk("f2@example.com", 3);
    await mk("f3@example.com", 3);
    await mk("f4@example.com", 8, { checkout: true, status: "checkout" });
    await mk("f5@example.com", 8, { checkout: true, paid: true, status: "submitted" });
    for (let i = 0; i < 4; i++) await post("validation", { message: "Enter a valid email address.", page: "/apply/", step: 1 });
    await post("validation", { message: "Choose a university.", page: "/apply/", step: 2 });
    const f = await get("/api/admin/monitoring/flow?window=7d", tokens.watcher);
    assert.equal(f.applicationsSaved, 5);
    assert.deepEqual(f.reachedStep.map((x) => x.count), [5, 4, 4, 2, 2, 2, 2, 2]);
    assert.equal(f.checkoutStarted, 2);
    assert.equal(f.paid, 1);
    assert.equal(f.abandonedCheckout, 1);
    assert.ok(f.accountsCreated >= 5);
    assert.deepEqual(f.blocksByStep, [{ step: 1, count: 4 }, { step: 2, count: 1 }]);
    assert.equal(f.topBlocks[0].message, "Enter a valid email address.");
    assert.equal(f.topBlocks[0].count, 4);
  });

  test("old events are deleted after 30 days", async () => {
    await db.query("DELETE FROM error_events");
    await db.query("INSERT INTO error_events (source,kind,fingerprint,message,created_at) VALUES ('client','js_error','1111111111111111','old', now()-interval '31 days'),('client','js_error','2222222222222222','new', now())");
    await createMonitor(db).cleanup();
    assert.deepEqual((await rows("SELECT message FROM error_events")).map((r) => r.message), ["new"]);
  });

  test("recording never throws, even if the database does", async () => {
    const broken = createMonitor({ query: async () => { throw new Error("db down"); } }, () => {});
    assert.equal(await broken.record({ source: "server", kind: "server_error", message: "x" }), false);
    assert.equal(await createMonitor(null).record({ message: "x" }), false);
  });
});
