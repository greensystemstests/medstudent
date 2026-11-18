import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { createApp } from "./app.js";
import { connectDb, migrate } from "./db.js";
import { fileKeyFromEnv } from "./fileCrypto.js";
import { ensureSuperAdmins } from "./admin/schema.js";
import { base32Encode, generateRecoveryCodes, otpauthUri, stepAt, totpCode, verifyTotp } from "./totp.js";
import { roleCan, validPermissionList, BUILT_IN_ROLES } from "../shared/adminPermissions.js";
import { ADMIN_SCHEMA_SQL } from "./admin/schema.js";
import fs from "node:fs";

const DB_URL = process.env.TEST_DATABASE_URL;
if (DB_URL && !new URL(DB_URL).pathname.endsWith("_test"))
  throw new Error("Refusing to run: TEST_DATABASE_URL must name a database ending in _test.");

test("authenticator codes follow RFC 6238, accept clock drift, and refuse replays", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(totpCode(secret, Math.floor(59 / 30)), "287082");
  assert.equal(totpCode(secret, Math.floor(1111111109 / 30)), "081804");
  const now = 1_700_000_000_000;
  const step = stepAt(now);
  assert.equal(verifyTotp(secret, totpCode(secret, step), { now }), step);
  assert.equal(verifyTotp(secret, totpCode(secret, step - 1), { now }), step - 1, "one step behind");
  assert.equal(verifyTotp(secret, totpCode(secret, step + 1), { now }), step + 1, "one step ahead");
  assert.equal(verifyTotp(secret, totpCode(secret, step + 3), { now }), null, "too far off");
  assert.equal(verifyTotp(secret, totpCode(secret, step), { now, lastStep: step }), null, "same step twice");
  assert.equal(verifyTotp(secret, totpCode(secret, step), { now, lastStep: step - 1 }), step);
  assert.equal(verifyTotp(secret, "12345", { now }), null);
  assert.equal(verifyTotp(secret, "abcdef", { now }), null);
  assert.match(otpauthUri({ secret, email: "a@b.co" }), /^otpauth:\/\/totp\/StudyBg%20Admin%3Aa%40b\.co\?secret=[A-Z2-7]+&issuer=/);
  const codes = generateRecoveryCodes();
  assert.equal(new Set(codes).size, 8);
  assert.ok(codes.every((c) => /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(c)));
});

test("permissions: the super role can do everything, others only what they hold", () => {
  assert.ok(roleCan({ key: "super_admin", permissions: ["*"] }, "content.edit"));
  assert.ok(roleCan({ key: "x", permissions: ["students.view"] }, "students.view"));
  assert.ok(!roleCan({ key: "x", permissions: ["students.view"] }, "students.manage"));
  assert.ok(validPermissionList(["students.view", "content.edit"]));
  assert.ok(!validPermissionList(["students.view", "root"]));
  assert.ok(!validPermissionList(["students.view", "students.view"]));
  assert.ok(!validPermissionList("students.view"));
});

test("the production migration contains exactly the schema the code expects", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261118000000_admin_dashboard.sql", import.meta.url), "utf8");
  const squash = (x) => x.replace(/\s+/g, " ").trim();
  const between = sql.split("-- schema:start")[1].split("-- schema:end")[0];
  assert.equal(squash(between), squash(ADMIN_SCHEMA_SQL));
  for (const role of BUILT_IN_ROLES) assert.ok(sql.includes(`'${role.key}'`), `migration seeds ${role.key}`);
  for (const t of ["admin_roles", "admin_users", "admin_sessions", "admin_audit"]) assert.ok(sql.includes(`'${t}'`), `RLS covers ${t}`);
});

