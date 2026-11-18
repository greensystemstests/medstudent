-- StudyBg admin dashboard: accounts, roles, two-step sign-in sessions and the audit log.
--
-- Same security model as the rest of the schema: the browser never reads these tables. Only the
-- studybg Edge Function does, after checking a signed-in admin. RLS is on with no policies and all
-- privileges are revoked from the public API roles.
-- (The statements between the markers are generated from server/admin/schema.js; a test keeps them equal.)

-- schema:start
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
-- schema:end

insert into admin_roles (key, name, description, permissions, students_scope, built_in) values
  ('super_admin', 'Super admin', 'Everything, including accounts, roles and the audit log.', array['*']::text[], 'all', true),
  ('student_manager', 'Student manager', 'Works with students: sees applications, changes status, reviews documents.', array['students.view','students.manage']::text[], 'assigned', true),
  ('viewer', 'Viewer', 'Read-only view of students and the monitoring pages.', array['students.view','monitoring.view']::text[], 'all', true),
  ('content_editor', 'Content editor', 'Edits the site''s text and images. No access to students.', array['content.edit']::text[], 'all', true)
on conflict (key) do nothing;

do $$
declare t text;
begin
  for t in select unnest(array['admin_roles','admin_users','admin_sessions','admin_audit']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on all sequences in schema public from anon, authenticated;
