import { describe, expect, it } from "vitest"

import type { Fill } from "../types.js"
import { computeMetrics, type EquityPoint } from "./metrics.js"

function point(date: string, equity: number): EquityPoint {
  return { date, equity }
}

function fill(side: "buy" | "sell", quantity: number, price: number, commission = 0): Fill {
  return {
    securityId: "US-XNAS-SYNA",
    side,
    quantity,
    price,
    currency: "USD",
    filledAt: "2020-05-20T21:00:00Z",
    commission,
  }
}

// A tiny synthetic curve with clean, hand-computable daily returns.
const CURVE: EquityPoint[] = [
  point("2020-01-02", 100),
  point("2020-01-03", 110),
  point("2020-01-06", 99),
  point("2020-01-07", 108.9),
]
// daily returns: +0.10, −0.10, +0.10
const R = [0.1, -0.1, 0.1]
const MEAN = R.reduce((s, v) => s + v, 0) / R.length // 0.0333…
const VAR = R.reduce((s, v) => s + (v - MEAN) ** 2, 0) / (R.length - 1)
const SD = Math.sqrt(VAR)
const DD = Math.sqrt(R.reduce((s, v) => s + (v < 0 ? v * v : 0), 0) / R.length)
const PPY = 252

describe("computeMetrics — daily periodic returns", () => {
  const metrics = computeMetrics(CURVE, {
    trades: [],
    costsBase: 0,
    tradedNotionalBase: 0,
    initialEquity: 100,
    periodsPerYear: PPY,
  })

  it("computes total and annualized return from the curve endpoints", () => {
    expect(metrics.totalReturn).toBeCloseTo(0.089, 12)
    expect(metrics.annualizedReturn).toBeCloseTo(1.089 ** (PPY / 3) - 1, 6)
  })

  it("computes Sharpe from mean/stdev of daily returns × √periodsPerYear", () => {
    expect(metrics.sharpe).toBeCloseTo((MEAN / SD) * Math.sqrt(PPY), 12)
  })

  it("computes Sortino from mean/downside-deviation of daily returns", () => {
    expect(metrics.sortino).toBeCloseTo((MEAN / DD) * Math.sqrt(PPY), 12)
  })

  it("computes max drawdown off the daily curve", () => {
    // Peak 110 → trough 99 → (110−99)/110 = 0.10 (the deepest decline).
    expect(metrics.maxDrawdown).toBeCloseTo(0.1, 12)
  })

  it("reports the number of curve points as trading days", () => {
    expect(metrics.tradingDays).toBe(4)
  })
})

describe("computeMetrics — trade-derived statistics", () => {
  it("win rate is the fraction of profitable closed lots (average-cost basis)", () => {
    // Two round-trips: one winner (buy 100 sell 110), one loser (buy 100 sell 90).
    const trades = [fill("buy", 10, 100), fill("sell", 10, 110), fill("buy", 10, 100), fill("sell", 10, 90)]
    const metrics = computeMetrics(CURVE, { trades, costsBase: 0, tradedNotionalBase: 0, initialEquity: 100 })
    expect(metrics.winRate).toBe(0.5)
  })

  it("turnover is gross traded notional over average equity", () => {
    const avgEquity = CURVE.reduce((s, p) => s + p.equity, 0) / CURVE.length
    const metrics = computeMetrics(CURVE, { trades: [], costsBase: 0, tradedNotionalBase: 5_000, initialEquity: 100 })
    expect(metrics.turnover).toBeCloseTo(5_000 / avgEquity, 9)
  })

  it("cost drag is total costs over initial equity", () => {
    const metrics = computeMetrics(CURVE, { trades: [], costsBase: 250, tradedNotionalBase: 0, initialEquity: 100 })
    expect(metrics.costDrag).toBeCloseTo(2.5, 12)
  })
})

describe("computeMetrics — degenerate curves", () => {
  it("returns zeroed stats for a flat or single-point curve", () => {
    const metrics = computeMetrics([point("2020-01-02", 100)], {
      trades: [],
      costsBase: 0,
      tradedNotionalBase: 0,
      initialEquity: 100,
    })
    expect(metrics.totalReturn).toBe(0)
    expect(metrics.sharpe).toBe(0)
    expect(metrics.maxDrawdown).toBe(0)
    expect(metrics.winRate).toBe(0)
  })
})
