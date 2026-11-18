import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { after, before, describe, test } from "node:test";
import { createApp } from "./app.js";
import { connectDb, migrate } from "./db.js";
import { fileKeyFromEnv } from "./fileCrypto.js";
import { createAdminSession } from "./admin/store.js";
import { ADMIN_AFFILIATES_SQL, DEFAULT_REFERRAL_SOURCES } from "./admin/schema.js";
import { cleanRefCode, cleanSource } from "./source.js";

const DB_URL = process.env.TEST_DATABASE_URL;
if (DB_URL && !new URL(DB_URL).pathname.endsWith("_test"))
  throw new Error("Refusing to run: TEST_DATABASE_URL must name a database ending in _test.");

test("referral codes: lowercase letters, digits and hyphens only; the cleaned source keeps a valid one", () => {
  assert.equal(cleanRefCode("Maria-IG"), "maria-ig");
  assert.equal(cleanRefCode("ab"), "");
  assert.equal(cleanRefCode("-bad-"), "");
  assert.equal(cleanRefCode("has space"), "");
  assert.equal(cleanRefCode("x".repeat(41)), "");
  assert.equal(cleanRefCode("<script>"), "");
  assert.equal(cleanSource({ ref: "maria-ig", utm_source: "x" }).ref, "maria-ig");
  assert.equal("ref" in cleanSource({ ref: "!!", utm_source: "x" }), false);
});

test("the production migration for phase 5 matches the code, and offers the starting sources", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261118000400_admin_affiliates.sql", import.meta.url), "utf8");
  const squash = (x) => x.replace(/\s+/g, " ").trim();
  assert.equal(squash(sql.split("-- schema:start")[1].split("-- schema:end")[0]), squash(ADMIN_AFFILIATES_SQL));
  for (const t of ["referral_sources", "referral_links", "referral_clicks", "referral_payments"]) assert.ok(sql.includes(`'${t}'`), t);
  for (const name of DEFAULT_REFERRAL_SOURCES) assert.ok(sql.includes(`('${name}')`) || sql.includes(`'${name}'`), name);
});

