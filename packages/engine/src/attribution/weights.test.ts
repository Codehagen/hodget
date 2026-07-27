import { describe, expect, it } from "vitest"

import type { AnalystScorecard } from "./scorecard.js"
import { shrunkAnalystWeights } from "./weights.js"

function scorecard(
  analystId: string,
  ic: number | null,
  observations: number,
): AnalystScorecard {
  return {
    analystId,
    observations,
    unresolved: 0,
    abstentionRate: 0,
    ic,
    hitRate: null,
    meanForwardAlpha: null,
    windowIc: [],
  }
}

function weight(weights: Record<string, number>, analystId: string): number {
  const value = weights[analystId]
  if (value === undefined) throw new Error(`no weight for ${analystId}`)
  return value
}

describe("shrunkAnalystWeights — no evidence", () => {
  it("returns equal weight when nothing is measurable", () => {
    const weights = shrunkAnalystWeights([
      scorecard("value", null, 200),
      scorecard("quant", null, 200),
    ])
    expect(weights).toEqual({ value: 1, quant: 1 })
  })

  it("returns equal weight — not a zeroed panel — when every IC is non-positive", () => {
    const weights = shrunkAnalystWeights([
      scorecard("value", -0.3, 500),
      scorecard("quant", 0, 500),
    ])
    expect(weights).toEqual({ value: 1, quant: 1 })
  })

  it("returns an empty map for an empty panel", () => {
    expect(shrunkAnalystWeights([])).toEqual({})
  })
})

describe("shrunkAnalystWeights — evidence", () => {
  it("gives a zero-observation seat exactly 1 whatever its IC claims", () => {
    const weights = shrunkAnalystWeights([
      scorecard("unproven", 0.9, 0),
      scorecard("proven", 0.01, 500),
    ])
    expect(weight(weights, "unproven")).toBe(1)
  })

  it("weights a strong analyst above a weak one at a large sample", () => {
    const weights = shrunkAnalystWeights([
      scorecard("strong", 0.1, 1000),
      scorecard("weak", 0.02, 1000),
    ])
    expect(weight(weights, "strong")).toBeGreaterThan(1)
    expect(weight(weights, "weak")).toBeLessThan(1)
  })

  it("never yields a negative weight for a negative IC", () => {
    const weights = shrunkAnalystWeights([
      scorecard("strong", 0.1, 1000),
      scorecard("harmful", -0.5, 1000),
    ])
    expect(weight(weights, "harmful")).toBeGreaterThanOrEqual(0)
    expect(weight(weights, "harmful")).toBeLessThan(1)
  })
})

describe("shrunkAnalystWeights — shrinkage", () => {
  it("moves weights closer to 1 for the same IC spread at a smaller sample", () => {
    // The safety property of the whole scheme: identical evidence, less of it,
    // less movement away from equal weight.
    const small = shrunkAnalystWeights([
      scorecard("strong", 0.1, 10),
      scorecard("weak", 0.02, 10),
    ])
    const large = shrunkAnalystWeights([
      scorecard("strong", 0.1, 1000),
      scorecard("weak", 0.02, 1000),
    ])

    for (const analystId of ["strong", "weak"]) {
      expect(Math.abs(weight(small, analystId) - 1)).toBeLessThan(
        Math.abs(weight(large, analystId) - 1),
      )
    }
  })

  it("is exactly equal weight at n = 0 and half-way to the evidence at n = shrinkageConstant", () => {
    const weights = shrunkAnalystWeights(
      [scorecard("none", 0.1, 0), scorecard("half", 0.1, 100), scorecard("weak", 0.02, 100)],
      { shrinkageConstant: 100 },
    )
    // scores 0.1, 0.1, 0.02 ⇒ mean 0.0733… ⇒ normalized 1.3636… for "half".
    const normalized = 0.1 / ((0.1 + 0.1 + 0.02) / 3)
    expect(weight(weights, "none")).toBe(1)
    expect(weight(weights, "half")).toBeCloseTo(0.5 + 0.5 * normalized, 12)
  })
})

describe("shrunkAnalystWeights — bounds", () => {
  it("clamps to maxWeight and stays finite", () => {
    const weights = shrunkAnalystWeights(
      [scorecard("star", 1, 100_000), scorecard("a", 0, 100_000), scorecard("b", 0, 100_000)],
      { maxWeight: 1.5 },
    )
    for (const value of Object.values(weights)) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1.5)
    }
    expect(weight(weights, "star")).toBe(1.5)
  })
})
