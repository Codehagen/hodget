import { describe, expect, it } from "vitest"

import type { FundamentalsSnapshot } from "../data/types.js"
import {
  bookValueGrowth,
  bookValuePerShare,
  cagr,
  debtToEquity,
  intrinsicValuePerShare,
  marginOfSafety,
  marginTrend,
  netMargin,
  ownerEarnings,
} from "./fundamentals.js"

type Metrics = FundamentalsSnapshot["metrics"]

const BASE_METRICS: Metrics = {
  revenue: 100,
  netIncome: 10,
  totalEquity: 200,
  totalDebt: 80,
  sharesOutstanding: 50,
  operatingCashFlow: 30,
  capitalExpenditure: 10,
}

function snap(metrics: Partial<Metrics>, fiscalPeriod = "2020"): FundamentalsSnapshot {
  return {
    securityId: "TEST",
    fiscalPeriod,
    knownAt: "2020-06-30T20:00:00Z",
    currency: "USD",
    metrics: { ...BASE_METRICS, ...metrics },
  }
}

describe("cagr", () => {
  it("computes a hand-checked growth rate", () => {
    // (121/100)^(1/2) - 1 = 1.1 - 1 = 0.1
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 12)
  })

  it("returns null for a non-positive base, end, or period", () => {
    expect(cagr(0, 100, 1)).toBeNull()
    expect(cagr(100, 0, 1)).toBeNull()
    expect(cagr(100, 121, 0)).toBeNull()
    expect(cagr(-100, 121, 2)).toBeNull()
  })
})

describe("netMargin", () => {
  it("is net income over revenue", () => {
    expect(netMargin(snap({ revenue: 100, netIncome: 20 }))).toBeCloseTo(0.2, 12)
  })

  it("is null when revenue is ~0", () => {
    expect(netMargin(snap({ revenue: 0 }))).toBeNull()
  })
})

describe("marginTrend", () => {
  it("computes a hand-checked slope and direction", () => {
    const snapshots = [
      snap({ revenue: 100, netIncome: 10 }, "2018"), // 0.10
      snap({ revenue: 100, netIncome: 12 }, "2019"), // 0.12
      snap({ revenue: 100, netIncome: 14 }, "2020"), // 0.14
    ]
    const trend = marginTrend(snapshots)
    expect(trend).not.toBeNull()
    expect(trend?.netMargins).toEqual([0.1, 0.12, 0.14])
    expect(trend?.slope).toBeCloseTo(0.02, 12)
    expect(trend?.direction).toBe("improving")
  })

  it("flags a declining trend", () => {
    const trend = marginTrend([
      snap({ revenue: 100, netIncome: 14 }, "2018"),
      snap({ revenue: 100, netIncome: 10 }, "2019"),
    ])
    expect(trend?.direction).toBe("declining")
  })

  it("is null with fewer than two computable margins", () => {
    expect(marginTrend([snap({})])).toBeNull()
  })
})

describe("ownerEarnings", () => {
  it("is operating cash flow less capital expenditure", () => {
    expect(ownerEarnings(snap({ operatingCashFlow: 50, capitalExpenditure: 20 }))).toBe(30)
  })

  it("treats capital expenditure as a magnitude", () => {
    expect(ownerEarnings(snap({ operatingCashFlow: 50, capitalExpenditure: -20 }))).toBe(30)
  })
})

describe("debtToEquity", () => {
  it("is total debt over total equity", () => {
    expect(debtToEquity(snap({ totalDebt: 80, totalEquity: 200 }))).toBeCloseTo(0.4, 12)
  })

  it("is null when equity is ~0", () => {
    expect(debtToEquity(snap({ totalEquity: 0 }))).toBeNull()
  })
})

describe("bookValuePerShare and bookValueGrowth", () => {
  it("computes book value per share", () => {
    expect(bookValuePerShare(snap({ totalEquity: 200, sharesOutstanding: 50 }))).toBe(4)
  })

  it("computes hand-checked per-share book-value CAGR", () => {
    const oldest = snap({ totalEquity: 200, sharesOutstanding: 50 }, "2018") // bvps 4.00
    const newest = snap({ totalEquity: 242, sharesOutstanding: 50 }, "2020") // bvps 4.84
    // cagr(4, 4.84, 2) = (1.21)^0.5 - 1 = 0.1
    expect(bookValueGrowth(oldest, newest, 2)).toBeCloseTo(0.1, 12)
  })
})

describe("intrinsicValuePerShare and marginOfSafety", () => {
  it("capitalises owner earnings per share (no growth)", () => {
    // OE = 30 - 10 = 20; per share = 20/10 = 2; iv = 2 / 0.10 = 20
    const s = snap({ operatingCashFlow: 30, capitalExpenditure: 10, sharesOutstanding: 10 })
    expect(intrinsicValuePerShare(s)).toBeCloseTo(20, 12)
  })

  it("is null for a cash-burning business", () => {
    const s = snap({ operatingCashFlow: 5, capitalExpenditure: 10 })
    expect(intrinsicValuePerShare(s)).toBeNull()
  })

  it("computes margin of safety against intrinsic value", () => {
    expect(marginOfSafety(20, 10)).toBeCloseTo(0.5, 12)
    expect(marginOfSafety(20, 25)).toBeCloseTo(-0.25, 12)
    expect(marginOfSafety(0, 10)).toBeNull()
  })
})