describe("admin: referral links", { skip: !DB_URL && "TEST_DATABASE_URL not set" }, () => {
  let db, server, base, tightServer, tightBase;
  const fileKey = fileKeyFromEnv("a-long-test-secret-for-admin-tests");
  const tokens = {};
  const call = (path, { method = "GET", json, token, headers = {}, b = base } = {}) =>
    fetch(b + path, {
      method,
      headers: { ...(json ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: json ? JSON.stringify(json) : undefined,
    });
  const api = async (path, opts) => {
    const r = await call(`/api/admin${path}`, { ...opts, token: opts?.token ?? tokens.boss });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const rows = async (sql, ...p) => (await db.query(sql, p)).rows;
  const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
  async function makeAdmin(key, roleId) {
    const { rows: r } = await db.query("INSERT INTO admin_users (email, full_name, role_id, totp_enrolled_at) VALUES ($1,$2,$3,now()) RETURNING id", [`${key}@example.com`, key, roleId]);
    tokens[key] = await createAdminSession(db, r[0].id, "full", null);
  }
  const makeRole = async (name, permissions) => (await db.query("INSERT INTO admin_roles (name, permissions, students_scope) VALUES ($1,$2,'all') RETURNING id", [name, permissions])).rows[0].id;
  const sourceId = async (name) => (await rows("SELECT id FROM referral_sources WHERE name=$1", name))[0].id;
  const body = (over = {}) => ({ name: "Maria on Instagram", commissionEur: 20, destination: "/", ...over });
  async function newLink(over = {}, sourceName = "Instagram") {
    const r = await api("/affiliates/links", { method: "POST", json: body({ sourceId: await sourceId(sourceName), ...over }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  }
  // A visitor who created an account through the site, the way the browser does it.
  async function signUp(email, ref, extra = {}) {
    await db.query("DELETE FROM login_codes WHERE email=$1", [email]);
    await db.query("INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1,$2, now()+interval '5 minutes')", [email, sha("123456")]);
    const r = await call("/api/auth/verify", { method: "POST", json: { email, code: "123456", source: { ref, utm_source: "ignored-when-ref-matches", ...extra } } });
    assert.equal(r.status, 200, await r.clone().text());
    return (await rows("SELECT id, referral_link_id, referral_commission_cents, signup_source FROM users WHERE email=$1", email))[0];
  }
  const startApp = (userId, paid) =>
    db.query(`INSERT INTO applications (id, user_id, form, current_step, status, paid_at) VALUES ($1,$2,'{}',3,$3,${paid ? "now()" : "NULL"})`, [`app-aff-${crypto.randomBytes(5).toString("hex")}`, userId, paid ? "submitted" : "draft"]);
  const visit = (code, headers = {}, b = base) => call("/api/referral/visit", { method: "POST", json: { code }, headers, b });
  const clicks = async (code) => Number((await rows("SELECT coalesce(sum(c.clicks),0)::int AS n FROM referral_clicks c JOIN referral_links l ON l.id=c.link_id WHERE l.code=$1", code))[0].n);

  before(async () => {
    db = connectDb(DB_URL);
    await db.query("DROP TABLE IF EXISTS referral_payments, referral_clicks, referral_links, referral_sources, site_content, site_images, error_group_state, error_events, student_notes, admin_audit, admin_sessions, admin_users, admin_roles CASCADE");
    await db.query("ALTER TABLE users DROP COLUMN IF EXISTS referral_link_id, DROP COLUMN IF EXISTS referral_commission_cents");
    for (const t of ["email_outbox", "activity", "documents", "application_consents", "applications", "users", "app_settings"]) await db.query(`DELETE FROM ${t}`);
    await migrate(db);
    const make = (rateLimits) =>
      createApp({
        config: { allowedOrigins: [], flags: async () => ({ checkoutEnabled: false, legalApproved: false }) },
        accounts: { db, fileKey, deliverCode: async () => {}, rateLimits: { verify: 100000, adminAuth: 100000, referralVisit: 100000, ...rateLimits } },
        log: () => {},
      });
    await new Promise((r) => (server = make({}).listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}`;
    await new Promise((r) => (tightServer = make({ referralVisit: 3 }).listen(0, r)));
    tightBase = `http://127.0.0.1:${tightServer.address().port}`;
    const role = async (key) => (await db.query("SELECT id FROM admin_roles WHERE key=$1", [key])).rows[0].id;
    await makeAdmin("boss", await role("super_admin"));
    await makeAdmin("viewer", await role("viewer"));
    await makeAdmin("looker", await makeRole("Affiliate viewer", ["affiliates.view"]));
    await makeAdmin("manager", await makeRole("Affiliate manager", ["affiliates.view", "affiliates.manage"]));
  });
  after(async () => {
    server?.close();
    tightServer?.close();
    await db?.end?.();
  });

  test("the starting sources exist, and the schema can be applied again safely", async () => {
    const names = (await rows("SELECT name FROM referral_sources ORDER BY name")).map((r) => r.name);
    for (const n of DEFAULT_REFERRAL_SOURCES) assert.ok(names.includes(n), n);
    await migrate(db);
    assert.equal((await rows("SELECT count(*)::int AS n FROM referral_sources"))[0].n, DEFAULT_REFERRAL_SOURCES.length);
  });

  test("permissions: no access without the role, view-only can't change anything", async () => {
    assert.equal((await call("/api/admin/affiliates")).status, 401);
    assert.equal((await api("/affiliates", { token: tokens.viewer })).status, 403);
    assert.equal((await api("/affiliates", { token: tokens.looker })).status, 200);
    const sid = await sourceId("TikTok");
    for (const [path, method, json] of [
      ["/affiliates/links", "POST", body({ sourceId: sid })],
      ["/affiliates/sources", "POST", { name: "Podcast" }],
    ])
      assert.equal((await api(path, { method, json, token: tokens.looker })).status, 403, path);
    assert.equal((await api("/affiliates/links", { method: "POST", json: body({ sourceId: sid, name: "Manager's link" }), token: tokens.manager })).status, 200);
  });

  test("creating a link: a code is made from the name, or you choose one; bad input is refused", async () => {
    const a = await newLink({ name: "Ivan & Co. (Telegram)" });
    assert.equal(a.code, "ivan-co-telegram");
    const b = await newLink({ name: "Ivan & Co. (Telegram)" });
    assert.match(b.code, /^ivan-co-telegram-[0-9a-f]{4}$/, "same name again gets a different code");
    const c = await newLink({ name: "Custom", code: "Spring-Promo" }, "YouTube");
    assert.equal(c.code, "spring-promo");
    const sid = await sourceId("Instagram");
    const bad = async (over) => (await api("/affiliates/links", { method: "POST", json: body({ sourceId: sid, ...over }) })).status;
    assert.equal(await bad({ code: "spring-promo" }), 409, "a code can't be used twice");
    assert.equal(await bad({ code: "no spaces" }), 400);
    assert.equal(await bad({ name: " " }), 400);
    assert.equal(await bad({ commissionEur: -1 }), 400);
    assert.equal(await bad({ commissionEur: 1001 }), 400);
    assert.equal(await bad({ commissionEur: "abc" }), 400);
    assert.equal(await bad({ commissionEur: "" }), 400);
    assert.equal(await bad({ destination: "https://evil.example/" }), 400);
    assert.equal(await bad({ destination: "/a?x=1" }), 400);
    assert.equal(await bad({ sourceId: "nope" }), 400);
    assert.equal(await bad({ sourceId: "00000000-0000-4000-8000-000000000000" }), 400);
    assert.equal(await bad({ code: "zero-commission", commissionEur: 0 }), 200, "€0 is allowed (tracking only)");
    const row = (await rows("SELECT commission_cents, destination, status, created_by FROM referral_links WHERE code='ivan-co-telegram'"))[0];
    assert.deepEqual(row, { commission_cents: 2000, destination: "/", status: "active", created_by: "boss@example.com" });
    assert.equal((await rows("SELECT count(*)::int AS n FROM admin_audit WHERE action='affiliate_link_created'"))[0].n >= 3, true);
  });

  test("visits are counted only for active links, never for bots, junk or unknown codes, and the answer is always 204", async () => {
    const { code, id } = await newLink({ name: "Counter test", code: "counter-test" });
    assert.equal((await visit(code)).status, 204);
    assert.equal((await visit(code, { "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120" })).status, 204);
    assert.equal(await clicks(code), 2);
    for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "Slackbot-LinkExpanding 1.0", "Mozilla/5.0 HeadlessChrome/120"]) assert.equal((await visit(code, { "user-agent": ua })).status, 204);
    assert.equal(await clicks(code), 2, "bots don't count");
    assert.equal((await visit("not-a-link")).status, 204);
    assert.equal((await visit("<script>")).status, 204);
    assert.equal((await visit(undefined)).status, 204);
    assert.equal((await rows("SELECT count(*)::int AS n FROM referral_clicks"))[0].n >= 1, true);
    await api(`/affiliates/links/${id}`, { method: "POST", json: body({ sourceId: await sourceId("Instagram"), name: "Counter test", status: "paused" }) });
    assert.equal((await visit(code)).status, 204);
    assert.equal(await clicks(code), 2, "a paused link stops counting");
    // nothing about the visitor is stored: only a per-day number
    assert.deepEqual((await rows("SELECT column_name FROM information_schema.columns WHERE table_name='referral_clicks' ORDER BY ordinal_position")).map((r) => r.column_name), ["link_id", "day", "clicks"]);
  });

  test("visits are rate limited per visitor (the page never notices)", async () => {
    const { code } = await newLink({ name: "Limit test", code: "limit-test" });
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await visit(code, {}, tightBase)).status);
    assert.deepEqual(statuses.slice(0, 3), [204, 204, 204]);
    assert.ok(statuses.slice(3).every((s) => s === 429));
    assert.equal(await clicks(code), 3);
  });

  test("a new account that arrived through a link is tied to it, with the commission fixed at that moment", async () => {
    const { code, id } = await newLink({ name: "Attribution", code: "attrib-test", commissionEur: 25 }, "TikTok");
    const u = await signUp("student1@example.com", code);
    assert.equal(u.referral_link_id, id);
    assert.equal(u.referral_commission_cents, 2500);
    assert.equal(u.signup_source.ref, "attrib-test");
    assert.equal(u.signup_source.ref_label, "TikTok");
    // raising the commission later doesn't change what this student earned
    await api(`/affiliates/links/${id}`, { method: "POST", json: body({ sourceId: await sourceId("TikTok"), name: "Attribution", commissionEur: 40 }) });
    assert.equal((await rows("SELECT referral_commission_cents AS c FROM users WHERE email='student1@example.com'"))[0].c, 2500);
    const later = await signUp("student2@example.com", code);
    assert.equal(later.referral_commission_cents, 4000);
    // signing in again (a different link in the browser) doesn't move an existing account
    const other = await newLink({ name: "Other", code: "other-link" }, "Facebook");
    const again = await signUp("student1@example.com", other.code);
    assert.equal(again.referral_link_id, id);
  });

  test("unknown, paused and malformed codes are ignored, and a problem with referrals can never stop an account being created", async () => {
    const unknown = await signUp("u-unknown@example.com", "no-such-code");
    assert.equal(unknown.referral_link_id, null);
    assert.equal(unknown.signup_source.ref_label, undefined);
    const paused = await newLink({ name: "Paused one", code: "paused-one" });
    await api(`/affiliates/links/${paused.id}`, { method: "POST", json: body({ sourceId: await sourceId("Instagram"), name: "Paused one", status: "paused" }) });
    assert.equal((await signUp("u-paused@example.com", "paused-one")).referral_link_id, null);
    assert.equal((await signUp("u-junk@example.com", "<b>x</b>")).referral_link_id, null);
    // break the referral tables completely: sign-up still works
    await db.query("ALTER TABLE referral_links RENAME TO referral_links_gone");
    try {
      const survived = await signUp("u-broken@example.com", "attrib-test");
      assert.equal(survived.referral_link_id, null);
    } finally {
      await db.query("ALTER TABLE referral_links_gone RENAME TO referral_links");
    }
    assert.equal((await rows("SELECT count(*)::int AS n FROM users WHERE email='u-broken@example.com'"))[0].n, 1);
  });

  test("the numbers: visits, sign-ups, started, paid, earned, owed, by link and by source", async () => {
    await db.query("DELETE FROM users WHERE referral_link_id IS NOT NULL OR email LIKE 'u-%'");
    const ig = await newLink({ name: "Stats IG", code: "stats-ig", commissionEur: 20 }, "Instagram");
    const ig2 = await newLink({ name: "Stats IG two", code: "stats-ig-two", commissionEur: 10 }, "Instagram");
    const yt = await newLink({ name: "Stats YT", code: "stats-yt", commissionEur: 30 }, "YouTube");
    for (let i = 0; i < 6; i++) await visit(ig.code);
    for (let i = 0; i < 2; i++) await visit(yt.code);
    const s1 = await signUp("s1@example.com", ig.code);
    const s2 = await signUp("s2@example.com", ig.code);
    const s3 = await signUp("s3@example.com", ig2.code);
    const s4 = await signUp("s4@example.com", yt.code);
    await signUp("s5@example.com", yt.code); // signed up, never started
    await startApp(s1.id, true); // paid
    await startApp(s2.id, false); // started, not paid
    await startApp(s3.id, true); // paid
    await startApp(s4.id, true); // paid
    const d = (await api("/affiliates?window=all")).body;
    const L = (code) => d.links.find((l) => l.code === code).stats;
    assert.deepEqual(
      { clicks: L("stats-ig").clicks, signups: L("stats-ig").signups, started: L("stats-ig").started, paid: L("stats-ig").paid, earned: L("stats-ig").earnedAll, owed: L("stats-ig").owed },
      { clicks: 6, signups: 2, started: 2, paid: 1, earned: 2000, owed: 2000 },
    );
    assert.deepEqual({ signups: L("stats-yt").signups, started: L("stats-yt").started, paid: L("stats-yt").paid, owed: L("stats-yt").owed }, { signups: 2, started: 1, paid: 1, owed: 3000 });
    const bySource = Object.fromEntries(d.bySource.map((s) => [s.name, s]));
    assert.equal(bySource.Instagram.links >= 2, true);
    assert.equal(bySource.Instagram.signups, 3);
    assert.equal(bySource.Instagram.paid, 2);
    assert.equal(bySource.Instagram.owed, 3000);
    assert.equal(bySource.YouTube.owed, 3000);
    assert.equal(d.totals.owed, 6000);
    assert.equal(d.totals.paid, 3);
    // a window that starts after everything happened shows nothing for sign-ups; money owed stays
    await db.query("UPDATE users SET created_at = now() - interval '40 days' WHERE email='s1@example.com'");
    const w7 = (await api("/affiliates?window=7d")).body.links.find((l) => l.code === "stats-ig").stats;
    assert.equal(w7.signups, 1);
    assert.equal(w7.owed, 2000, "what is owed doesn't depend on the period");
    const w90 = (await api("/affiliates?window=90d")).body.links.find((l) => l.code === "stats-ig").stats;
    assert.equal(w90.signups, 2);
    // the students list shows where they came from as the link's source (its brand)
    const list = (await api("/students?q=s3@example.com")).body;
    assert.equal(list.items[0].source, "Instagram");
  });

  test("payouts and corrections: owed goes down, a payout can't exceed what is owed, entries can be removed", async () => {
    const link = (await api("/affiliates?window=all")).body.links.find((l) => l.code === "stats-yt");
    const pay = (json, token) => api(`/affiliates/links/${link.id}/payments`, { method: "POST", json, token });
    assert.equal((await pay({ kind: "payout", amountEur: 31 })).status, 409, "more than owed");
    assert.equal((await pay({ kind: "payout", amountEur: -5 })).status, 400);
    assert.equal((await pay({ kind: "payout", amountEur: 0 })).status, 400);
    assert.equal((await pay({ kind: "payout", amountEur: "x" })).status, 400);
    assert.equal((await pay({ kind: "adjustment", amountEur: -5 })).status, 400, "a correction needs a note");
    assert.equal((await pay({ kind: "payout", amountEur: 10 }, tokens.looker)).status, 403);
    const first = await pay({ kind: "payout", amountEur: 12.5, note: "Bank transfer 18 Nov" });
    assert.equal(first.status, 200);
    let detail = (await api(`/affiliates/links/${link.id}`)).body;
    assert.equal(detail.link.stats.payouts, 1250);
    assert.equal(detail.link.stats.owed, 1750);
    assert.equal(detail.payments[0].note, "Bank transfer 18 Nov");
    assert.equal(detail.daily.length, 30);
    assert.equal(detail.daily.reduce((n, x) => n + x.clicks, 0), 2);
    // a refunded student: take their commission back with a correction
    assert.equal((await pay({ kind: "adjustment", amountEur: -30, note: "Student refunded" })).status, 200);
    detail = (await api(`/affiliates/links/${link.id}`)).body;
    assert.equal(detail.link.stats.owed, -1250, "negative: the partner was overpaid");
    assert.equal((await pay({ kind: "payout", amountEur: 1 })).status, 409, "nothing is owed now");
    // removing the mistaken entry
    const adj = detail.payments.find((p) => p.kind === "adjustment");
    assert.equal((await api(`/affiliates/links/${link.id}/payments/${adj.id}`, { method: "DELETE", token: tokens.looker })).status, 403);
    assert.equal((await api(`/affiliates/links/${link.id}/payments/${adj.id}`, { method: "DELETE" })).status, 200);
    assert.equal((await api(`/affiliates/links/${link.id}/payments/${adj.id}`, { method: "DELETE" })).status, 404);
    assert.equal((await api(`/affiliates/links/${link.id}`)).body.link.stats.owed, 1750);
    const audit = (await rows("SELECT action FROM admin_audit WHERE action LIKE 'affiliate_payment%' ORDER BY id")).map((r) => r.action);
    assert.deepEqual(audit, ["affiliate_payment", "affiliate_payment", "affiliate_payment_removed"]);
  });

  test("editing a link changes future sign-ups only; a link with history can't be deleted, an unused one can", async () => {
    const used = (await api("/affiliates?window=all")).body.links.find((l) => l.code === "stats-ig");
    assert.equal((await api(`/affiliates/links/${used.id}`, { method: "DELETE" })).status, 409);
    assert.equal((await api(`/affiliates/links/${used.id}`, { method: "POST", json: body({ sourceId: used.sourceId, name: "Stats IG renamed", commissionEur: 99 }) })).status, 200);
    const after = (await api("/affiliates?window=all")).body.links.find((l) => l.code === "stats-ig");
    assert.equal(after.name, "Stats IG renamed");
    assert.equal(after.code, "stats-ig", "the code never changes, so shared links keep working");
    assert.equal(after.stats.earnedAll, 2000, "earlier sign-ups keep their commission");
    const fresh = await newLink({ name: "Unused", code: "unused-link" });
    assert.equal((await api(`/affiliates/links/${fresh.id}`, { method: "DELETE" })).status, 200);
    assert.equal((await api(`/affiliates/links/${fresh.id}`)).status, 404);
    assert.equal((await api(`/affiliates/links/not-a-uuid`)).status, 404);
  });

  test("sources: add, rename, duplicate names refused, can't delete one that links use", async () => {
    const add = (name) => api("/affiliates/sources", { method: "POST", json: { name } });
    assert.equal((await add("Podcast")).status, 200);
    assert.equal((await add("podcast")).status, 409, "same name in another case");
    assert.equal((await add("x")).status, 400);
    const id = await sourceId("Podcast");
    assert.equal((await api(`/affiliates/sources/${id}`, { method: "POST", json: { name: "Instagram" } })).status, 409);
    assert.equal((await api(`/affiliates/sources/${id}`, { method: "POST", json: { name: "Podcast network" } })).status, 200);
    const inUse = await sourceId("YouTube");
    assert.equal((await api(`/affiliates/sources/${inUse}`, { method: "DELETE" })).status, 409);
    assert.equal((await api(`/affiliates/sources/${id}`, { method: "DELETE" })).status, 200);
    assert.equal((await api(`/affiliates/sources/${id}`, { method: "DELETE" })).status, 404);
  });

  test("every change is in the audit log", async () => {
    const actions = new Set((await rows("SELECT action FROM admin_audit")).map((r) => r.action));
    for (const a of ["affiliate_link_created", "affiliate_link_updated", "affiliate_link_deleted", "affiliate_payment", "affiliate_source_created", "affiliate_source_renamed", "affiliate_source_deleted"])
      assert.ok(actions.has(a), a);
  });
});
