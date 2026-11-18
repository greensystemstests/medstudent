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

// Phase 2: how a student arrived, who looks after them, and staff notes. Own block so it has its own migration.
export const ADMIN_STUDENTS_SQL = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source jsonb;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_country text;
  ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS applications_assigned_idx ON applications(assigned_admin_id);
  CREATE INDEX IF NOT EXISTS applications_status_idx ON applications(status, updated_at DESC);
  CREATE TABLE IF NOT EXISTS student_notes (
    id             bigserial PRIMARY KEY,
    application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    admin_id       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    admin_email    text NOT NULL,
    note           text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS student_notes_app_idx ON student_notes(application_id, created_at DESC);
`;

// Phase 3: what went wrong on the site, and which problems someone has already dealt with.
export const ADMIN_MONITORING_SQL = `
  CREATE TABLE IF NOT EXISTS error_events (
    id          bigserial PRIMARY KEY,
    created_at  timestamptz NOT NULL DEFAULT now(),
    source      text NOT NULL CHECK (source IN ('client','server')),
    kind        text NOT NULL,
    fingerprint text NOT NULL,
    message     text NOT NULL,
    route       text,
    page        text,
    status      int,
    step        int,
    user_id     uuid REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS error_events_created_idx ON error_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS error_events_fp_idx ON error_events(fingerprint, created_at DESC);
  CREATE TABLE IF NOT EXISTS error_group_state (
    fingerprint text PRIMARY KEY,
    status      text NOT NULL CHECK (status IN ('resolved','ignored')),
    note        text NOT NULL DEFAULT '',
    updated_by  text NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
  );
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

export const ADMIN_CONTENT_SQL = `
  CREATE TABLE IF NOT EXISTS site_images (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type text NOT NULL,
    data         bytea NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS site_content (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_by text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`;

export const ADMIN_AFFILIATES_SQL = `
  CREATE TABLE IF NOT EXISTS referral_sources (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS referral_sources_name_idx ON referral_sources (lower(name));
  CREATE TABLE IF NOT EXISTS referral_links (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code             text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
    name             text NOT NULL,
    source_id        uuid NOT NULL REFERENCES referral_sources(id),
    commission_cents int NOT NULL CHECK (commission_cents >= 0 AND commission_cents <= 100000),
    destination      text NOT NULL DEFAULT '/',
    status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
    notes            text NOT NULL DEFAULT '',
    created_by       text NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS referral_clicks (
    link_id uuid NOT NULL REFERENCES referral_links(id) ON DELETE CASCADE,
    day     date NOT NULL,
    clicks  int NOT NULL DEFAULT 0,
    PRIMARY KEY (link_id, day)
  );
  CREATE TABLE IF NOT EXISTS referral_payments (
    id           bigserial PRIMARY KEY,
    link_id      uuid NOT NULL REFERENCES referral_links(id) ON DELETE CASCADE,
    kind         text NOT NULL CHECK (kind IN ('payout','adjustment')),
    amount_cents int NOT NULL,
    note         text NOT NULL DEFAULT '',
    created_by   text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS referral_payments_link_idx ON referral_payments(link_id);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_link_id uuid REFERENCES referral_links(id) ON DELETE SET NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_commission_cents int;
  CREATE INDEX IF NOT EXISTS users_referral_idx ON users(referral_link_id) WHERE referral_link_id IS NOT NULL;
`;

/** The brands and channels offered when making a link. Admins can add their own or rename these. */
export const DEFAULT_REFERRAL_SOURCES = ["Instagram", "TikTok", "YouTube", "Facebook", "Telegram", "WhatsApp", "Email newsletter", "Partner / agency", "Other"];

export async function migrateAdmin(db) {
  await db.query(ADMIN_SCHEMA_SQL);
  await db.query(ADMIN_STUDENTS_SQL);
  await db.query(ADMIN_MONITORING_SQL);
  await db.query(ADMIN_CONTENT_SQL);
  await db.query(ADMIN_AFFILIATES_SQL);
  await seedReferralSources(db);
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

export async function seedReferralSources(db) {
  for (const name of DEFAULT_REFERRAL_SOURCES)
    await db.query("INSERT INTO referral_sources (name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
}
