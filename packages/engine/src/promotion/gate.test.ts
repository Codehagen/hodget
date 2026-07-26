import { describe, expect, it } from "vitest"

import { FIXED_UNIVERSE_CAVEAT, type BacktestResult } from "../backtest/engine.js"
import type { BacktestMetrics } from "../backtest/metrics.js"
import type { Fill, TargetView } from "../types.js"
import type { WalkForwardReport, WindowOutcome } from "../validation/walk-forward.js"
import {
  evaluatePromotion,
  evidenceFromWalkForward,
  type PromotionCandidate,
  type PromotionEvidence,
  type PromotionReason,
} from "./gate.js"

/** A compliant paper candidate — every threshold passes. */
function passingEvidence(overrides: Partial<PromotionEvidence> = {}): PromotionEvidence {
  return {
    aggregateSharpe: 1.0,
    worstDrawdown: 0.1,
    tradeCount: 40,
    windowCount: 4,
    profitableWindows: 3,
    caveats: [FIXED_UNIVERSE_CAVEAT],
    ...overrides,
  }
}

function reason(result: { reasons: PromotionReason[] }, code: string): PromotionReason {
  const found = result.reasons.find((r) => r.code === code)
  if (!found) throw new Error(`no reason with code ${code}`)
  return found
}

function paper(evidence: PromotionEvidence): PromotionCandidate {
  return { target: "paper", evidence }
}

describe("evaluatePromotion — thresholds", () => {
  it("promotes a compliant candidate and records every check as passing", () => {
    const result = evaluatePromotion(paper(passingEvidence()))
    expect(result.promoted).toBe(true)
    expect(result.reasons.map((r) => r.code)).toEqual([
      "oos-evidence",
      "aggregate-sharpe",
      "max-drawdown",
      "trade-count",
      "profitable-windows",
      "universe-honesty",
    ])
    expect(result.reasons.every((r) => r.ok)).toBe(true)
  })

  it("rejects on aggregate Sharpe below the minimum", () => {
    const result = evaluatePromotion(paper(passingEvidence({ aggregateSharpe: 0.1 })), { minAggregateSharpe: 0.5 })
    expect(result.promoted).toBe(false)
    expect(reason(result, "aggregate-sharpe").ok).toBe(false)
  })

  it("rejects on drawdown above the ceiling", () => {
    const result = evaluatePromotion(paper(passingEvidence({ worstDrawdown: 0.5 })), { maxDrawdown: 0.25 })
    expect(result.promoted).toBe(false)
    expect(reason(result, "max-drawdown").ok).toBe(false)
  })

  it("rejects on too few out-of-sample trades", () => {
    const result = evaluatePromotion(paper(passingEvidence({ tradeCount: 5 })), { minTradeCount: 20 })
    expect(result.promoted).toBe(false)
    expect(reason(result, "trade-count").ok).toBe(false)
  })

  it("rejects on too few profitable out-of-sample windows", () => {
    const result = evaluatePromotion(
      paper(passingEvidence({ windowCount: 4, profitableWindows: 1 })),
      { minProfitableWindowFraction: 0.5 },
    )
    expect(result.promoted).toBe(false)
    expect(reason(result, "profitable-windows").ok).toBe(false)
  })

  it("rejects when there is no out-of-sample evidence at all", () => {
    const result = evaluatePromotion(paper(passingEvidence({ windowCount: 0, profitableWindows: 0 })))
    expect(result.promoted).toBe(false)
    expect(reason(result, "oos-evidence").ok).toBe(false)
  })
})

