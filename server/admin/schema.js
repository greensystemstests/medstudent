// Admin dashboard tables. The same statements live in supabase/migrations/…_admin_dashboard.sql
// (which also locks the tables away from the public API); keep the two in step.
import { BUILT_IN_ROLES } from "../../shared/adminPermissions.js";

export const ADMIN_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS admin_roles (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key            text UNIQUE,
    name           text NOT NULL UNIQUE,
    description    text NOT NULL DEFAULT '',
    permissions    text[] NOT NULL DEFAULT '{}',
    students_scope text NOT NULL DEFAULT 'all' CHECK (students_scope IN ('all','assigned')),
    built_in       boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS admin_users (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email            text NOT NULL UNIQUE,
    full_name        text NOT NULL DEFAULT '',
    role_id          uuid NOT NULL REFERENCES admin_roles(id),
    status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
    totp_iv          bytea,
    totp_tag         bytea,
    totp_content     bytea,
    totp_enrolled_at timestamptz,
    totp_last_step   bigint,
    recovery_hashes  text[] NOT NULL DEFAULT '{}',
    created_by       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    last_login_at    timestamptz
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash   text PRIMARY KEY,
    admin_id     uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    stage        text NOT NULL CHECK (stage IN ('totp','enroll','full')),
    attempts     int NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    ip           text,
    user_agent   text
  );
  CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions(admin_id);
  CREATE TABLE IF NOT EXISTS admin_audit (
    id          bigserial PRIMARY KEY,
    admin_id    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    admin_email text NOT NULL,
    action      text NOT NULL,
    subject     text,
    detail      jsonb NOT NULL DEFAULT '{}',
    ip          text,
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit(created_at DESC);
`;

/** Adds the built-in roles if they're missing. Never overwrites a role someone has since edited. */
export async function seedAdminRoles(db) {
  for (const r of BUILT_IN_ROLES) {
    await db.query(
      `INSERT INTO admin_roles (key, name, description, permissions, students_scope, built_in)
       VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (key) DO NOTHING`,
      [r.key, r.name, r.description, r.permissions, r.studentsScope],
    );
  }
}

export async function migrateAdmin(db) {
  await db.query(ADMIN_SCHEMA_SQL);
  await seedAdminRoles(db);
}

/**
 * Makes sure each listed email is an active super admin (SUPER_ADMIN_EMAILS). This is how the very
 * first admin exists; after that, accounts are created from the Team page.
 */
export async function ensureSuperAdmins(db, emails) {
  const list = (emails || []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));
  if (!list.length) return 0;
  await seedAdminRoles(db);
  const { rows } = await db.query("SELECT id FROM admin_roles WHERE key='super_admin'");
  for (const email of list) {
    await db.query(
      `INSERT INTO admin_users (email, role_id) VALUES ($1,$2) ON CONFLICT (email) DO NOTHING`,
      [email, rows[0].id],
    );
  }
  return list.length;
}
