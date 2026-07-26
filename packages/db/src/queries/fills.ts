import { randomUUID } from "node:crypto"

import type { Sql } from "../client.js"
import { fillRowSchema, type EngineFillRow } from "../schema.js"

/** `engine_fills` queries. Each fill is keyed to the decision that intended it. */

export interface InsertFillInput {
  readonly runId: string
  readonly decisionId: string
  /** Monotonic insertion order within the run — preserves settle order on read. */
  readonly seq: number
  readonly fill: unknown
  readonly id?: string
}

export async function insertFill(sql: Sql, input: InsertFillInput): Promise<void> {
  await sql.query(
    `insert into engine_fills (id, run_id, decision_id, seq, fill)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [input.id ?? randomUUID(), input.runId, input.decisionId, input.seq, JSON.stringify(input.fill)],
  )
}

/** Every fill for a run, in settle order. */
export async function listFillRowsByRun(sql: Sql, runId: string): Promise<EngineFillRow[]> {
  const rows = await sql.query(
    `select * from engine_fills where run_id = $1 order by seq asc`,
    [runId],
  )
  return rows.map((row) => fillRowSchema.parse(row))
}
