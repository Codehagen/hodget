import { Pool, type PoolClient } from "pg"

/**
 * The database handle every query in this package takes as its first argument.
 *
 * Queries never reach for a connection themselves — they receive an {@link Sql}.
 * That keeps the package free of any process-global connection (plan 002: "No
 * process-global singletons anywhere; every run gets a context object"). The app
 * owns pool lifecycle; tests pass a pglite-backed {@link Sql}. Both real Postgres
 * (`pg`) and pglite speak `$1`-style placeholders and return `.rows`, so one
 * interface covers both.
 */
export interface Sql {
  /** Run a parameterized statement and return the result rows. */
  query<Row = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<Row[]>
  /**
   * Run `fn` inside a single transaction. The handle passed to `fn` writes on the
   * transaction's connection; the block commits when `fn` resolves and rolls back
   * if it throws. Nested calls run inline (no savepoints) — the ledger persists in
   * one flat transaction, which is all phase 5a needs.
   */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>
}

/** A live Postgres {@link Sql} that also exposes pool teardown. */
export interface PgSql extends Sql {
  /** Close the underlying pool. Call on shutdown; never per request. */
  end(): Promise<void>
}

function clientSql(client: PoolClient): Sql {
  return {
    async query(text, params) {
      const result = await client.query(text, params as unknown[])
      return result.rows
    },
    // Already inside a transaction: run the block on the same connection.
    transaction: (fn) => fn(clientSql(client)),
  }
}

/**
 * Build a Postgres-backed {@link Sql} over a connection string.
 *
 * The connection string is resolved when this is called, not at import time — the
 * app creates the pool lazily on first request, so importing the package opens no
 * connections. Reads `DATABASE_URL` (the same env `apps/web` uses for better-auth
 * and Supabase) when no string is passed, and fails loud if it is missing.
 */
export function createPgSql(connectionString?: string): PgSql {
  const resolved = connectionString ?? process.env.DATABASE_URL
  if (!resolved) {
    throw new Error("createPgSql: DATABASE_URL is not set")
  }
  const pool = new Pool({ connectionString: resolved })

  return {
    async query(text, params) {
      const result = await pool.query(text, params as unknown[])
      return result.rows
    },
    async transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query("BEGIN")
        const value = await fn(clientSql(client))
        await client.query("COMMIT")
        return value
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      } finally {
        client.release()
      }
    },
    end: () => pool.end(),
  }
}
