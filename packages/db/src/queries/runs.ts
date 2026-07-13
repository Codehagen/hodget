import { randomUUID } from "node:crypto"

import type { Sql } from "../client.js"
import { runRowSchema, type EngineRun, type RunMode, type RunStatus } from "../schema.js"

/**
 * `engine_runs` queries. Every jsonb value is bound as text and cast with
 * `::jsonb`, and every timestamp as text cast with `::timestamptz`, so the exact
 * same statements run on `pg` and pglite without depending on either driver's
 * object serialization.
 */

export interface InsertRunInput {
  readonly ownerUserId: string
  readonly mode: RunMode
  readonly config: unknown
  /** Defaults to a fresh uuid (generated in-app, not by the database). */
  readonly id?: string
  /** Defaults to "queued". */
  readonly status?: RunStatus
}

export async function insertRun(sql: Sql, input: InsertRunInput): Promise<EngineRun> {
  const id = input.id ?? randomUUID()
  const rows = await sql.query(
    `insert into engine_runs (id, owner_user_id, mode, status, config)
     values ($1, $2, $3, $4, $5::jsonb)
     returning *`,
    [id, input.ownerUserId, input.mode, input.status ?? "queued", JSON.stringify(input.config)],
  )
  return runRowSchema.parse(rows[0])
}

export interface SetRunStatusInput {
  readonly status: RunStatus
  /** Error message when failing; null otherwise. */
  readonly error?: string | null
  /** ISO completion timestamp for terminal states; null while in flight. */
  readonly completedAt?: string | null
}

/** Transition a run's status (and, for terminal states, its error/completed_at). */
export async function setRunStatus(
  sql: Sql,
  runId: string,
  input: SetRunStatusInput,
): Promise<void> {
  await sql.query(
    `update engine_runs
       set status = $2, error = $3, completed_at = $4::timestamptz
     where id = $1`,
    [runId, input.status, input.error ?? null, input.completedAt ?? null],
  )
}

/** Record the durable workflow run id that owns this run's execution (plan 004). */
export async function setRunWorkflowId(
  sql: Sql,
  runId: string,
  workflowRunId: string,
): Promise<void> {
  await sql.query(`update engine_runs set workflow_run_id = $2 where id = $1`, [
    runId,
    workflowRunId,
  ])
}

/**
 * Delete a run's persisted artifacts (decisions, fills, result) so a re-executed
 * run replaces them instead of double-inserting. Idempotent by run id — the key
 * to a Workflow step retry being safe (plan 004). Fills cascade from decisions,
 * but we delete them explicitly (order-independent) rather than lean on the FK.
 * Call inside the same transaction as the re-insert.
 */
export async function clearRunArtifacts(sql: Sql, runId: string): Promise<void> {
  await sql.query(`delete from engine_fills where run_id = $1`, [runId])
  await sql.query(`delete from engine_decisions where run_id = $1`, [runId])
  await sql.query(`delete from engine_results where run_id = $1`, [runId])
}

export async function getRunById(sql: Sql, id: string): Promise<EngineRun | null> {
  const rows = await sql.query(`select * from engine_runs where id = $1`, [id])
  return rows[0] ? runRowSchema.parse(rows[0]) : null
}

/** Runs owned by a user, newest first. */
export async function listRunsByOwner(
  sql: Sql,
  ownerUserId: string,
  options: { readonly limit?: number } = {},
): Promise<EngineRun[]> {
  const rows = await sql.query(
    `select * from engine_runs
     where owner_user_id = $1
     order by created_at desc
     limit $2`,
    [ownerUserId, options.limit ?? 50],
  )
  return rows.map((row) => runRowSchema.parse(row))
}
