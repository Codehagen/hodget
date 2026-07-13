import type { Currency } from "../data/types.js"
import type { ConstructionConfig } from "../portfolio/construct.js"
import type { RiskConfig } from "../risk/gates.js"
import type { PaperBrokerCosts } from "../paper/paper-broker.js"
import type { WalkForwardReport } from "../validation/walk-forward.js"
import {
  evaluatePromotion,
  evidenceFromWalkForward,
  type PromotionGateConfig,
  type PromotionResult,
} from "./gate.js"

/**
 * The promotion workflow (plan 002, phase 6) — a small state machine moving a
 * strategy from **backtest** to **paper** (live is deliberately blocked until
 * paper has run for months).
 *
 * The workflow is engine-pure: it gates a walk-forward result and, on a pass,
 * freezes the strategy configuration into a {@link PaperSession} descriptor that
 * `runCycle` can drive with the paper clock and broker. It performs **no
 * persistence** — the db layer wires the descriptor to storage later; this
 * module only decides and freezes.
 */

/** The frozen, declarative definition of a strategy being promoted. */
export interface StrategyConfig {
  readonly strategyId: string
  /** The securities the strategy trades. */
  readonly securityIds: readonly string[]
  /** Base currency for valuation, sizing, and metrics. */
  readonly baseCurrency: Currency
  readonly construction?: ConstructionConfig
  readonly risk?: RiskConfig
  readonly costs?: PaperBrokerCosts
  /** UTC time-of-day for the decision cutoff, after every exchange close. */
  readonly cutoffTime?: string
  /** Caveats carried from the backtest (e.g. the fixed-universe case-study label). */
  readonly caveats?: readonly string[]
}

/** The starting state a paper session resumes the book from. */
export interface PaperStartState {
  /** First session the paper run decides on (YYYY-MM-DD). */
  readonly startDate: string
  /** Initial cash per currency. */
  readonly initialCash: Partial<Record<Currency, number>>
}

/**
 * A promoted strategy ready to run in paper: the frozen strategy config, the gate
 * result that authorised it, and the start state. Consumable by `runCycle` with
 * the paper broker + clock; the analyst panel and committee (code, not config)
 * are supplied at run time.
 */
export interface PaperSession {
  readonly strategyId: string
  readonly config: StrategyConfig
  /** The gate decision that promoted this strategy. */
  readonly promotion: PromotionResult
  readonly start: PaperStartState
  /** Creation instant, from the injected time source (never the wall clock). */
  readonly createdAt: string
}

/** Where a strategy sits in the promotion state machine. */
export type PromotionStage = "backtest" | "paper" | "blocked"

export interface PromoteToPaperInput {
  readonly config: StrategyConfig
  /** The walk-forward evaluation the gate scores. */
  readonly report: WalkForwardReport
  readonly start: PaperStartState
  /** Injected time source for `createdAt`. */
  readonly now: () => string
  readonly gate?: PromotionGateConfig
}

export interface PromotionOutcome {
  /** `paper` on a gate pass (a session is produced); `blocked` otherwise. */
  readonly stage: PromotionStage
  readonly result: PromotionResult
  /** The frozen session descriptor, non-null iff `stage === "paper"`. */
  readonly session: PaperSession | null
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
 * Gate a strategy for promotion to **paper**. On a pass, freeze a
 * {@link PaperSession} descriptor; on a fail, return `blocked` with the gate's
 * reasons and no session. The strategy's own caveats are folded into the evidence
 * so a fixed-universe case study is scored honestly (it may still reach paper).
 */
export function promoteToPaper(input: PromoteToPaperInput): PromotionOutcome {
  const evidence = evidenceFromWalkForward(input.report, input.config.caveats ?? [])
  const result = evaluatePromotion({ target: "paper", evidence }, input.gate ?? {})
  if (!result.promoted) return { stage: "blocked", result, session: null }

  const session = deepFreeze<PaperSession>({
    strategyId: input.config.strategyId,
    config: input.config,
    promotion: result,
    start: input.start,
    createdAt: input.now(),
  })
  return { stage: "paper", result, session }
}

export interface PromoteToLiveInput {
  readonly config: StrategyConfig
  readonly report: WalkForwardReport
  readonly gate?: PromotionGateConfig
}

/**
 * Gate a strategy for promotion to **live**. Live has no execution shell in phase
 * 6 and a fixed-universe result is a hard block, so this always returns `blocked`
 * — but it still runs the gate so the recorded reasons explain *why* (typically
 * the universe-honesty block). It exists to make the "live is not available yet"
 * state explicit rather than implicit.
 */
export function promoteToLive(input: PromoteToLiveInput): PromotionOutcome {
  const evidence = evidenceFromWalkForward(input.report, input.config.caveats ?? [])
  const result = evaluatePromotion({ target: "live", evidence }, input.gate ?? {})
  return { stage: "blocked", result, session: null }
}