describe("evaluatePromotion — universe honesty", () => {
  it("blocks a fixed-universe case study from promoting to live", () => {
    const result = evaluatePromotion({ target: "live", evidence: passingEvidence() })
    expect(result.promoted).toBe(false)
    const r = reason(result, "universe-honesty")
    expect(r.ok).toBe(false)
    expect(r.detail).toContain("universe-honest data")
  })

  it("lets a fixed-universe case study promote to paper (with a noted caveat)", () => {
    const result = evaluatePromotion(paper(passingEvidence()))
    expect(result.promoted).toBe(true)
    expect(reason(result, "universe-honesty").ok).toBe(true)
    expect(reason(result, "universe-honesty").detail).toContain("paper")
  })

  it("allows live for a universe-honest result that clears every threshold", () => {
    const result = evaluatePromotion({ target: "live", evidence: passingEvidence({ caveats: [] }) })
    expect(reason(result, "universe-honesty").ok).toBe(true)
    expect(result.promoted).toBe(true)
  })
})

// --- WalkForwardReport bridge -------------------------------------------------

function stubMetrics(overrides: Partial<BacktestMetrics>): BacktestMetrics {
  return {
    totalReturn: 0,
    annualizedReturn: 0,
    sharpe: 0,
    sortino: 0,
    maxDrawdown: 0,
    winRate: 0,
    turnover: 0,
    costDrag: 0,
    tradingDays: 0,
    ...overrides,
  }
}

function stubFill(): Fill {
  return {
    securityId: "A",
    side: "buy",
    quantity: 1,
    price: 100,
    currency: "USD",
    filledAt: "2020-01-01T21:00:00Z",
    commission: 0,
  }
}

function stubView(): TargetView {
  return { securityId: "A", asOf: "2020-01-01T23:00:00Z", conviction: 0.5, horizonDays: 20, contributingAnalystIds: ["x"] }
}

function stubResult(tradeCount: number, caveats: string[]): BacktestResult {
  return {
    baseCurrency: "USD",
    equityCurve: [],
    metrics: stubMetrics({}),
    diagnostics: {
      tradeStats: { wins: 0, losses: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, avgHoldingDays: 0 },
      attribution: [],
    },
    trades: Array.from({ length: tradeCount }, () => ({ fill: stubFill(), view: stubView() })),
    corporateActions: [],
    caveats,
  }
}

function testWindow(totalReturn: number, tradeCount: number, caveats: string[]): WindowOutcome {
  return {
    window: { label: "test", kind: "test", range: { from: "2020-01-01", to: "2020-06-30" } },
    metrics: stubMetrics({ totalReturn }),
    result: stubResult(tradeCount, caveats),
  }
}

describe("evidenceFromWalkForward", () => {
  it("distils aggregate stats, OOS trade count, profitable windows, and caveats", () => {
    const test: WindowOutcome[] = [
      testWindow(0.1, 12, [FIXED_UNIVERSE_CAVEAT]),
      testWindow(-0.05, 8, [FIXED_UNIVERSE_CAVEAT]),
    ]
    const report: WalkForwardReport = {
      train: null,
      test,
      windows: test,
      aggregate: { windows: 2, meanTotalReturn: 0.025, meanSharpe: 0.8, meanWinRate: 0.5, worstDrawdown: 0.2 },
    }

    const evidence = evidenceFromWalkForward(report)
    expect(evidence.aggregateSharpe).toBeCloseTo(0.8, 12)
    expect(evidence.worstDrawdown).toBeCloseTo(0.2, 12)
    expect(evidence.tradeCount).toBe(20)
    expect(evidence.windowCount).toBe(2)
    expect(evidence.profitableWindows).toBe(1)
    expect(evidence.caveats).toContain(FIXED_UNIVERSE_CAVEAT)
  })

  it("folds in extra caveats supplied by the strategy config", () => {
    const test: WindowOutcome[] = [testWindow(0.1, 10, [])]
    const report: WalkForwardReport = {
      train: null,
      test,
      windows: test,
      aggregate: { windows: 1, meanTotalReturn: 0.1, meanSharpe: 1, meanWinRate: 1, worstDrawdown: 0.05 },
    }
    const evidence = evidenceFromWalkForward(report, ["custom-caveat"])
    expect(evidence.caveats).toContain("custom-caveat")
  })
})
