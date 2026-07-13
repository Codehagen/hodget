import type { Sql } from "../client.js"
import { resultRowSchema, type EngineResult } from "../schema.js"

/** `engine_results` queries — one result row per completed run. */

export interface InsertResultInput {
  readonly runId: string
  readonly equityCurve: unknown
  readonly metrics: unknown
  readonly diagnostics: unknown
  readonly caveats: unknown
}

export async function insertResult(sql: Sql, input: InsertResultInput): Promise<void> {
  await sql.query(
    `insert into engine_results (run_id, equity_curve, metrics, diagnostics, caveats)
     values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)`,
    [
      input.runId,
      JSON.stringify(input.equityCurve),
      JSON.stringify(input.metrics),
      JSON.stringify(input.diagnostics),
      JSON.stringify(input.caveats),
    ],
  )
}

export async function getResultByRun(sql: Sql, runId: string): Promise<EngineResult | null> {
  const rows = await sql.query(`select * from engine_results where run_id = $1`, [runId])
  return rows[0] ? resultRowSchema.parse(rows[0]) : null
}
