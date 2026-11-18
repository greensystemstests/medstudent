import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, describe, test } from "node:test";
import { createApp } from "./app.js";
import { connectDb, migrate } from "./db.js";
import { fileKeyFromEnv } from "./fileCrypto.js";
import { createAdminSession } from "./admin/store.js";
import { ADMIN_CONTENT_SQL } from "./admin/schema.js";
import { sniffImage } from "./admin/content.js";
import { CONTENT_BY_KEY, SITE_CONTENT, cleanContentText } from "../shared/siteContent.js";

const DB_URL = process.env.TEST_DATABASE_URL;
if (DB_URL && !new URL(DB_URL).pathname.endsWith("_test"))
  throw new Error("Refusing to run: TEST_DATABASE_URL must name a database ending in _test.");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 2)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(30, 3)]);

test("the list of editable items is well formed", () => {
  const keys = SITE_CONTENT.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length, "keys are unique");
  for (const c of SITE_CONTENT) {
    assert.ok(["text", "image"].includes(c.type));
    if (c.type === "text") {
      assert.ok(c.default && c.default.length <= c.max, `${c.key}: the original fits its own limit`);
      assert.equal(cleanContentText(c, c.default).value, c.default, `${c.key}: the original is accepted as is`);
    }
  }
});

test("text is cleaned and limited", () => {
  const one = { max: 10, multiline: false };
  assert.equal(cleanContentText(one, "  hello \u0000 ").value, "hello");
  assert.ok(cleanContentText(one, "   ").error);
  assert.ok(cleanContentText(one, "a\nb").error);
  assert.ok(cleanContentText(one, "x".repeat(11)).error);
  assert.equal(cleanContentText({ max: 20, multiline: true }, "a\r\nb").value, "a\nb");
});

test("pictures are recognised by their content, not their name", () => {
  assert.equal(sniffImage(PNG), "image/png");
  assert.equal(sniffImage(JPEG), "image/jpeg");
  assert.equal(sniffImage(WEBP), "image/webp");
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImage(Buffer.from("GIF89a" + "x".repeat(30))), null);
  assert.equal(sniffImage(Buffer.alloc(3)), null);
});

test("the production migration for phase 4 matches the code", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261118000300_admin_content.sql", import.meta.url), "utf8");
  const squash = (x) => x.replace(/\s+/g, " ").trim();
  assert.equal(squash(sql.split("-- schema:start")[1].split("-- schema:end")[0]), squash(ADMIN_CONTENT_SQL));
  assert.ok(sql.includes("'site_images'") && sql.includes("'site_content'"));
});

