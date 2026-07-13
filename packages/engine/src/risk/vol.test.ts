import { describe, expect, it } from "vitest"

import {
  averagePairwiseCorrelation,
  correlationMultiplier,
  pearson,
  realizedVolatility,
  sampleStdev,
  simpleReturns,
  volScaledCap,
} from "./vol.js"

describe("simpleReturns", () => {
  it("computes consecutive returns and skips non-positive denominators", () => {
    const returns = simpleReturns([100, 110, 99])
    expect(returns).toHaveLength(2)
    expect(returns[0]).toBeCloseTo(0.1, 12)
    expect(returns[1]).toBeCloseTo(-0.1, 12)
    expect(simpleReturns([100])).toEqual([])
  })
})

describe("realizedVolatility", () => {
  it("annualizes the sample stdev of returns (hand-computed)", () => {
    // returns [0.1, −0.1]; sample stdev² = 0.02; annualized = √(0.02 × 252).
    const vol = realizedVolatility([100, 110, 99])
    expect(vol).toBeCloseTo(Math.sqrt(0.02 * 252), 10)
  })

  it("returns null when there is too little history", () => {
    expect(realizedVolatility([100, 110])).toBeNull() // 1 return < 2
    expect(realizedVolatility([100])).toBeNull()
  })
})

describe("pearson", () => {
  it("is +1 for a perfectly rising pair and −1 for a mirrored pair", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12)
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 12)
  })

  it("is null for a constant (zero-variance) series", () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
  })
})

describe("averagePairwiseCorrelation", () => {
  it("averages the defined pairwise correlations", () => {
    // pairs: (a,b)=+1, (a,c)=−1, (b,c)=−1 → mean = −1/3.
    const a = [1, 2, 3]
    const b = [2, 4, 6]
    const c = [3, 2, 1]
    expect(averagePairwiseCorrelation([a, b, c])).toBeCloseTo(-1 / 3, 12)
  })

  it("is null with fewer than two comparable series", () => {
    expect(averagePairwiseCorrelation([[1, 2, 3]])).toBeNull()
    expect(averagePairwiseCorrelation([])).toBeNull()
  })
})

describe("volScaledCap", () => {
  it("buckets realized vol into a cap between 5% and 25%", () => {
    expect(volScaledCap(0.1)).toBe(0.25) // quiet
    expect(volScaledCap(0.2)).toBe(0.2) // base
    expect(volScaledCap(0.3)).toBe(0.15)
    expect(volScaledCap(0.5)).toBe(0.1)
    expect(volScaledCap(0.8)).toBe(0.05) // turbulent
  })

  it("falls back to the base cap when vol is unestimable (null)", () => {
    expect(volScaledCap(null)).toBe(0.2)
    expect(volScaledCap(null, 0.3)).toBe(0.3)
  })
})

describe("correlationMultiplier", () => {
  it("shrinks toward 0.7 as the book co-moves and loosens toward 1.1 when diversified", () => {
    expect(correlationMultiplier(0)).toBeCloseTo(1, 12)
    expect(correlationMultiplier(1)).toBeCloseTo(0.7, 12)
    expect(correlationMultiplier(0.5)).toBeCloseTo(0.85, 12)
    expect(correlationMultiplier(-1)).toBeCloseTo(1.1, 12)
    expect(correlationMultiplier(-0.5)).toBeCloseTo(1.05, 12)
  })

  it("is neutral (1) when correlation is unknown", () => {
    expect(correlationMultiplier(null)).toBe(1)
  })
})

describe("sampleStdev", () => {
  it("is the ddof=1 sample standard deviation", () => {
    // values [2,4,4,4,5,5,7,9]: mean 5, sample stdev = √(32/7).
    expect(sampleStdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 12)
    expect(sampleStdev([5])).toBe(0)
  })
})
