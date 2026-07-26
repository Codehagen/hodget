import type { DecisionRecord, Fill } from "@workspace/engine"

import type { Sql } from "../client.js"
import type { PersistedDecision } from "../schema.js"
import { listDecisionRowsByRun } from "./decisions.js"
import { listFillRowsByRun } from "./fills.js"

/** The decision payload as stored: a {@link DecisionRecord} without its fills. */
type DecisionPayload = Omit<DecisionRecord, "fills">

/**
 * Reconstruct a run's full decision log from the database — the inverse of what
 * {@link PostgresLedger.persist} wrote. Each decision's payload is rehydrated and
 * its settled fills (persisted separately, keyed by decision id) are re-attached,
 * so a completed run's decisions + theses + fills come back byte-for-byte
 * reconstructable. This is the query the run view and the audit trail read.
 */
export async function getPersistedDecisions(
  sql: Sql,
  runId: string,
): Promise<PersistedDecision[]> {
  const [decisionRows, fillRows] = await Promise.all([
    listDecisionRowsByRun(sql, runId),
    listFillRowsByRun(sql, runId),
  ])

  const fillsByDecision = new Map<string, Fill[]>()
  for (const row of fillRows) {
    const list = fillsByDecision.get(row.decisionId) ?? []
    list.push(row.fill as Fill)
    fillsByDecision.set(row.decisionId, list)
  }

  return decisionRows.map((row) => {
    const payload = row.payload as DecisionPayload
    return {
      ...payload,
      fills: fillsByDecision.get(row.id) ?? [],
      decisionId: row.id,
      thesis: row.thesis,
    }
  })
}
