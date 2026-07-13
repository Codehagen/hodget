import { describe, expect, it } from "vitest"

import { FIXED_UNIVERSE_CAVEAT, type BacktestResult } from "../backtest/engine.js"
import type { BacktestMetrics } from "../backtest/metrics.js"
import type { WalkForwardReport, WindowOutcome } from "../validation/walk-forward.js"
import { promoteToLive, promoteToPaper, type StrategyConfig } from "./workflow.js"

function metrics(totalReturn: number): BacktestMetrics {
  return {
    totalReturn,
    annualizedReturn: 0,
    sharpe: 0,
    sortino: 0,
    maxDrawdown: 0,
    winRate: 0,
    turnover: 0,
    costDrag: 0,
    tradingDays: 0,
  }
}

function result(tradeCount: number): BacktestResult {
  return {
    baseCurrency: "USD",
    equityCurve: [],
    metrics: metrics(0),
    diagnostics: {
      tradeStats: { wins: 0, losses: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, avgHoldingDays: 0 },
      attribution: [],
    },
    trades: Array.from({ length: tradeCount }, () => ({
      fill: { securityId: "A", side: "buy" as const, quantity: 1, price: 100, currency: "USD" as const, filledAt: "2020-01-01T21:00:00Z", commission: 0 },
      view: { securityId: "A", asOf: "2020-01-01T23:00:00Z", conviction: 0.5, horizonDays: 20, contributingAnalystIds: ["x"] },
    })),
    corporateActions: [],
    caveats: [FIXED_UNIVERSE_CAVEAT],
  }
}

/** A walk-forward report with `windows` profitable OOS windows and a chosen Sharpe. */
function report(meanSharpe: number): WalkForwardReport {
  const test: WindowOutcome[] = Array.from({ length: 4 }, (_v, i) => ({
    window: { label: `test-${i + 1}`, kind: "test" as const, range: { from: "2020-01-01", to: "2020-03-31" } },
    metrics: metrics(0.05),
    result: result(10),
  }))
  return {
    train: null,
    test,
    windows: test,
    aggregate: { windows: 4, meanTotalReturn: 0.05, meanSharpe, meanWinRate: 0.6, worstDrawdown: 0.1 },
  }
}

const CONFIG: StrategyConfig = {
  strategyId: "value-drift-v1",
  securityIds: ["A"],
  baseCurrency: "USD",
  construction: { maxWeightPerName: 0.2 },
  caveats: [FIXED_UNIVERSE_CAVEAT],
}

const START = { startDate: "2020-06-01", initialCash: { USD: 1_000_000 } }
const NOW = "2026-07-13T12:00:00Z"

describe("promoteToPaper", () => {
  it("promotes a passing strategy to a frozen paper session", () => {
    const outcome = promoteToPaper({ config: CONFIG, report: report(1.0), start: START, now: () => NOW })

    expect(outcome.stage).toBe("paper")
    expect(outcome.result.promoted).toBe(true)
    expect(outcome.session).not.toBeNull()
    const session = outcome.session as NonNullable<typeof outcome.session>
    expect(session.strategyId).toBe("value-drift-v1")
    expect(session.createdAt).toBe(NOW) // from the injected time source, not the wall clock
    expect(session.start).toEqual(START)
    // The descriptor is frozen — a consumer cannot mutate the promoted config.
    expect(Object.isFrozen(session)).toBe(true)
    expect(Object.isFrozen(session.config)).toBe(true)
  })

  it("blocks a failing strategy and produces no session", () => {
    const outcome = promoteToPaper({ config: CONFIG, report: report(0.1), start: START, now: () => NOW })

    expect(outcome.stage).toBe("blocked")
    expect(outcome.result.promoted).toBe(false)
    expect(outcome.session).toBeNull()
  })
})

describe("promoteToLive", () => {
  it("is always blocked for a fixed-universe strategy, with the caveat recorded", () => {
    const outcome = promoteToLive({ config: CONFIG, report: report(1.0) })

    expect(outcome.stage).toBe("blocked")
    expect(outcome.session).toBeNull()
    expect(outcome.result.promoted).toBe(false)
    const universe = outcome.result.reasons.find((r) => r.code === "universe-honesty")
    expect(universe?.ok).toBe(false)
  })
})
