import "server-only"

import {
  getPersistedDecisions,
  getResultByRun,
  getRunById,
  insertRun,
  listRunsByOwner,
  type EngineResult,
  type EngineRun,
  type PersistedDecision,
  type RunConfig,
} from "@workspace/db"

import { requireSession } from "@/lib/session"

import { getDb } from "./db"
import { launchRun } from "./run-registry"

/**
 * Runs DAL — every export validates the session first (requireSession) and scopes
 * to the session user. Ownership is per-user; the team seam lives in the schema
 * (see migrations) and would be applied here as a membership check.
 */

/** Create a backtest run for the current user and launch it in the background. */
export async function createRun(config: RunConfig): Promise<EngineRun> {
  const session = await requireSession()
  const run = await insertRun(getDb(), {
    ownerUserId: session.user.id,
    mode: "backtest",
    config,
  })
  launchRun(run)
  return run
}

export async function listRuns(): Promise<EngineRun[]> {
  const session = await requireSession()
  return listRunsByOwner(getDb(), session.user.id)
}

export interface RunDetail {
  readonly run: EngineRun
  readonly result: EngineResult | null
  readonly decisions: PersistedDecision[]
}

/** A run's status + result + decision log, or null if it isn't the user's run. */
export async function getRunDetail(id: string): Promise<RunDetail | null> {
  const run = await getOwnedRun(id)
  if (!run) return null
  const [result, decisions] = await Promise.all([
    getResultByRun(getDb(), id),
    getPersistedDecisions(getDb(), id),
  ])
  return { run, result, decisions }
}

/** The run if it belongs to the current user, else null (→ 404 at the edge). */
export async function getOwnedRun(id: string): Promise<EngineRun | null> {
  const session = await requireSession()
  const run = await getRunById(getDb(), id)
  return run && run.ownerUserId === session.user.id ? run : null
}
