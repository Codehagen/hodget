import {
  getPersistedDecisions,
  getResultByRun,
  getRunById,
  insertRun,
  type RunStatus,
} from "@workspace/db"
import { createTestDb, type TestDb } from "@workspace/db/testing"

import { __setTestDb } from "./db"

/**
 * Test support for the durable run step's integration test (plan 004, phase 4).
 *
 * Lives in lib/dal because it reaches `@workspace/db` (the import boundary) — the
 * test imports only from here, so the boundary and the "no @workspace/db in tests"
 * rule both hold. It owns a PGlite database and wires it into `getDb()` (via the
 * seam in `db.ts`) so `runExecuteStep` — the real step body — reads and writes it.
 */
let db: TestDb | undefined

/** Spin up a PGlite database and route `getDb()` at it. */
export async function setupWorkflowTestDb(): Promise<void> {
  db = await createTestDb()
  __setTestDb(db)
}

/** Tear down the PGlite database and clear the `getDb()` override. */
export async function teardownWorkflowTestDb(): Promise<void> {
  __setTestDb(undefined)
  await db?.close()
  db = undefined
}

function requireDb(): TestDb {
  if (!db) throw new Error("run-workflow-test-support: call setupWorkflowTestDb() first")
  return db
}

/** Insert a queued backtest run and return its id. */
export async function insertBacktestRun(config: unknown): Promise<string> {
  const run = await insertRun(requireDb(), { ownerUserId: "u", mode: "backtest", config })
  return run.id
}

export interface RunOutcome {
  readonly status: RunStatus | null
  readonly error: string | null
  readonly hasResult: boolean
  readonly decisionCount: number
}

/** The persisted outcome of a run — status, error, result presence, decision count. */
export async function getRunOutcome(runId: string): Promise<RunOutcome> {
  const sql = requireDb()
  const [run, result, decisions] = await Promise.all([
    getRunById(sql, runId),
    getResultByRun(sql, runId),
    getPersistedDecisions(sql, runId),
  ])
  return {
    status: run?.status ?? null,
    error: run?.error ?? null,
    hasResult: result !== null,
    decisionCount: decisions.length,
  }
}
