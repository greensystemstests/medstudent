-- StudyBg admin dashboard, phase 5: referral links, their visits, sign-ups and commissions.
-- Same security model as before: RLS on, no policies, public API roles revoked.
-- (The statements between the markers are generated from server/admin/schema.js; a test keeps them equal.)

-- schema:start
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
-- schema:end

do $$
declare t text;
begin
  for t in select unnest(array['referral_sources','referral_links','referral_clicks','referral_payments']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on all sequences in schema public from anon, authenticated;

-- The brands and channels offered when making a link (admins can add or rename them).
insert into referral_sources (name) values
  ('Instagram'), ('TikTok'), ('YouTube'), ('Facebook'), ('Telegram'), ('WhatsApp'), ('Email newsletter'), ('Partner / agency'), ('Other')
on conflict do nothing;
