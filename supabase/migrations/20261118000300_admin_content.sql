-- StudyBg admin dashboard, phase 4: editable site text and main images.
-- Same security model as before: RLS on, no policies, public API roles revoked.
-- (The statements between the markers are generated from server/admin/schema.js; a test keeps them equal.)

-- schema:start
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
-- schema:end

do $$
declare t text;
begin
  for t in select unnest(array['site_images','site_content']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
