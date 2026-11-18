-- StudyBg admin dashboard, phase 3: error and user-flow monitoring.
-- Same security model as before: RLS on, no policies, public API roles revoked.
-- (The statements between the markers are generated from server/admin/schema.js; a test keeps them equal.)

-- schema:start
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
-- schema:end

do $$
declare t text;
begin
  for t in select unnest(array['error_events','error_group_state']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on all sequences in schema public from anon, authenticated;
