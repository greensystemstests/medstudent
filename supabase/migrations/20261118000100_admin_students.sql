-- StudyBg admin dashboard, phase 2: how students arrived, who looks after them, and staff notes.
-- Same security model as before: RLS on, no policies, public API roles revoked.
-- (The statements between the markers are generated from server/admin/schema.js; a test keeps them equal.)

-- schema:start
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
-- schema:end

alter table public.student_notes enable row level security;
revoke all on table public.student_notes from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
