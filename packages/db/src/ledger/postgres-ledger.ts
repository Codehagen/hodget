import { randomUUID } from "node:crypto"

import type { DecisionRecord, Fill, Ledger } from "@workspace/engine"

import type { Sql } from "../client.js"
import { insertDecision } from "../queries/decisions.js"
import { insertFill } from "../queries/fills.js"

/**
 * A {@link Ledger} whose decisions land in Postgres (plan 002 phase 5a).
 *
 * The engine's `Ledger` interface is synchronous — `runCycle`/the backtest call
 * `record` and `attachFills` inside the loop and cannot await — but Postgres
 * writes are async. The phase-4 handoff note resolves this: the ledger buffers
 * each decision synchronously in memory (exactly the append-log the in-memory
 * ledger keeps, so behaviour is identical), assigning a **stable decision id** on
 * `record`, and a single async {@link PostgresLedger.persist} flushes the whole
 * run to the database at the end. Fills are keyed to their decision by that id —
 * not by `asOf` — so the persisted trail links each settled fill to the exact
 * decision that intended it. Buffer-then-flush matches backtest batch semantics;
 * a write-through live ledger is a later concern (phase 6).
 */

interface Entry {
  readonly id: string
  record: DecisionRecord
}

/** Recursively freeze a value and everything it transitively holds. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/**
 * A one-line, human-readable thesis for the decision: the distinct, non-empty
 * theses of the analysts that contributed an actionable view, joined. The raw
 * per-signal theses remain in the decision payload — this is the summary column
 * the decision log renders. Null when no analyst offered a thesis.
 */
export function summarizeThesis(decision: DecisionRecord): string | null {
  const seen = new Set<string>()
  for (const signal of decision.signals) {
    if (signal.abstained) continue
    const thesis = signal.thesis?.trim()
    if (thesis) seen.add(thesis)
  }
  return seen.size > 0 ? [...seen].join(" · ") : null
}

export class PostgresLedger implements Ledger {
  private readonly entries: Entry[] = []

  constructor(private readonly newId: () => string = randomUUID) {}

  record(decision: DecisionRecord): void {
    // Deep-copy then deep-freeze: the buffer owns an isolated, immutable snapshot,
    // identical to the in-memory ledger's contract.
    this.entries.push({ id: this.newId(), record: deepFreeze(structuredClone(decision)) })
  }

  attachFills(asOf: string, fills: readonly Fill[]): void {
    // Match the in-memory ledger: backfill onto the FIRST decision recorded at asOf.
    const index = this.entries.findIndex((e) => e.record.asOf === asOf)
    if (index < 0) {
      throw new Error(`PostgresLedger.attachFills: no decision recorded at asOf ${asOf}`)
    }
    const entry = this.entries[index] as Entry
    entry.record = deepFreeze(
      structuredClone({ ...entry.record, fills: [...entry.record.fills, ...fills] }),
    )
  }

  decisions(): readonly DecisionRecord[] {
    return this.entries.map((e) => e.record)
  }

  /**
   * Flush every buffered decision and its fills to the database under `runId`.
   * Call inside a transaction so a run's audit trail lands atomically. The
   * decision payload is everything but the fills (those are their own rows, keyed
   * by decision id); the thesis column carries {@link summarizeThesis}.
   */
  async persist(sql: Sql, runId: string): Promise<void> {
    let seq = 0
    for (const { id, record } of this.entries) {
      const { fills, ...payload } = record
      await insertDecision(sql, {
        id,
        runId,
        asOf: record.asOf,
        payload,
        thesis: summarizeThesis(record),
      })
      for (const fill of fills) {
        // Run-wide monotonic seq preserves settle order across decisions on read.
        await insertFill(sql, { runId, decisionId: id, seq: seq++, fill })
      }
    }
  }
}
