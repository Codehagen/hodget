import { promises as fs } from "node:fs"
import { fileURLToPath } from "node:url"

import type { Sql } from "./client.js"

/**
 * SQL migrations, applied in filename order. Migrations are plain `.sql` files in
 * `migrations/` (append-only, one per change), so the same statements run against
 * pglite in tests and real Postgres in production — no ORM migration engine.
 *
 * Every migration is idempotent (`create table if not exists`, `create index if
 * not exists`), so applying the set twice is safe. This is deliberately a thin
 * runner, not a version-tracked migration framework; a tracked runner lands with
 * `packages/jobs` when scheduled maintenance needs it.
 */

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url)

/** Read every migration file in apply order. */
export async function readMigrations(): Promise<{ name: string; sql: string }[]> {
  const dir = fileURLToPath(MIGRATIONS_DIR)
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort()
  return Promise.all(
    files.map(async (name) => ({
      name,
      sql: await fs.readFile(fileURLToPath(new URL(name, MIGRATIONS_DIR)), "utf8"),
    })),
  )
}

/**
 * Split a migration file into individual statements.
 *
 * Statements are run one at a time (extended-protocol `query`) rather than as one
 * multi-statement string, because pglite's `query` — like Postgres's extended
 * protocol — accepts a single statement. Line comments are stripped, then the file
 * is split on `;`. This suffices for the plain DDL in `migrations/` (no
 * dollar-quoted function bodies, no `;` inside string literals); a migration that
 * needs those would call for a real migration runner.
 */
export function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

/** Apply every migration to `sql`, each in its own transaction, in order. */
export async function applyMigrations(sql: Sql): Promise<void> {
  for (const migration of await readMigrations()) {
    const statements = splitStatements(migration.sql)
    await sql.transaction(async (tx) => {
      for (const statement of statements) await tx.query(statement)
    })
  }
}
