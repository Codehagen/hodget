import "server-only"

import { createPgSql, type PgSql } from "@workspace/db"

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

export function getDb(): PgSql {
  pool ??= createPgSql()
  return pool
}
