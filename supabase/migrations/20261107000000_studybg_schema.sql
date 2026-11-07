-- StudyBg.ac: database schema for accounts, applications, payments, invoices and documents.
--
-- Security model: the browser never talks to these tables directly. Only the `studybg` Edge Function
-- reads and writes them (as the database owner), and it scopes every query to the signed-in user.
-- Row Level Security is switched ON for every table with NO policies, and every privilege is revoked
-- from the public API roles (anon, authenticated), so the Supabase REST/GraphQL API cannot read or
-- write any of it even with the public key.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  full_name     text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists login_codes (
  email      text primary key,
  code_hash  text not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists documents (
  id          uuid primary key,
  user_id     uuid not null references users(id) on delete cascade,
  category    text not null,
  filename    text not null,
  mime_type   text not null,
  size_bytes  int  not null,
  status      text not null default 'received',
  key_id      text not null,
  iv          bytea not null,
  auth_tag    bytea not null,
  content     bytea not null,
  review_note text not null default '',
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists documents_user_idx on documents(user_id, created_at desc);

create table if not exists activity (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  type       text not null,
  detail     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activity_user_idx on activity(user_id, created_at desc);

create table if not exists applications (
  id                  text primary key,
  user_id             uuid not null references users(id),
  form                jsonb not null,
  current_step        int not null default 1,
  version             int not null default 1,
  status              text not null default 'draft',
  payment_intent_id   text unique,
  checkout_session_id text unique,
  checkout_attempt    int not null default 0,
  checkout_started_at timestamptz,
  submitted_at        timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists applications_user_idx on applications(user_id, updated_at desc);

create table if not exists application_consents (
  id                  bigserial primary key,
  application_id      text not null references applications(id),
  user_id             uuid not null references users(id),
  policy_version      text not null,
  application_version int not null,
  form_snapshot       jsonb not null,
  accepted_at         timestamptz not null default now(),
  unique (application_id, policy_version, application_version)
);

create table if not exists invoice_counter (
  id          int primary key check (id = 1),
  last_number bigint not null
);

create table if not exists invoices (
  payment_intent_id text primary key,
  invoice_number    bigint unique not null,
  issued_at         timestamptz not null,
  buyer_email       text not null,
  payload           jsonb not null,
  pdf               bytea,
  created_at        timestamptz not null default now()
);

create table if not exists email_outbox (
  id               text primary key,
  kind             text not null,
  payload          jsonb not null,
  state            text not null default 'pending',
  attempts         int not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at  timestamptz not null default now(),
  provider_id      text,
  last_error       text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create table if not exists staff_audit (
  id              bigserial primary key,
  actor_id        uuid not null references users(id),
  subject_user_id uuid references users(id),
  action          text not null,
  detail          jsonb not null,
  created_at      timestamptz not null default now()
);

-- Go-live switches. Payments stay off until both are 'true' (and every key is configured).
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value) values
  ('checkout_enabled', 'false'),
  ('legal_approved',   'false')
on conflict (key) do nothing;

-- Lock every table away from the public API.
do $$
declare t text;
begin
  for t in select unnest(array[
    'users','login_codes','sessions','documents','activity','applications',
    'application_consents','invoice_counter','invoices','email_outbox','staff_audit','app_settings'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
