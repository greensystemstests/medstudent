import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, test } from "node:test";
import { createApp } from "./app.js";
import { connectDb, migrate } from "./db.js";
import { encryptFile, fileKeyFromEnv } from "./fileCrypto.js";
import { createAdminSession } from "./admin/store.js";
import { cleanSource, countryFromHeaders, referrerHost } from "./source.js";
import { ADMIN_STUDENTS_SQL } from "./admin/schema.js";
import fs from "node:fs";

const DB_URL = process.env.TEST_DATABASE_URL;
if (DB_URL && !new URL(DB_URL).pathname.endsWith("_test"))
  throw new Error("Refusing to run: TEST_DATABASE_URL must name a database ending in _test.");

test("sign-up source is cleaned: hosts only, no paths or queries, short tags, junk dropped", () => {
  assert.equal(referrerHost("https://www.Google.com/search?q=private+stuff"), "google.com");
  assert.equal(referrerHost("not a url"), "");
  assert.deepEqual(
    cleanSource({
      referrer: "https://l.instagram.com/?u=https%3A%2F%2Fsecret",
      utm_source: "Instagram<script>",
      utm_medium: "social",
      utm_campaign: "x".repeat(200),
      landing: "/student-stories/?email=a@b.co#frag",
    }),
    { referrer: "l.instagram.com", utm_source: "Instagramscript", utm_medium: "social", utm_campaign: "x".repeat(60), landing: "/student-stories/" },
  );
  assert.deepEqual(cleanSource({ landing: "https://evil.example/x" }), {}, "a landing that isn't a local path is dropped");
  assert.equal(cleanSource("string"), null);
  assert.equal(cleanSource(null), null);
  assert.equal(countryFromHeaders((n) => (n === "cf-ipcountry" ? "tr" : "")), "TR");
  assert.equal(countryFromHeaders((n) => (n === "cf-ipcountry" ? "XX" : "")), null);
  assert.equal(countryFromHeaders(() => "Turkey"), null);
});

test("the production migration for phase 2 matches the code", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261118000100_admin_students.sql", import.meta.url), "utf8");
  const squash = (x) => x.replace(/\s+/g, " ").trim();
  assert.equal(squash(sql.split("-- schema:start")[1].split("-- schema:end")[0]), squash(ADMIN_STUDENTS_SQL));
  assert.ok(sql.includes("student_notes enable row level security"));
});

