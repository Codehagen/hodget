import type { Sql } from "../client.js"
import { decisionRowSchema, type EngineDecisionRow } from "../schema.js"

/** `engine_decisions` queries. `payload` holds the decision minus its fills. */

export interface InsertDecisionInput {
  /** App-generated id — known before insert so fills can reference it. */
  readonly id: string
  readonly runId: string
  readonly asOf: string
  /** { asOf, signals, views, targetWeights, orders, gateActions } */
  readonly payload: unknown
  readonly thesis: string | null
}

export async function insertDecision(sql: Sql, input: InsertDecisionInput): Promise<void> {
  await sql.query(
    `insert into engine_decisions (id, run_id, as_of, payload, thesis)
     values ($1, $2, $3::timestamptz, $4::jsonb, $5)`,
    [input.id, input.runId, input.asOf, JSON.stringify(input.payload), input.thesis],
  )
}

/** Every decision for a run, in cutoff order (ties broken by id for determinism). */
export async function listDecisionRowsByRun(
  sql: Sql,
  runId: string,
): Promise<EngineDecisionRow[]> {
  const rows = await sql.query(
    `select * from engine_decisions
     where run_id = $1
     order by as_of asc, id asc`,
    [runId],
  )
  return rows.map((row) => decisionRowSchema.parse(row))
}
