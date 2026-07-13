import type { GateAction } from "../risk/gates.js"
import type { Fill, Order, Signal, TargetView, TargetWeight } from "../types.js"

/**
 * The decision ledger (plan 002 phase 4 — minimal in-memory form).
 *
 * "Every position keeps its thesis": for every decision cycle the ledger stores
 * what each analyst said (signals), how the committee blended it (views), the
 * constructed weights, the risk-gate actions that clipped or vetoed orders, the
 * orders that survived, and the fills they produced. Auditability is the product
 * in an open-source fund, so this is a first-class output of the kernel, not a
 * side effect.
 *
 * This is the append-only shape the phase-5 database implements behind the same
 * interface; the in-memory impl here is enough for backtests and tests. The
 * ledger deep-copies and deep-freezes what it records (it never points into a
 * mutable cache), so nothing it has recorded can be altered after the fact —
 * mutating a source object a caller retained cannot reach into the log.
 *
 * Fills settle a session after the decision that intended them, so they arrive
 * later than the rest of the record. The executing live path settles
 * synchronously and records a decision with its fills in one shot; the backtest
 * settles next-session and backfills via {@link Ledger.attachFills}. Either way
 * the fills end up attached to their originating decision.
 */
export interface DecisionRecord {
  /** The decision cutoff the cycle was formed at. */
  readonly asOf: string
  /** Every analyst signal considered, including abstentions. */
  readonly signals: readonly Signal[]
  /** The committee's blended views. */
  readonly views: readonly TargetView[]
  /** Constructed target weights (pre-sizing intent). */
  readonly targetWeights: readonly TargetWeight[]
  /** Orders that survived risk gating (the intents actually submitted). */
  readonly orders: readonly Order[]
  /** What the risk gates clipped or vetoed. */
  readonly gateActions: readonly GateAction[]
  /** Fills produced by executing the orders (empty until settlement). */
  readonly fills: readonly Fill[]
}

export interface Ledger {
  /** Append one decision record. Implementations must copy, never alias. */
  record(decision: DecisionRecord): void
  /**
   * Backfill the fills a recorded decision produced once they settle.
   *
   * The settlement step of an append-only ledger: fills accrue as the decision's
   * orders execute (a single decision may settle across several sessions, so
   * implementations append rather than replace), keyed to the decision by its
   * `asOf`. The live path never needs this — it settles synchronously and passes
   * fills straight to {@link Ledger.record}. Throws if no decision was recorded
   * at `asOf`.
   */
  attachFills(asOf: string, fills: readonly Fill[]): void
  /** Every recorded decision, in insertion order. */
  decisions(): readonly DecisionRecord[]
}

/** Recursively freeze a value and everything it transitively holds. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/** An in-memory {@link Ledger}: a plain append log with no external state. */
export class InMemoryLedger implements Ledger {
  private readonly log: DecisionRecord[] = []

  record(decision: DecisionRecord): void {
    // Deep-copy then deep-freeze: the log owns an isolated, immutable snapshot,
    // so neither a caller mutating its retained inputs nor a later reader can
    // alter what was recorded.
    this.log.push(deepFreeze(structuredClone(decision)))
  }

  attachFills(asOf: string, fills: readonly Fill[]): void {
    const index = this.log.findIndex((d) => d.asOf === asOf)
    if (index < 0) {
      throw new Error(`ledger.attachFills: no decision recorded at asOf ${asOf}`)
    }
    const existing = this.log[index] as DecisionRecord
    // Copy-on-write: append the newly settled fills to a fresh, re-frozen record.
    this.log[index] = deepFreeze(
      structuredClone({ ...existing, fills: [...existing.fills, ...fills] }),
    )
  }

  decisions(): readonly DecisionRecord[] {
    return this.log
  }
}
