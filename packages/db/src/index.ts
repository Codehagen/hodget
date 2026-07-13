/**
 * `@workspace/db` — the engine's persistence layer (plan 002 phase 5a).
 *
 * Postgres schema + SQL migrations, centralized per-domain queries (callers never
 * touch the driver — they pass an {@link Sql} handle), the Postgres-backed decision
 * {@link PostgresLedger}, and the in-process run executor with its per-run progress
 * emitter. The app reaches all of this only through `lib/dal`, which validates the
 * session first (ESLint enforces that boundary).
 */

export type { Sql, PgSql } from "./client.js"
export { createPgSql } from "./client.js"

// Note: migrations (./migrate.js) are intentionally NOT re-exported here. They
// read the filesystem (`migrations/`), which must not enter the app bundle; the
// test harness (@workspace/db/testing) and any migration script import them
// directly.

export * from "./schema.js"

export * from "./queries/runs.js"
export * from "./queries/decisions.js"
export * from "./queries/fills.js"
export * from "./queries/results.js"
export * from "./queries/panel-configs.js"
export { getPersistedDecisions } from "./queries/reconstruct.js"

export { PostgresLedger, summarizeThesis } from "./ledger/postgres-ledger.js"

export { runConfigSchema, type RunConfig } from "./executor/config.js"
export {
  createRunEmitter,
  isTerminal,
  RunRegistry,
  type RunEmitter,
  type RunEvent,
  type RunEventListener,
} from "./executor/events.js"
export {
  defaultAnalystSource,
  fixtureDataSource,
  instrumentAnalyst,
  type AnalystSource,
  type RunDataSource,
} from "./executor/sources.js"
export { executeRun, type ExecuteRunDeps } from "./executor/run-executor.js"
