-- 0001_engine.sql — engine persistence schema (plan 002, phase 5a).
--
-- Portability note: this SQL is validated in tests on @electric-sql/pglite and is
-- written to be byte-identical valid on real Postgres. Two deliberate choices keep
-- it portable and evolvable:
--   1. Status/mode are `text` + CHECK constraints, not native ENUM types. Adding a
--      value later is a CHECK swap, not an ALTER TYPE migration, and CHECK behaves
--      identically on pglite and Postgres.
--   2. Primary keys are `uuid` with NO database default. Ids are generated in the
--      application (crypto.randomUUID) so a run's decision/fill ids are known
--      before insert (the ledger links fills to decisions by id) and inserts stay
--      deterministic and testable. `gen_random_uuid()` is therefore never relied on.
--
-- Ownership is per-user via `owner_user_id` (a better-auth user id — text). The
-- team seam: when a team model lands, add `owner_team_id uuid` alongside and scope
-- reads by team membership in the DAL; nothing here bakes in a single-user
-- assumption beyond the column name.

create table if not exists engine_runs (
  id            uuid primary key,
  owner_user_id text not null,
  mode          text not null check (mode in ('backtest', 'paper')),
  status        text not null check (status in ('queued', 'running', 'completed', 'failed')),
  config        jsonb not null,
  error         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists engine_runs_owner_idx
  on engine_runs (owner_user_id, created_at desc);

create table if not exists engine_decisions (
  id         uuid primary key,
  run_id     uuid not null references engine_runs (id) on delete cascade,
  as_of      timestamptz not null,
  -- The full decision minus fills: signals, views, targetWeights, orders, gateActions.
  payload    jsonb not null,
  thesis     text,
  created_at timestamptz not null default now()
);

create index if not exists engine_decisions_run_idx
  on engine_decisions (run_id, as_of);

create table if not exists engine_fills (
  id          uuid primary key,
  run_id      uuid not null references engine_runs (id) on delete cascade,
  decision_id uuid not null references engine_decisions (id) on delete cascade,
  -- Monotonic insertion order within a run (created_at is too coarse to preserve
  -- fill order); the audit trail replays fills in the order they settled.
  seq         integer not null,
  fill        jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists engine_fills_run_idx on engine_fills (run_id, seq);
create index if not exists engine_fills_decision_idx on engine_fills (decision_id);

create table if not exists engine_results (
  run_id       uuid primary key references engine_runs (id) on delete cascade,
  equity_curve jsonb not null,
  metrics      jsonb not null,
  diagnostics  jsonb not null,
  caveats      jsonb not null,
  created_at   timestamptz not null default now()
);

create table if not exists panel_configs (
  id            uuid primary key,
  owner_user_id text not null,
  name          text not null,
  -- { analysts: [{ id, weight }] }
  panel         jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists panel_configs_owner_idx
  on panel_configs (owner_user_id, created_at desc);
