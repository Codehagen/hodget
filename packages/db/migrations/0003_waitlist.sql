-- 0003_waitlist.sql — the public signup list (moved off Supabase).
--
-- Previously this table lived in the Supabase project and was written from the
-- browser-issued anon key over PostgREST, which made an RLS policy the only
-- thing standing between a public credential and every signup email. It is now
-- written server-side through the pooled connection in `lib/dal/waitlist.ts`,
-- so there is no public credential and no public HTTP endpoint on the table —
-- the confidentiality control is that nothing outside the DAL can reach it.
-- RLS is therefore deliberately NOT enabled here; there is no anon role to
-- constrain.
--
-- Portability follows 0001_engine.sql: `text` + CHECK instead of native ENUMs,
-- and no database-side uuid default (ids are generated in-app with
-- crypto.randomUUID) so inserts stay deterministic and testable on both `pg`
-- and pglite.
create table if not exists waitlist (
  id         uuid primary key,
  email      text not null check (position('@' in email) > 1 and length(email) <= 254),
  source     text not null default 'landing',
  created_at timestamptz not null default now()
);

-- One row per address. `insertWaitlistEmail` relies on this for its
-- ON CONFLICT DO NOTHING duplicate path — a repeat signup is a success for the
-- user, not an error, and must not leak whether an address is already listed.
create unique index if not exists waitlist_email_key on waitlist (lower(email));
