import { describe, expect, it } from "vitest"

import type { Currency } from "../data/types.js"
import type { TargetView } from "../types.js"
import { construct, type ConstructionContext } from "./construct.js"

function view(securityId: string, conviction: number, horizonDays = 20): TargetView {
  return {
    securityId,
    asOf: "2020-05-20T23:00:00Z",
    conviction,
    horizonDays,
    contributingAnalystIds: ["a"],
  }
}

function ctx(overrides: Partial<ConstructionContext> = {}): ConstructionContext {
  return {
    currencyOf: (): Currency => "USD",
    hasMark: () => true,
    ...overrides,
  }
}

describe("construct", () => {
  it("targets weight proportional to conviction under equal caps (0.9 vs 0.1 → 9×)", () => {
    const weights = construct([view("A", 0.9), view("B", 0.1)], ctx())
    const a = weights.find((w) => w.securityId === "A")?.weight ?? 0
    const b = weights.find((w) => w.securityId === "B")?.weight ?? 0
    // weight = conviction × maxWeightPerName(0.2)
    expect(a).toBeCloseTo(0.18, 12)
    expect(b).toBeCloseTo(0.02, 12)
    expect(a / b).toBeCloseTo(9, 12)
  })

  it("caps any single name at maxWeightPerName", () => {
    const weights = construct([view("A", 1)], ctx(), { maxWeightPerName: 0.1 })
    expect(weights[0]?.weight).toBeCloseTo(0.1, 12)
  })

  it("is long-only: non-positive conviction targets weight 0", () => {
    const weights = construct([view("A", -0.8), view("B", 0)], ctx())
    expect(weights.find((w) => w.securityId === "A")?.weight).toBe(0)
    expect(weights.find((w) => w.securityId === "B")?.weight).toBe(0)
  })

  it("scales all weights down proportionally when gross exceeds the cap", () => {
    const views = ["A", "B", "C", "D", "E", "F"].map((s) => view(s, 1))
    // 6 × 0.2 = 1.2 gross > 1.0 → ×(1/1.2) → each 0.1666…
    const weights = construct(views, ctx(), { maxGross: 1 })
    for (const w of weights) expect(w.weight).toBeCloseTo(0.2 / 1.2, 12)
    const gross = weights.reduce((s, w) => s + w.weight, 0)
    expect(gross).toBeCloseTo(1, 12)
  })

  it("drops a view whose security has no mark price", () => {
    const weights = construct([view("A", 0.5), view("B", 0.5)], ctx({ hasMark: (id) => id === "A" }))
    expect(weights.map((w) => w.securityId)).toEqual(["A"])
  })

  it("carries the security currency and sorts by securityId", () => {
    const weights = construct(
      [view("B", 0.5), view("A", 0.5)],
      ctx({ currencyOf: (id): Currency => (id === "A" ? "NOK" : "USD") }),
    )
    expect(weights.map((w) => w.securityId)).toEqual(["A", "B"])
    expect(weights[0]?.currency).toBe("NOK")
  })
})