describe("admin sign-in, two-step verification, team and roles", { skip: !DB_URL && "TEST_DATABASE_URL not set" }, () => {
  let db, server, base;
  const codes = new Map();
  const invites = [];
  const secrets = new Map();
  const SUPER = "boss@example.com";

  const call = (path, { method = "GET", json, token, headers = {} } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(json ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: json ? JSON.stringify(json) : undefined,
    });
  const body = async (r) => r.json();

  /** Emails the code (clearing the 30-second resend wait first) and returns it. */
  async function emailedCode(email) {
    await db.query("DELETE FROM login_codes WHERE email = $1", [`admin sign-in ${email}`]);
    codes.delete(email);
    const r = await call("/api/admin/auth/request-code", { method: "POST", json: { email } });
    assert.equal(r.status, 200);
    return codes.get(email);
  }
  async function verifyEmail(email) {
    const r = await call("/api/admin/auth/verify-code", { method: "POST", json: { email, code: await emailedCode(email) } });
    assert.equal(r.status, 200, await r.clone().text());
    return body(r);
  }
  /** Enrols the authenticator for an account that has none and returns a full session token. */
  async function enrol(email) {
    const { token, stage } = await verifyEmail(email);
    assert.equal(stage, "enroll");
    const start = await body(await call("/api/admin/auth/enroll/start", { method: "POST", token }));
    secrets.set(email, start.secret);
    const done = await call("/api/admin/auth/enroll/confirm", {
      method: "POST",
      token,
      json: { code: totpCode(start.secret, stepAt()) },
    });
    assert.equal(done.status, 200, await done.clone().text());
    return body(done);
  }
  /** Signs in an enrolled account. Time doesn't pass in a test, so the replay marker is cleared first. */
  async function signIn(email) {
    await db.query("UPDATE admin_users SET totp_last_step = NULL WHERE email = $1", [email]);
    const { token, stage } = await verifyEmail(email);
    assert.equal(stage, "totp");
    const r = await call("/api/admin/auth/verify-totp", {
      method: "POST",
      token,
      json: { code: totpCode(secrets.get(email), stepAt()) },
    });
    assert.equal(r.status, 200, await r.clone().text());
    return (await body(r)).token;
  }
  const roleId = async (key) => (await db.query("SELECT id FROM admin_roles WHERE key = $1", [key])).rows[0].id;

  before(async () => {
    db = connectDb(DB_URL);
    await db.query("DROP TABLE IF EXISTS admin_audit, admin_sessions, admin_users, admin_roles CASCADE");
    await migrate(db);
    await migrate(db); // safe to run twice
    const app = createApp({
      config: { allowedOrigins: [], flags: async () => ({ checkoutEnabled: false, legalApproved: false }) },
      accounts: {
        db,
        fileKey: fileKeyFromEnv("a-long-test-secret-for-admin-tests"),
        deliverCode: async () => {},
        deliverAdminCode: async (email, code) => codes.set(email, code),
        deliverAdminInvite: async (d) => invites.push(d),
        rateLimits: { adminAuth: 100000 },
      },
      log: () => {},
    });
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    await db.query("DELETE FROM admin_sessions");
    await db.query("DELETE FROM login_codes WHERE email LIKE 'admin sign-in %'");
  });
  after(async () => {
    server?.close();
    await db?.end?.();
  });

  test("built-in roles exist and the first super admin is created from the environment", async () => {
    assert.equal(await ensureSuperAdmins(db, [SUPER, "not-an-email"]), 1);
    await ensureSuperAdmins(db, [SUPER]); // idempotent
    const roles = await db.query("SELECT key FROM admin_roles WHERE built_in ORDER BY key");
    assert.deepEqual(roles.rows.map((r) => r.key), ["content_editor", "student_manager", "super_admin", "viewer"]);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM admin_users")).rows[0].n, 1);
  });

  test("an email that isn't an admin gets the same answer and no code", async () => {
    const r = await call("/api/admin/auth/request-code", { method: "POST", json: { email: "stranger@example.com" } });
    assert.equal(r.status, 200);
    assert.deepEqual(await body(r), { sent: true });
    assert.equal(codes.get("stranger@example.com"), undefined);
    const v = await call("/api/admin/auth/verify-code", { method: "POST", json: { email: "stranger@example.com", code: "123456" } });
    assert.equal(v.status, 401);
    assert.equal((await call("/api/admin/auth/request-code", { method: "POST", json: { email: "bad" } })).status, 400);
  });

  test("the emailed code alone gets nobody into the admin; the authenticator is required", async () => {
    const wrong = await call("/api/admin/auth/verify-code", { method: "POST", json: { email: SUPER, code: "000000" } });
    assert.equal(wrong.status, 401);
    const { token, stage } = await verifyEmail(SUPER);
    assert.equal(stage, "enroll");
    assert.equal((await call("/api/admin/team", { token })).status, 401, "half-signed-in token has no access");
    assert.equal((await call("/api/admin/auth/me", { token }).then(body)).stage, "enroll");
    // Secret is stored encrypted: no base32 secret in the database.
    const start = await body(await call("/api/admin/auth/enroll/start", { method: "POST", token }));
    assert.match(start.uri, /^otpauth:\/\/totp\//);
    const row = (await db.query("SELECT totp_content FROM admin_users WHERE email=$1", [SUPER])).rows[0];
    assert.ok(!Buffer.from(row.totp_content).toString("latin1").includes(start.secret), "secret must be encrypted at rest");
    const bad = await call("/api/admin/auth/enroll/confirm", { method: "POST", token, json: { code: "000000" } });
    assert.equal(bad.status, 401);
    const ok = await call("/api/admin/auth/enroll/confirm", {
      method: "POST",
      token,
      json: { code: totpCode(start.secret, stepAt()) },
    });
    assert.equal(ok.status, 200);
    const full = await body(ok);
    secrets.set(SUPER, start.secret);
    assert.equal(full.stage, "full");
    assert.equal(full.recoveryCodes.length, 8);
    assert.notEqual(full.token, token, "the token is replaced when sign-in completes");
    assert.equal((await call("/api/admin/auth/me", { token })).status, 401, "the old token is dead");
    assert.equal((await call("/api/admin/team", { token: full.token })).status, 200);
    assert.deepEqual(
      Object.keys(full.admin).sort(),
      ["createdAt", "email", "fullName", "id", "lastLoginAt", "recoveryCodesLeft", "role", "status", "twoFactorEnabled"],
      "no secret material is sent to the browser",
    );
    // keep the recovery codes for a later test
    secrets.set(SUPER + ":recovery", full.recoveryCodes);
  });

  test("signing in again needs the emailed code and a fresh authenticator code, never the same one twice", async () => {
    await db.query("UPDATE admin_users SET totp_last_step = NULL WHERE email = $1", [SUPER]);
    const first = await verifyEmail(SUPER);
    assert.equal(first.stage, "totp");
    const secret = secrets.get(SUPER);
    const bad = await call("/api/admin/auth/verify-totp", { method: "POST", token: first.token, json: { code: "000000" } });
    assert.equal(bad.status, 401);
    const good = await call("/api/admin/auth/verify-totp", {
      method: "POST",
      token: first.token,
      json: { code: totpCode(secret, stepAt()) },
    });
    assert.equal(good.status, 200);
    // The same authenticator code, used by a second sign-in right away, is refused.
    const second = await verifyEmail(SUPER);
    const replay = await call("/api/admin/auth/verify-totp", {
      method: "POST",
      token: second.token,
      json: { code: totpCode(secret, stepAt()) },
    });
    assert.equal(replay.status, 401, "a used code can't be replayed");
    const next = await call("/api/admin/auth/verify-totp", {
      method: "POST",
      token: second.token,
      json: { code: totpCode(secret, stepAt() + 1) },
    });
    assert.equal(next.status, 200, "the next code works");
  });

  test("five wrong authenticator codes end the sign-in", async () => {
    await db.query("UPDATE admin_users SET totp_last_step = NULL WHERE email = $1", [SUPER]);
    const { token } = await verifyEmail(SUPER);
    const statuses = [];
    for (let i = 0; i < 5; i++)
      statuses.push((await call("/api/admin/auth/verify-totp", { method: "POST", token, json: { code: "000000" } })).status);
    assert.deepEqual(statuses, [401, 401, 401, 401, 401]);
    const after = await call("/api/admin/auth/verify-totp", {
      method: "POST",
      token,
      json: { code: totpCode(secrets.get(SUPER), stepAt()) },
    });
    assert.equal(after.status, 401, "even the right code is refused once locked");
  });

  test("a recovery code signs in once, then is gone", async () => {
    const [code] = secrets.get(SUPER + ":recovery");
    const { token } = await verifyEmail(SUPER);
    const r = await call("/api/admin/auth/verify-totp", { method: "POST", token, json: { recoveryCode: code.toUpperCase() } });
    assert.equal(r.status, 200, await r.clone().text());
    assert.equal((await body(r)).admin.recoveryCodesLeft, 7);
    const again = await verifyEmail(SUPER);
    const reuse = await call("/api/admin/auth/verify-totp", { method: "POST", token: again.token, json: { recoveryCode: code } });
    assert.equal(reuse.status, 401);
  });

  test("an admin session can't be used on the student API, nor a student one on the admin API", async () => {
    const token = await signIn(SUPER);
    assert.equal((await call("/api/me", { token })).status, 401);
    const student = await db.query("INSERT INTO users (email) VALUES ('student@example.com') ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id");
    const { createHash, randomBytes } = await import("node:crypto");
    const studentToken = randomBytes(24).toString("base64url");
    await db.query("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 day')", [
      createHash("sha256").update(studentToken).digest("hex"),
      student.rows[0].id,
    ]);
    assert.equal((await call("/api/admin/team", { token: studentToken })).status, 401);
  });

  test("super admin creates a role and an account; the new person enrols and only gets what the role allows", async () => {
    const boss = await signIn(SUPER);
    const perms = await body(await call("/api/admin/team", { token: boss }));
    assert.ok(perms.permissions["students.view"]);
    // Rules are checked: unknown permission, empty name, duplicate name.
    const badPerm = await call("/api/admin/team/roles", { method: "POST", token: boss, json: { name: "Odd", permissions: ["root"], studentsScope: "all" } });
    assert.equal(badPerm.status, 400);
    assert.equal((await call("/api/admin/team/roles", { method: "POST", token: boss, json: { name: "", permissions: [], studentsScope: "all" } })).status, 400);
    const made = await call("/api/admin/team/roles", {
      method: "POST",
      token: boss,
      json: { name: "Advisor", description: "Looks after assigned students", permissions: ["students.view", "students.manage"], studentsScope: "assigned" },
    });
    assert.equal(made.status, 201);
    const advisorRole = (await body(made)).roleId;
    assert.equal(
      (await call("/api/admin/team/roles", { method: "POST", token: boss, json: { name: "Advisor", permissions: [], studentsScope: "all" } })).status,
      409,
      "duplicate role name",
    );
    const created = await call("/api/admin/team/admins", {
      method: "POST",
      token: boss,
      json: { email: "Advisor@Example.com ", fullName: "Ana Advisor", roleId: advisorRole },
    });
    assert.equal(created.status, 201, await created.clone().text());
    const { admin, invited } = await body(created);
    assert.equal(admin.email, "advisor@example.com");
    assert.equal(admin.twoFactorEnabled, false);
    assert.equal(invited, true);
    assert.equal(invites.at(-1).roleName, "Advisor");
    assert.equal(
      (await call("/api/admin/team/admins", { method: "POST", token: boss, json: { email: "advisor@example.com", fullName: "Dup", roleId: advisorRole } })).status,
      409,
    );

    const adv = (await enrol("advisor@example.com")).token;
    assert.equal((await call("/api/admin/team", { token: adv })).status, 403, "advisors can't manage accounts");
    assert.equal((await call("/api/admin/audit", { token: adv })).status, 403);
    assert.equal((await call("/api/admin/team/roles", { method: "POST", token: adv, json: { name: "Mine", permissions: [], studentsScope: "all" } })).status, 403);
    const me = await body(await call("/api/admin/auth/me", { token: adv }));
    assert.deepEqual(me.admin.role.permissions, ["students.view", "students.manage"]);
    assert.equal(me.admin.role.studentsScope, "assigned");

    // Changing the role's rules applies on the next request, no new sign-in.
    await call(`/api/admin/team/roles/${advisorRole}`, {
      method: "POST",
      token: boss,
      json: { name: "Advisor", description: "", permissions: ["students.view"], studentsScope: "assigned" },
    });
    assert.deepEqual((await body(await call("/api/admin/auth/me", { token: adv }))).admin.role.permissions, ["students.view"]);

    // A role in use can't be deleted; built-in roles can't be deleted; super role can't be edited.
    assert.equal((await call(`/api/admin/team/roles/${advisorRole}`, { method: "DELETE", token: boss })).status, 409);
    assert.equal((await call(`/api/admin/team/roles/${await roleId("viewer")}`, { method: "DELETE", token: boss })).status, 409);
    assert.equal(
      (await call(`/api/admin/team/roles/${await roleId("super_admin")}`, {
        method: "POST",
        token: boss,
        json: { name: "Super admin", permissions: [], studentsScope: "all" },
      })).status,
      409,
    );
  });

  test("the last super admin can't be locked out, and people can't demote or disable themselves", async () => {
    const boss = await signIn(SUPER);
    const team = await body(await call("/api/admin/team", { token: boss }));
    const self = team.admins.find((a) => a.email === SUPER);
    const viewer = await roleId("viewer");
    assert.equal((await call(`/api/admin/team/admins/${self.id}`, { method: "POST", token: boss, json: { status: "disabled" } })).status, 409);
    assert.equal((await call(`/api/admin/team/admins/${self.id}`, { method: "POST", token: boss, json: { roleId: viewer } })).status, 409);
    assert.equal((await call(`/api/admin/team/admins/${self.id}`, { method: "DELETE", token: boss })).status, 409);
    assert.equal((await call(`/api/admin/team/admins/${self.id}/reset-2fa`, { method: "POST", token: boss })).status, 409);

    // A second super admin makes it possible to change the first.
    const superRole = await roleId("super_admin");
    const second = await body(
      await call("/api/admin/team/admins", { method: "POST", token: boss, json: { email: "second@example.com", fullName: "Second Boss", roleId: superRole } }),
    );
    const secondToken = (await enrol("second@example.com")).token;
    const demote = await call(`/api/admin/team/admins/${self.id}`, { method: "POST", token: secondToken, json: { roleId: viewer } });
    assert.equal(demote.status, 200, "allowed now: another active super admin remains");
    // …but then the second one is the last super admin.
    const back = await call(`/api/admin/team/admins/${second.admin.id}`, { method: "DELETE", token: secondToken });
    assert.equal(back.status, 409, "can't delete yourself");
    // Restore for later tests.
    await db.query("UPDATE admin_users SET role_id = $2 WHERE email = $1", [SUPER, superRole]);
    await db.query("DELETE FROM admin_users WHERE email = 'second@example.com'");
  });

  test("disabling an account signs it out; resetting two-step makes it enrol again", async () => {
    const boss = await signIn(SUPER);
    const adv = await signIn("advisor@example.com");
    assert.equal((await call("/api/admin/auth/me", { token: adv })).status, 200);
    const target = (await body(await call("/api/admin/team", { token: boss }))).admins.find((a) => a.email === "advisor@example.com");

    assert.equal((await call(`/api/admin/team/admins/${target.id}`, { method: "POST", token: boss, json: { status: "disabled" } })).status, 200);
    assert.equal((await call("/api/admin/auth/me", { token: adv })).status, 401, "existing session ended");
    // A disabled account gets no code and can't verify one.
    codes.delete("advisor@example.com");
    await call("/api/admin/auth/request-code", { method: "POST", json: { email: "advisor@example.com" } });
    assert.equal(codes.get("advisor@example.com"), undefined);

    await call(`/api/admin/team/admins/${target.id}`, { method: "POST", token: boss, json: { status: "active" } });
    assert.equal((await call(`/api/admin/team/admins/${target.id}/reset-2fa`, { method: "POST", token: boss })).status, 200);
    const { stage } = await verifyEmail("advisor@example.com");
    assert.equal(stage, "enroll", "two-step setup starts over");
  });

  test("regenerating recovery codes needs a fresh authenticator code and replaces the old ones", async () => {
    const boss = await signIn(SUPER);
    const none = await call("/api/admin/auth/recovery-codes", { method: "POST", token: boss, json: { code: "000000" } });
    assert.equal(none.status, 401);
    const ok = await call("/api/admin/auth/recovery-codes", {
      method: "POST",
      token: boss,
      json: { code: totpCode(secrets.get(SUPER), stepAt() + 1) },
    });
    assert.equal(ok.status, 200, await ok.clone().text());
    assert.equal((await body(ok)).recoveryCodes.length, 8);
    const old = secrets.get(SUPER + ":recovery")[1];
    const { token } = await verifyEmail(SUPER);
    const tryOld = await call("/api/admin/auth/verify-totp", { method: "POST", token, json: { recoveryCode: old } });
    assert.equal(tryOld.status, 401, "old recovery codes stop working");
  });

  test("everything an admin does is in the audit log, for super admins only", async () => {
    const boss = await signIn(SUPER);
    const log = await body(await call("/api/admin/audit?limit=200", { token: boss }));
    const actions = new Set(log.entries.map((e) => e.action));
    for (const a of ["signin", "totp_enrolled", "role_created", "role_updated", "admin_created", "admin_updated", "admin_2fa_reset", "recovery_code_used"])
      assert.ok(actions.has(a), `audit log has ${a}`);
    assert.ok(log.entries.every((e) => typeof e.admin_email === "string"));
    assert.equal((await call("/api/admin/audit")).status, 401);
  });

  test("signing out ends the session", async () => {
    const token = await signIn(SUPER);
    assert.equal((await call("/api/admin/auth/logout", { method: "POST", token })).status, 200);
    assert.equal((await call("/api/admin/team", { token })).status, 401);
  });

  test("idle sessions expire", async () => {
    const token = await signIn(SUPER);
    await db.query("UPDATE admin_sessions SET last_seen_at = now() - interval '3 hours'");
    assert.equal((await call("/api/admin/team", { token })).status, 401);
  });
});
