import { FIXED_UNIVERSE_CAVEAT } from "../backtest/engine.js"
import type { WalkForwardReport } from "../validation/walk-forward.js"

/**
 * The promotion gate (plan 002, phase 6).
 *
 * Validation is a **gate, not a report**: a backtest number with no out-of-sample
 * evidence is a credibility liability. This gate turns a walk-forward result into
 * a deterministic promote/reject decision against documented thresholds, and
 * records **every** check — pass or fail — in `reasons`, so a rejection is always
 * explainable and a promotion always auditable.
 *
 * The gate reads a compact {@link PromotionEvidence} summary rather than the full
 * {@link WalkForwardReport}, which keeps it decoupled from backtest internals and
 * trivially testable; {@link evidenceFromWalkForward} is the bridge from the
 * validation harness.
 */

/** Where a strategy is being promoted to. */
export type PromotionTarget = "paper" | "live"

/** The out-of-sample evidence the gate scores, distilled from a walk-forward run. */
export interface PromotionEvidence {
  /** Aggregate out-of-sample Sharpe (mean across the OOS windows). */
  readonly aggregateSharpe: number
  /** The single worst drawdown across the OOS windows, as a positive fraction. */
  readonly worstDrawdown: number
  /** Total settled trades across the OOS windows. */
  readonly tradeCount: number
  /** Number of out-of-sample windows evaluated. */
  readonly windowCount: number
  /** Out-of-sample windows that ended profitable (total return > 0). */
  readonly profitableWindows: number
  /** Caveats carried from the backtest (e.g. the fixed-universe case-study label). */
  readonly caveats: readonly string[]
}

export interface PromotionCandidate {
  readonly target: PromotionTarget
  readonly evidence: PromotionEvidence
}

/** One gate check, recorded whether it passed or failed. */
export interface PromotionReason {
  /** Stable machine code for the check (e.g. "aggregate-sharpe"). */
  readonly code: string
  readonly ok: boolean
  /** Human-readable explanation, including the observed value vs. the threshold. */
  readonly detail: string
}

export interface PromotionResult {
  readonly promoted: boolean
  readonly target: PromotionTarget
  /** Every check evaluated, in a stable order. `promoted` iff all `ok`. */
  readonly reasons: PromotionReason[]
}

/**
 * Promotion thresholds (plan 002, phase 6). Defaults are deliberately modest —
 * a first bar, not a literature-grade filter — and every field is documented.
 */
export interface PromotionGateConfig {
  /** Minimum aggregate out-of-sample Sharpe. Default 0.5. */
  readonly minAggregateSharpe?: number
  /** Maximum tolerated out-of-sample drawdown, as a positive fraction. Default 0.25. */
  readonly maxDrawdown?: number
  /** Minimum settled trade count across OOS windows (enough for the number to mean something). Default 20. */
  readonly minTradeCount?: number
  /** Minimum fraction of OOS windows that must be profitable. Default 0.5. */
  readonly minProfitableWindowFraction?: number
}

type ResolvedGateConfig = Required<PromotionGateConfig>

function resolveConfig(config: PromotionGateConfig): ResolvedGateConfig {
  return {
    minAggregateSharpe: config.minAggregateSharpe ?? 0.5,
    maxDrawdown: config.maxDrawdown ?? 0.25,
    minTradeCount: config.minTradeCount ?? 20,
    minProfitableWindowFraction: config.minProfitableWindowFraction ?? 0.5,
  }
}

/** Distil a {@link WalkForwardReport} into the evidence the gate scores. */
export function evidenceFromWalkForward(
  report: WalkForwardReport,
  extraCaveats: readonly string[] = [],
): PromotionEvidence {
  const caveats = new Set<string>(extraCaveats)
  for (const outcome of report.test) for (const c of outcome.result.caveats) caveats.add(c)

  return {
    aggregateSharpe: report.aggregate.meanSharpe,
    worstDrawdown: report.aggregate.worstDrawdown,
    tradeCount: report.test.reduce((sum, o) => sum + o.result.trades.length, 0),
    windowCount: report.test.length,
    profitableWindows: report.test.filter((o) => o.metrics.totalReturn > 0).length,
    caveats: [...caveats],
  }
}

/**
 * Evaluate a promotion candidate against the gate. Deterministic: the same
 * evidence and config always yield the same result. `reasons` lists every check
 * (pass and fail) so the decision is fully auditable; `promoted` is true iff
 * every check passed.
 *
 * The universe-honesty check is the one that depends on `target`: a result
 * labelled a fixed-universe case study may still promote to **paper** (the gate
 * records that live promotion would require universe-honest data), but is a hard
 * block on **live** — case-study numbers must never move real money as if they
 * were survivorship-adjusted.
 */
export function evaluatePromotion(
  candidate: PromotionCandidate,
  config: PromotionGateConfig = {},
): PromotionResult {
  const { target, evidence } = candidate
  const cfg = resolveConfig(config)
  const reasons: PromotionReason[] = []

  const hasOutOfSample = evidence.windowCount >= 1
  reasons.push({
    code: "oos-evidence",
    ok: hasOutOfSample,
    detail: hasOutOfSample
      ? `${evidence.windowCount} out-of-sample window(s) evaluated`
      : "no out-of-sample windows — nothing to promote on",
  })

  const sharpeOk = evidence.aggregateSharpe >= cfg.minAggregateSharpe
  reasons.push({
    code: "aggregate-sharpe",
    ok: sharpeOk,
    detail: `aggregate OOS Sharpe ${format(evidence.aggregateSharpe)} vs. min ${format(cfg.minAggregateSharpe)}`,
  })

  const drawdownOk = evidence.worstDrawdown <= cfg.maxDrawdown
  reasons.push({
    code: "max-drawdown",
    ok: drawdownOk,
    detail: `worst OOS drawdown ${format(evidence.worstDrawdown)} vs. ceiling ${format(cfg.maxDrawdown)}`,
  })

  const tradesOk = evidence.tradeCount >= cfg.minTradeCount
  reasons.push({
    code: "trade-count",
    ok: tradesOk,
    detail: `${evidence.tradeCount} OOS trade(s) vs. min ${cfg.minTradeCount}`,
  })

  const profitableFraction = hasOutOfSample ? evidence.profitableWindows / evidence.windowCount : 0
  const profitableOk = hasOutOfSample && profitableFraction >= cfg.minProfitableWindowFraction
  reasons.push({
    code: "profitable-windows",
    ok: profitableOk,
    detail: `${evidence.profitableWindows}/${evidence.windowCount} OOS window(s) profitable (${format(
      profitableFraction,
    )}) vs. min ${format(cfg.minProfitableWindowFraction)}`,
  })

  const isFixedUniverse = evidence.caveats.includes(FIXED_UNIVERSE_CAVEAT)
  reasons.push(universeHonesty(target, isFixedUniverse))

  return { promoted: reasons.every((r) => r.ok), target, reasons }
}

function universeHonesty(target: PromotionTarget, isFixedUniverse: boolean): PromotionReason {
  if (!isFixedUniverse) {
    return {
      code: "universe-honesty",
      ok: true,
      detail: "result is not flagged fixed-universe",
    }
  }
  if (target === "live") {
    return {
      code: "universe-honesty",
      ok: false,
      detail:
        "live promotion requires universe-honest data; result is a fixed-universe case study (hard block on live)",
    }
  }
  return {
    code: "universe-honesty",
    ok: true,
    detail:
      "fixed-universe case study may run in paper; live promotion will require universe-honest data",
  }
}

function format(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : String(value)
}
