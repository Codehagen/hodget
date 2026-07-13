import { PGlite } from "@electric-sql/pglite"

import type { Sql } from "../client.js"
import { applyMigrations } from "../migrate.js"

/**
 * A pglite-backed {@link Sql} for tests — an in-process Postgres with no docker or
 * live database, so `pnpm test` runs anywhere. pglite speaks the same wire types
 * as Postgres (`$1` params, jsonb, timestamptz), and every statement in
 * `migrations/` is written to be valid on both, so a green test here is real
 * evidence the schema works on Postgres.
 *
 * This module is intentionally NOT re-exported from the package root: pglite is a
 * devDependency and must never reach the app bundle. Import it via
 * `@workspace/db/testing`.
 */

/** Anything that can run a parameterized query — PGlite or one of its transactions. */
type Queryable = Pick<PGlite, "query">

/** Wrap a transaction handle: already inside a transaction, so nested calls inline. */
function txSql(db: Queryable): Sql {
  return {
    async query(text, params) {
      const result = await db.query(text, params as unknown[])
      return result.rows as never[]
    },
    transaction: (fn) => fn(txSql(db)),
  }
}

function rootSql(db: PGlite): Sql {
  return {
    async query(text, params) {
      const result = await db.query(text, params as unknown[])
      return result.rows as never[]
    },
    transaction: (fn) => db.transaction((tx) => fn(txSql(tx))),
  }
}

export interface TestDb extends Sql {
  close(): Promise<void>
}

/** Spin up a fresh in-memory database with all migrations applied. */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite()
  const sql = rootSql(db)
  await applyMigrations(sql)
  return { ...sql, close: () => db.close() }
}