describe("admin: site content", { skip: !DB_URL && "TEST_DATABASE_URL not set" }, () => {
  let db, server, base;
  const fileKey = fileKeyFromEnv("a-long-test-secret-for-admin-tests");
  const tokens = {};
  const call = (path, { method = "GET", json, body, token, type } = {}) =>
    fetch(base + path, {
      method,
      headers: { ...(json ? { "content-type": "application/json" } : {}), ...(type ? { "content-type": type } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: json ? JSON.stringify(json) : body,
    });
  const rows = async (sql, ...p) => (await db.query(sql, p)).rows;
  async function makeAdmin(key, roleId) {
    const { rows: r } = await db.query("INSERT INTO admin_users (email, full_name, role_id, totp_enrolled_at) VALUES ($1,$2,$3,now()) RETURNING id", [`${key}@example.com`, key, roleId]);
    tokens[key] = await createAdminSession(db, r[0].id, "full", null);
  }

  before(async () => {
    db = connectDb(DB_URL);
    await db.query("DROP TABLE IF EXISTS site_content, site_images, error_group_state, error_events, student_notes, admin_audit, admin_sessions, admin_users, admin_roles CASCADE");
    for (const t of ["email_outbox", "activity", "documents", "application_consents", "applications", "users", "app_settings"]) await db.query(`DELETE FROM ${t}`);
    await migrate(db);
    const app = createApp({
      config: { allowedOrigins: [], flags: async () => ({ checkoutEnabled: true, legalApproved: false }) },
      accounts: { db, fileKey, deliverCode: async () => {}, rateLimits: { adminAuth: 100000 } },
      log: () => {},
    });
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}`;
    const role = async (key) => (await db.query("SELECT id FROM admin_roles WHERE key=$1", [key])).rows[0].id;
    await makeAdmin("boss", await role("super_admin"));
    await makeAdmin("editor", await role("content_editor"));
    await makeAdmin("viewer", await role("viewer"));
  });
  after(async () => {
    server?.close();
    await db?.end?.();
  });

  test("with nothing saved the public site gets nothing to change", async () => {
    const res = await call("/api/content");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { text: {}, images: {} });
    assert.match(res.headers.get("cache-control"), /max-age=30/);
  });

  test("only roles with the content permission can see or change anything", async () => {
    assert.equal((await call("/api/admin/content")).status, 401);
    assert.equal((await call("/api/admin/content", { token: tokens.viewer })).status, 403);
    assert.equal((await call("/api/admin/content/home.hero.title", { method: "POST", json: { value: "x" }, token: tokens.viewer })).status, 403);
    assert.equal((await call("/api/admin/content/home.hero.image/image", { method: "POST", body: PNG, type: "image/png", token: tokens.viewer })).status, 403);
    assert.equal((await call("/api/admin/content", { token: tokens.editor })).status, 200);
    assert.equal((await call("/api/admin/content", { token: tokens.boss })).status, 200);
  });

  test("the editor lists every item with its original text", async () => {
    const d = await (await call("/api/admin/content", { token: tokens.editor })).json();
    assert.equal(d.items.length, SITE_CONTENT.length);
    const title = d.items.find((i) => i.key === "home.hero.title");
    assert.equal(title.original, "Want to study medicine in Bulgaria?");
    assert.equal(title.changed, false);
    assert.equal(title.value, null);
    assert.ok(d.items.some((i) => i.type === "image" && i.key === "home.hero.image"));
  });

  test("an edit reaches the public site, is audited, and can be reset", async () => {
    const save = (value, token = tokens.editor) => call("/api/admin/content/home.hero.title", { method: "POST", json: { value }, token });
    assert.equal((await save("Study medicine in Bulgaria, step by step")).status, 200);
    let pub = await (await call("/api/content")).json();
    assert.equal(pub.text["home.hero.title"], "Study medicine in Bulgaria, step by step");
    // the same value again is not a change (and isn't audited twice)
    assert.equal((await (await save("Study medicine in Bulgaria, step by step")).json()).unchanged, true);
    const audit = await rows("SELECT admin_email, subject, detail FROM admin_audit WHERE action='content_text'");
    assert.equal(audit.length, 1);
    assert.equal(audit[0].subject, "home.hero.title");
    assert.equal(audit[0].detail.from, "Want to study medicine in Bulgaria?");
    const listed = (await (await call("/api/admin/content", { token: tokens.boss })).json()).items.find((i) => i.key === "home.hero.title");
    assert.equal(listed.changed, true);
    assert.equal(listed.updatedBy, "editor@example.com");
    // reset puts the original back
    assert.equal((await call("/api/admin/content/home.hero.title/reset", { method: "POST", json: {}, token: tokens.editor })).status, 200);
    pub = await (await call("/api/content")).json();
    assert.deepEqual(pub.text, {});
    assert.equal((await rows("SELECT 1 FROM admin_audit WHERE action='content_reset'")).length, 1);
  });

  test("bad text is refused: unknown item, empty, too long, line breaks in a one-line item, or an image item", async () => {
    const save = (key, value) => call(`/api/admin/content/${key}`, { method: "POST", json: { value }, token: tokens.editor });
    assert.equal((await save("not.a.real.key", "x")).status, 404);
    assert.equal((await save("home.hero.title", "  ")).status, 400);
    assert.equal((await save("home.hero.title", "x".repeat(500))).status, 400);
    assert.equal((await save("home.hero.title", "a\nb")).status, 400);
    assert.equal((await save("home.hero.image", "https://evil.example/x.png")).status, 404);
    assert.equal((await save("home.hero.intro", "Line one\nLine two")).status, 200);
    await call("/api/admin/content/home.hero.intro/reset", { method: "POST", json: {}, token: tokens.editor });
  });

  test("text is stored as text: markup stays visible text, never becomes part of the page", async () => {
    const evil = '<img src=x onerror="alert(1)">Study';
    assert.equal((await call("/api/admin/content/home.hero.badge", { method: "POST", json: { value: evil }, token: tokens.editor })).status, 200);
    assert.equal((await (await call("/api/content")).json()).text["home.hero.badge"], evil);
    await call("/api/admin/content/home.hero.badge/reset", { method: "POST", json: {}, token: tokens.editor });
  });

  test("a picture can be uploaded, is served with long caching, replaced, and reset", async () => {
    const up = (body, type = "image/png") => call("/api/admin/content/home.hero.image/image", { method: "POST", body, type, token: tokens.editor });
    const first = await up(PNG);
    assert.equal(first.status, 200);
    const { imageUrl } = await first.json();
    assert.match(imageUrl, /^\/api\/content\/images\/[0-9a-f-]{36}$/);
    assert.equal((await call("/api/content").then((r) => r.json())).images["home.hero.image"], imageUrl);
    const served = await call(imageUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/png");
    assert.match(served.headers.get("cache-control"), /immutable/);
    assert.equal(served.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), PNG);
    // replacing it gives a new address and removes the old picture
    const second = await (await up(JPEG, "application/octet-stream")).json();
    assert.notEqual(second.imageUrl, imageUrl);
    assert.equal((await call(imageUrl)).status, 404);
    assert.equal((await call(second.imageUrl)).headers.get("content-type"), "image/jpeg");
    assert.equal((await rows("SELECT count(*)::int AS n FROM site_images"))[0].n, 1);
    // the editor shows it as changed, and reset removes it for good
    const item = (await (await call("/api/admin/content", { token: tokens.editor })).json()).items.find((i) => i.key === "home.hero.image");
    assert.equal(item.imageUrl, second.imageUrl);
    assert.equal((await call("/api/admin/content/home.hero.image/reset", { method: "POST", json: {}, token: tokens.editor })).status, 200);
    assert.equal((await rows("SELECT count(*)::int AS n FROM site_images"))[0].n, 0);
    assert.deepEqual((await (await call("/api/content")).json()).images, {});
    assert.equal((await rows("SELECT count(*)::int AS n FROM admin_audit WHERE action='content_image'"))[0].n, 2);
  });

  test("files that aren't plain PNG, JPEG or WebP pictures are refused (including SVG)", async () => {
    const up = (body, type) => call("/api/admin/content/home.hero.image/image", { method: "POST", body, type, token: tokens.editor });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal((await up(svg, "image/png")).status, 400);
    assert.equal((await up(svg, "image/svg+xml")).status, 400);
    assert.equal((await up(Buffer.from("not a picture at all, just text"), "image/jpeg")).status, 400);
    assert.equal((await up(Buffer.alloc(0), "image/png")).status, 400);
    // a text item can't take a picture, and an unknown item can't either
    assert.equal((await call("/api/admin/content/home.hero.title/image", { method: "POST", body: PNG, type: "image/png", token: tokens.editor })).status, 404);
    assert.equal((await call("/api/admin/content/nope/image", { method: "POST", body: PNG, type: "image/png", token: tokens.editor })).status, 404);
    assert.equal((await rows("SELECT count(*)::int AS n FROM site_images"))[0].n, 0);
  });

  test("a picture over 3 MB is refused", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024 + 10)]);
    const res = await call("/api/admin/content/home.hero.image/image", { method: "POST", body: big, type: "image/png", token: tokens.editor });
    assert.equal(res.status, 413);
    assert.equal((await rows("SELECT count(*)::int AS n FROM site_images"))[0].n, 0);
  });

  test("the picture address only answers for real ids, and a removed key's leftovers are ignored", async () => {
    assert.equal((await call("/api/content/images/not-an-id")).status, 404);
    assert.equal((await call("/api/content/images/00000000-0000-4000-8000-000000000000")).status, 404);
    await db.query("INSERT INTO site_content (key, value, updated_by) VALUES ('home.removed.key','x','a@b.co')");
    assert.deepEqual((await (await call("/api/content")).json()).text, {});
    await db.query("DELETE FROM site_content");
  });

  test("the registry's keys match what the page asks for", () => {
    for (const k of ["home.hero.title", "home.why.card3.text", "uni.mu-pleven.image", "home.closing.text"]) assert.ok(CONTENT_BY_KEY[k], k);
  });
});
