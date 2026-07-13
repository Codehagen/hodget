import "server-only"

import {
  createRunAnalystSource,
  createStreamRunEmitter,
  executeRun,
  getRunById,
  type RunEvent,
} from "@workspace/db"

import { getDb } from "./db"

/**
 * The database-facing halves of the durable run workflow (plan 004).
 *
 * The workflow/step directive file (`app-relative workflows/execute-run.ts`) is
 * intentionally thin: it owns the `"use workflow"` / `"use step"` boundaries and
 * the Workflow-runtime `getWritable()` call, then delegates here. This module is
 * the ONLY workflow-adjacent code allowed to reach `@workspace/db` (the DAL import
 * boundary), and it imports no workflow APIs itself — the writable stream is passed
 * in, so `@workspace/db` and this helper stay runtime-agnostic and unit-testable.
 *
 * Auth model: the generated `/.well-known/workflow/v1/**` routes invoke these step
 * bodies WITHOUT an app-level session check — trust rests on platform gating of the
 * workflow endpoints. Ownership still holds regardless, because a runId only ever
 * enters a workflow via `createRun` (behind `requireSession`), and every read of a
 * run's data stays behind `getOwnedRun`; these steps only ever act on a runId that a
 * session-authorized caller already created. Deployment must verify that
 * `/.well-known/workflow/**` is not externally invocable.
 */

// Re-export so the directive file types its `getWritable<RunEvent>()` without
// importing @workspace/db (which the DAL import rule forbids outside lib/dal).
export type { RunEvent }

/**
 * The `loadRun` step: assert the run exists and is still queued before execution.
 * A queued run is the only valid entry state; anything else is a caller/ordering
 * bug and fails loud (the step surfaces it to the workflow).
 */
export async function assertRunQueued(runId: string): Promise<void> {
  const run = await getRunById(getDb(), runId)
  if (!run) throw new Error(`run ${runId} not found`)
  if (run.status !== "queued") {
    throw new Error(`run ${runId} is "${run.status}", expected "queued"`)
  }
}

/**
 * The `executeRun` step: run the deterministic backtest and stream its progress
 * onto the workflow run's durable writable. Reloads the run by id (only the id
 * crosses the workflow/step boundary), constructs a per-run `Sql`, stream-backed
 * emitter, and analyst source inside the step, and always closes the stream so the
 * step's request can terminate. Retry-safe: `executeRun`'s persist is idempotent.
 */
export async function runExecuteStep(
  runId: string,
  writable: WritableStream<RunEvent>,
): Promise<void> {
  const sql = getDb()
  const run = await getRunById(sql, runId)
  if (!run) throw new Error(`run ${runId} not found`)

  const emitter = createStreamRunEmitter(runId, writable)
  try {
    // Per-run analyst source (quant registry + LLM personas built per run). Quant
    // panels never construct a model client; llm.value panels get a per-run one.
    await executeRun({ sql, run, emitter, analystSource: createRunAnalystSource() })
  } finally {
    await emitter.close()
  }
}
