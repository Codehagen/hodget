import { createPgSql } from "../src/client.js"
import { applyMigrations, readMigrations } from "../src/migrate.js"

/**
 * Apply the engine migrations in `migrations/` to the database behind
 * DATABASE_URL. Every migration is idempotent, so re-running is safe.
 *
 *   pnpm --filter @workspace/db migrate
 */
async function main() {
  const sql = createPgSql()
  try {
    const migrations = await readMigrations()
    await applyMigrations(sql)
    for (const migration of migrations) {
      console.log(`applied ${migration.name}`)
    }
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
