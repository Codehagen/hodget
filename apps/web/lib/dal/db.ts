import "server-only"

import { createPgSql, type PgSql, type Sql } from "@workspace/db"

/**
 * Test-only seam (plan 004): point `getDb()` at an injected {@link Sql}, so the
 * durable step logic (`runExecuteStep` in `run-workflow.ts`) can be integration
 * tested against a PGlite database with no real Postgres pool. Production never
 * sets it, so this is inert outside tests.
 */
let testDb: Sql | undefined

export function __setTestDb(sql: Sql | undefined): void {
  testDb = sql
}

/**
 * The app's Postgres handle for the engine tables.
 *
 * Created lazily on first use — never at import time — so importing the DAL opens
 * no connections, and `DATABASE_URL` (the same env better-auth and Supabase use)
 * is resolved when the first request runs. One pool is reused across requests,
 * which is the correct pooling behaviour in a long-lived Node runtime; the
 * `@workspace/db` queries themselves stay connection-agnostic (they take this
 * handle as an argument), so nothing in the package holds process-global state.
 */
let pool: PgSql | undefined

export function getDb(): Sql {
  if (testDb) return testDb
  pool ??= createPgSql()
  return pool
}
