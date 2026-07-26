-- 0004_waitlist_hardening.sql — a rate limit that survives more than one
-- process, and an email constraint that matches what the app already enforces.
--
-- Plan 022. Two changes, both driven by the waitlist being the only
-- unauthenticated write in the app.
--
-- 1. `rate_limit_hits` replaces an in-memory Map that could not work on
--    serverless: a module-level counter is per-instance, so the real limit was
--    `max × instance count` and grew under the load an attack creates. A table
--    is the whole point — every instance shares one budget.
--
--    `bucket` is a SHA-256 hash, never a raw IP: IP addresses are personal data,
--    this serves EU visitors, and a hash is all a counter needs. Rows live for
--    at most the window and are pruned when a new window opens.
--
--    Fixed window, not sliding: a caller can burst at a window boundary, which
--    is fine here (the cost of one extra signup attempt is nothing) and it buys
--    a single atomic UPSERT instead of a range scan.
--
-- 2. The waitlist email CHECK required only an `@`, so it accepted `a@b` while
--    the app's regex rejected it — the column was the weaker check even though
--    the code comment claimed it was the authoritative one. Now they agree.
create table if not exists rate_limit_hits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

-- Prune scans by age; the primary key is no help since `bucket` leads it.
create index if not exists rate_limit_hits_window_idx
  on rate_limit_hits (window_start);

-- 0003 created this inline, so Postgres named it `waitlist_email_check`.
-- Dropping by that name first keeps re-running the migration set safe.
alter table waitlist drop constraint if exists waitlist_email_check;
alter table waitlist drop constraint if exists waitlist_email_format;
alter table waitlist add constraint waitlist_email_format check (
  length(email) <= 254
  and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
);