describe("admin: students", { skip: !DB_URL && "TEST_DATABASE_URL not set" }, () => {
  let db, server, base;
  const fileKey = fileKeyFromEnv("a-long-test-secret-for-admin-tests");
  const tokens = {};
  const ids = {};
  const call = (path, { method = "GET", json, token, headers = {} } = {}) =>
    fetch(base + path, {
      method,
      headers: { ...(json ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: json ? JSON.stringify(json) : undefined,
    });
  const get = async (path, token) => (await call(path, { token })).json();
  const roleId = async (key) => (await db.query("SELECT id FROM admin_roles WHERE key=$1", [key])).rows[0].id;

  async function makeAdmin(email, roleKey) {
    const { rows } = await db.query("INSERT INTO admin_users (email, full_name, role_id, totp_enrolled_at) VALUES ($1,$2,$3,now()) RETURNING id", [email, email.split("@")[0], await roleId(roleKey)]);
    ids[email] = rows[0].id;
    tokens[email] = await createAdminSession(db, rows[0].id, "full", null);
  }
  async function makeStudent(email, form, { status, paid = false, source = null, country = null, pi = null }) {
    const u = await db.query("INSERT INTO users (email, signup_source, signup_country) VALUES ($1,$2,$3) RETURNING id", [email, source, country]);
    const appId = `app-test-${crypto.randomBytes(6).toString("hex")}`;
    await db.query(
      `INSERT INTO applications (id, user_id, form, current_step, status, paid_at, payment_intent_id) VALUES ($1,$2,$3,8,$4,${paid ? "now()" : "NULL"},$5)`,
      [appId, u.rows[0].id, { email, ...form }, status, pi],
    );
    return { userId: u.rows[0].id, appId };
  }

  before(async () => {
    db = connectDb(DB_URL);
    await db.query("DROP TABLE IF EXISTS student_notes, admin_audit, admin_sessions, admin_users, admin_roles CASCADE");
    await db.query("DELETE FROM email_outbox");
    await db.query("DELETE FROM activity");
    await db.query("DELETE FROM documents");
    await db.query("DELETE FROM application_consents");
    await db.query("DELETE FROM applications");
    await db.query("DELETE FROM users");
    await migrate(db);
    const app = createApp({
      config: { allowedOrigins: [], flags: async () => ({ checkoutEnabled: false, legalApproved: false }) },
      accounts: { db, fileKey, deliverCode: async () => {}, rateLimits: { verify: 100000, adminAuth: 100000 } },
      log: () => {},
    });
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}`;

    await makeAdmin("boss@example.com", "super_admin");
    await makeAdmin("viewer@example.com", "viewer");
    await makeAdmin("editor@example.com", "content_editor");
    await makeAdmin("advisor@example.com", "student_manager"); // sees only assigned students

    const a = await makeStudent("nikos@example.com", { fullName: "Nikos Papas", degree: "Medicine", universityId: "mu-sofia", citizenshipCountry: "Greece" }, { status: "submitted", paid: true, pi: "pi_test_1", source: { utm_source: "instagram", utm_campaign: "nov-promo", referrer: "l.instagram.com", landing: "/" }, country: "GR" });
    const b = await makeStudent("dimana@example.com", { fullName: "Dimana K", degree: "Pharmacy", universityId: "mu-plovdiv", citizenshipCountry: "Turkey" }, { status: "draft", source: { referrer: "google.com" }, country: "TR" });
    const c = await makeStudent("maja@example.com", { fullName: '=HYPERLINK("http://x")', degree: "Medicine", universityId: "mu-varna", citizenshipCountry: "Germany" }, { status: "checkout" });
    Object.assign(ids, { nikos: a, dimana: b, maja: c });
    await db.query("INSERT INTO invoices (payment_intent_id, invoice_number, issued_at, buyer_email, payload) VALUES ('pi_test_1', 7, now(), 'nikos@example.com', '{}')");
    // an encrypted document for Nikos
    const docId = crypto.randomUUID();
    const sealed = encryptFile(fileKey, Buffer.from("%PDF-1.4 synthetic diploma"), { userId: a.userId, documentId: docId });
    await db.query(
      "INSERT INTO documents (id,user_id,category,filename,mime_type,size_bytes,key_id,iv,auth_tag,content) VALUES ($1,$2,'diploma','diploma.pdf','application/pdf',26,'v1',$3,$4,$5)",
      [docId, a.userId, sealed.iv, sealed.authTag, sealed.content],
    );
    ids.doc = docId;
  });
  after(async () => {
    server?.close();
    await db?.end?.();
  });

  test("roles without student access are refused; read-only roles can look but not change", async () => {
    assert.equal((await call("/api/admin/students", { token: tokens["editor@example.com"] })).status, 403);
    assert.equal((await call("/api/admin/overview", { token: tokens["editor@example.com"] })).status, 403);
    assert.equal((await call("/api/admin/students")).status, 401);
    const v = tokens["viewer@example.com"];
    assert.equal((await call("/api/admin/students", { token: v })).status, 200);
    assert.equal((await call(`/api/admin/students/${ids.nikos.appId}`, { token: v })).status, 200);
    for (const [path, json] of [
      [`/api/admin/students/${ids.nikos.appId}/status`, { status: "in_review", note: "x" }],
      [`/api/admin/students/${ids.nikos.appId}/notes`, { note: "x" }],
      [`/api/admin/students/${ids.nikos.appId}/assign`, { adminId: null }],
      [`/api/admin/students/documents/${ids.doc}/review`, { status: "verified", note: "x" }],
    ])
      assert.equal((await call(path, { method: "POST", token: v, json })).status, 403, path);
  });

  test("the list shows source, what they want to study and status, with counts for filters", async () => {
    const r = await get("/api/admin/students", tokens["boss@example.com"]);
    assert.equal(r.total, 3);
    const n = r.items.find((i) => i.email === "nikos@example.com");
    assert.equal(n.source, "instagram");
    assert.equal(n.degree, "Medicine");
    assert.equal(n.universityId, "mu-sofia");
    assert.equal(n.status, "submitted");
    assert.equal(n.paid, true);
    assert.equal(n.signupCountry, "GR");
    assert.equal(r.items.find((i) => i.email === "dimana@example.com").source, "google.com");
    assert.equal(r.items.find((i) => i.email === "maja@example.com").source, "Direct");
    assert.deepEqual(r.facets.source.map((f) => f.value).sort(), ["Direct", "google.com", "instagram"]);
    assert.deepEqual(r.facets.status.map((f) => f.value).sort(), ["checkout", "draft", "submitted"]);
    assert.ok(r.assignable.some((a) => a.name === "boss"));
  });

  test("filters work and search text can't be used as a pattern", async () => {
    const t = tokens["boss@example.com"];
    const q = async (qs) => (await get(`/api/admin/students?${qs}`, t)).total;
    assert.equal(await q("status=submitted"), 1);
    assert.equal(await q("status=draft,checkout"), 2);
    assert.equal(await q("status=bogus"), 3, "unknown statuses are ignored");
    assert.equal(await q("q=papas"), 1);
    assert.equal(await q("q=NIKOS@"), 1);
    assert.equal(await q("q=%25"), 0, "a % in the search is just a character");
    assert.equal(await q("degree=Medicine"), 2);
    assert.equal(await q("university=mu-plovdiv"), 1);
    assert.equal(await q("source=Direct"), 1);
    assert.equal(await q("country=Turkey"), 1);
    assert.equal(await q("paid=yes"), 1);
    assert.equal(await q("paid=no"), 2);
    assert.equal(await q("assigned=none"), 3);
    assert.equal(await q("q=x%27%20OR%201=1--"), 0, "SQL in the search does nothing");
    const page = await get("/api/admin/students?pageSize=5&page=2", t);
    assert.equal(page.items.length, 0);
    assert.equal(page.total, 3);
  });

  test("a student's file: answers, payment, source, documents, activity, notes", async () => {
    const t = tokens["boss@example.com"];
    const d = await get(`/api/admin/students/${ids.nikos.appId}`, t);
    assert.equal(d.application.form.degree, "Medicine");
    assert.equal(d.application.payment.status, "paid");
    assert.equal(d.invoiceNumber, "7");
    assert.deepEqual(d.student.source.utm_campaign, "nov-promo");
    assert.equal(d.student.signupCountry, "GR");
    assert.equal(d.documents[0].categoryLabel, "High school diploma");
    assert.equal((await call("/api/admin/students/app-nope", { token: t })).status, 404);
    const log = await get("/api/admin/audit?limit=50", t);
    assert.ok(log.entries.some((e) => e.action === "student_viewed" && e.subject === `application:${ids.nikos.appId}`), "viewing a student is audited");
  });

  test("status changes need a note, only apply once paid, tell the student, and are audited", async () => {
    const t = tokens["boss@example.com"];
    const url = `/api/admin/students/${ids.nikos.appId}/status`;
    assert.equal((await call(url, { method: "POST", token: t, json: { status: "in_review", note: "" } })).status, 400);
    assert.equal((await call(url, { method: "POST", token: t, json: { status: "paid", note: "x" } })).status, 400);
    assert.equal((await call(`/api/admin/students/${ids.dimana.appId}/status`, { method: "POST", token: t, json: { status: "in_review", note: "x" } })).status, 409, "unpaid");
    const ok = await call(url, { method: "POST", token: t, json: { status: "action_needed", note: "Please upload page 2 of the transcript." } });
    assert.equal(ok.status, 200, await ok.clone().text());
    assert.equal((await db.query("SELECT status FROM applications WHERE id=$1", [ids.nikos.appId])).rows[0].status, "action_needed");
    const act = await db.query("SELECT type, detail FROM activity WHERE user_id=$1 AND type='application_action_needed'", [ids.nikos.userId]);
    assert.match(act.rows[0].detail, /page 2/);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM email_outbox WHERE kind='status_notice'")).rows[0].n, 1);
    const log = await get("/api/admin/audit?limit=50", t);
    assert.ok(log.entries.some((e) => e.action === "student_status"));
  });

  test("notes are saved with who wrote them", async () => {
    const t = tokens["boss@example.com"];
    const url = `/api/admin/students/${ids.nikos.appId}/notes`;
    assert.equal((await call(url, { method: "POST", token: t, json: { note: "  " } })).status, 400);
    assert.equal((await call(url, { method: "POST", token: t, json: { note: "Called the family; prefers email." } })).status, 201);
    const d = await get(`/api/admin/students/${ids.nikos.appId}`, t);
    assert.equal(d.notes[0].admin_email, "boss@example.com");
    assert.match(d.notes[0].note, /prefers email/);
  });

  test("documents open decrypted for admins in scope, are audited, and can be reviewed", async () => {
    const t = tokens["boss@example.com"];
    const f = await call(`/api/admin/students/documents/${ids.doc}/file`, { token: t });
    assert.equal(f.status, 200);
    assert.equal(Buffer.from(await f.arrayBuffer()).toString(), "%PDF-1.4 synthetic diploma");
    assert.equal(f.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await call(`/api/admin/students/documents/not-a-uuid/file`, { token: t })).status, 404);
    const r = await call(`/api/admin/students/documents/${ids.doc}/review`, { method: "POST", token: t, json: { status: "verified", note: "Apostille present." } });
    assert.equal(r.status, 200);
    assert.equal((await db.query("SELECT status, review_note FROM documents WHERE id=$1", [ids.doc])).rows[0].status, "verified");
    assert.equal((await call(`/api/admin/students/documents/${ids.doc}/review`, { method: "POST", token: t, json: { status: "bogus", note: "x" } })).status, 400);
    const log = await get("/api/admin/audit?limit=100", t);
    assert.ok(log.entries.some((e) => e.action === "document_viewed"));
    assert.ok(log.entries.some((e) => e.action === "document_review"));
  });

  test("assignment: only people who can look after students, and scoped roles see only their students", async () => {
    const boss = tokens["boss@example.com"];
    const adv = tokens["advisor@example.com"];
    // Advisor starts with nobody.
    const none = await get("/api/admin/students", adv);
    assert.equal(none.total, 0);
    assert.deepEqual(none.assignable, [], "a scoped admin isn't offered other people to assign to");
    assert.equal((await call(`/api/admin/students/${ids.nikos.appId}`, { token: adv })).status, 404, "out of scope looks like not found");
    assert.equal((await call(`/api/admin/students/documents/${ids.doc}/file`, { token: adv })).status, 404);

    const assign = (to) => call(`/api/admin/students/${ids.nikos.appId}/assign`, { method: "POST", token: boss, json: { adminId: to } });
    assert.equal((await assign(ids["editor@example.com"])).status, 400, "content editors can't be given students");
    assert.equal((await assign("nope")).status, 400);
    assert.equal((await assign(ids["advisor@example.com"])).status, 200);

    const mine = await get("/api/admin/students", adv);
    assert.equal(mine.total, 1);
    assert.equal(mine.items[0].assignedTo.name, "advisor");
    assert.equal((await call(`/api/admin/students/${ids.dimana.appId}`, { token: adv })).status, 404);
    assert.equal((await call(`/api/admin/students/documents/${ids.doc}/file`, { token: adv })).status, 200, "documents of an assigned student open");
    // They can work on their own student, but not hand out students.
    assert.equal((await call(`/api/admin/students/${ids.nikos.appId}/notes`, { method: "POST", token: adv, json: { note: "Mine." } })).status, 201);
    assert.equal((await call(`/api/admin/students/${ids.nikos.appId}/assign`, { method: "POST", token: adv, json: { adminId: null } })).status, 403);
    assert.equal((await call(`/api/admin/students/${ids.dimana.appId}/notes`, { method: "POST", token: adv, json: { note: "Not mine." } })).status, 404);
    // Even a filter can't widen their view.
    assert.equal((await get("/api/admin/students?assigned=none", adv)).total, 0);
    assert.equal((await get("/api/admin/students?q=dimana", adv)).total, 0);
    // Overview and export are scoped too.
    assert.equal((await get("/api/admin/overview", adv)).totals.total, 1);
    const csv = await (await call("/api/admin/students/export.csv", { token: adv })).text();
    assert.ok(csv.includes("nikos@example.com") && !csv.includes("dimana@example.com"));
    // Unassigning works.
    assert.equal((await assign(null)).status, 200);
    assert.equal((await get("/api/admin/students", adv)).total, 0);
  });

  test("overview totals, top sources and countries", async () => {
    const o = await get("/api/admin/overview", tokens["boss@example.com"]);
    assert.equal(o.totals.total, 3);
    assert.equal(o.totals.paid, 1);
    assert.equal(o.totals.draft, 1);
    assert.equal(o.totals.checkout, 1);
    assert.equal(o.totals.action_needed, 1, "Nikos was moved to action needed");
    assert.equal(o.totals.new7, 3);
    assert.ok(o.bySource.some((s) => s.value === "instagram" && s.count === 1));
    assert.ok(o.byCountry.some((s) => s.value === "Turkey"));
    assert.ok(o.byDegree.some((s) => s.value === "Medicine" && s.count === 2));
    assert.equal(o.perDay.length, 30);
    assert.equal(o.perDay.reduce((n, d) => n + d.count, 0), 3);
  });

  test("CSV export defuses spreadsheet formulas, respects filters and is audited", async () => {
    const t = tokens["boss@example.com"];
    const r = await call("/api/admin/students/export.csv?status=checkout", { token: t });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /text\/csv/);
    const bytes = Buffer.from(await r.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "starts with a byte-order mark so Excel reads accents correctly");
    const csv = bytes.toString("utf8");
    assert.ok(csv.includes('"Application","Name"'));
    assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`), "a name starting with = is neutralised");
    assert.ok(!csv.includes("nikos@example.com"), "filters apply to the export");
    const log = await get("/api/admin/audit?limit=100", t);
    assert.ok(log.entries.some((e) => e.action === "students_exported"));
  });

  test("a new student's sign-in records where they came from, once", async () => {
    const email = "newstudent@example.com";
    const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
    const hit = async (extra = {}) => {
      await db.query("DELETE FROM login_codes WHERE email=$1", [email]);
      await db.query("INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1,$2, now()+interval '5 minutes')", [email, sha("123456")]);
      const r = await call("/api/auth/verify", { method: "POST", json: { email, code: "123456", ...extra }, headers: { "cf-ipcountry": "TR" } });
      assert.equal(r.status, 200, await r.clone().text());
    };
    await hit({ source: { referrer: "https://www.facebook.com/some/path?x=1", utm_source: "facebook", utm_campaign: "autumn" } });
    const row = (await db.query("SELECT signup_source, signup_country FROM users WHERE email=$1", [email])).rows[0];
    assert.deepEqual(row.signup_source, { referrer: "facebook.com", utm_source: "facebook", utm_medium: "", utm_campaign: "autumn", landing: "" });
    assert.equal(row.signup_country, "TR");
    // Signing in again later doesn't rewrite where they originally came from.
    await hit({ source: { utm_source: "something-else" } });
    assert.equal((await db.query("SELECT signup_source->>'utm_source' AS s FROM users WHERE email=$1", [email])).rows[0].s, "facebook");
    // Garbage is ignored, not an error.
    await db.query("DELETE FROM users WHERE email=$1", [email]);
    await hit({ source: "nonsense" });
    assert.equal((await db.query("SELECT signup_source FROM users WHERE email=$1", [email])).rows[0].signup_source, null);
  });
});
