import { describe, expect, it } from "vitest"

import type { Signal } from "../types.js"
import { createConvictionCommittee, horizonBucket } from "./committee.js"

function signal(overrides: Partial<Signal> & Pick<Signal, "analystId">): Signal {
  return {
    securityId: "A",
    asOf: "2020-05-20T23:00:00Z",
    conviction: 0.5,
    horizonDays: 20,
    thesis: null,
    abstained: false,
    ...overrides,
  }
}

describe("createConvictionCommittee", () => {
  it("returns the shared conviction on unanimity", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", conviction: 0.8 }),
      signal({ analystId: "b", conviction: 0.8 }),
      signal({ analystId: "c", conviction: 0.8 }),
    ])
    expect(views).toHaveLength(1)
    expect(views[0]?.conviction).toBeCloseTo(0.8, 12)
    expect(views[0]?.contributingAnalystIds).toEqual(["a", "b", "c"])
  })

  it("averages disagreement (equal weights → arithmetic mean)", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", conviction: 0.9 }),
      signal({ analystId: "b", conviction: 0.3 }),
      signal({ analystId: "c", conviction: -0.6 }),
    ])
    // (0.9 + 0.3 − 0.6) / 3 = 0.2
    expect(views[0]?.conviction).toBeCloseTo(0.2, 12)
  })

  it("weights the average by per-analyst weight", () => {
    const committee = createConvictionCommittee({ analystWeights: { a: 3, b: 1 } })
    const views = committee.combine([
      signal({ analystId: "a", conviction: 1 }),
      signal({ analystId: "b", conviction: 0 }),
    ])
    // (3×1 + 1×0) / 4 = 0.75
    expect(views[0]?.conviction).toBeCloseTo(0.75, 12)
  })

  it("excludes abstentions from the weighting (abstain ≠ neutral)", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", conviction: 0.6 }),
      signal({ analystId: "b", conviction: 0, abstained: true }),
    ])
    // Only the actionable 0.6 counts; the abstainer contributes nothing.
    expect(views[0]?.conviction).toBeCloseTo(0.6, 12)
    expect(views[0]?.contributingAnalystIds).toEqual(["a"])
  })

  it("counts a genuine neutral view (conviction 0, not abstained)", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", conviction: 0.6 }),
      signal({ analystId: "b", conviction: 0, abstained: false }),
    ])
    // Neutral pulls the blend down: (0.6 + 0) / 2 = 0.3.
    expect(views[0]?.conviction).toBeCloseTo(0.3, 12)
    expect(views[0]?.contributingAnalystIds).toEqual(["a", "b"])
  })

  it("emits no view when every analyst abstains (all-abstain ⇒ no view)", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", conviction: 0, abstained: true }),
      signal({ analystId: "b", conviction: 0, abstained: true }),
    ])
    expect(views).toEqual([])
  })

  it("mutes zero-weight analysts; all-muted ⇒ no view", () => {
    const committee = createConvictionCommittee({ analystWeights: { a: 0 } })
    expect(committee.combine([signal({ analystId: "a", conviction: 0.9 })])).toEqual([])
  })

  it("blends only comparable horizons — the dominant bucket wins", () => {
    const committee = createConvictionCommittee()
    // Two short-horizon views (bucket 1: ≤21d) vs one year-horizon view (bucket 3).
    // The short bucket carries more summed weight, so it forms the view alone.
    const views = committee.combine([
      signal({ analystId: "a", conviction: 0.8, horizonDays: 10 }),
      signal({ analystId: "b", conviction: 0.4, horizonDays: 15 }),
      signal({ analystId: "c", conviction: -0.9, horizonDays: 250 }),
    ])
    expect(views[0]?.contributingAnalystIds).toEqual(["a", "b"])
    // The year view does not dilute: (0.8 + 0.4)/2 = 0.6, not (0.8+0.4−0.9)/3.
    expect(views[0]?.conviction).toBeCloseTo(0.6, 12)
    // Horizon is the weighted mean of the blended (short) bucket: (10+15)/2 = 12.5 → 13.
    expect(views[0]?.horizonDays).toBe(13)
  })

  it("resolves a horizon-weight tie toward the shorter bucket", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", conviction: 0.5, horizonDays: 10 }), // bucket 1
      signal({ analystId: "b", conviction: -0.5, horizonDays: 250 }), // bucket 3
    ])
    // Equal weight tie → shorter bucket wins → conviction 0.5.
    expect(views[0]?.conviction).toBeCloseTo(0.5, 12)
    expect(views[0]?.contributingAnalystIds).toEqual(["a"])
  })

  it("throws on a duplicated analyst id for a security (misconfigured panel)", () => {
    const committee = createConvictionCommittee()
    // Two analysts sharing an id → two signals for security A. Silently blending
    // both would double-count the id; the committee rejects it instead.
    expect(() =>
      committee.combine([
        signal({ analystId: "dup", conviction: 0.8 }),
        signal({ analystId: "dup", conviction: 0.2 }),
      ]),
    ).toThrow(/duplicate analyst id "dup"/)
  })

  it("allows the same analyst id across different securities", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", securityId: "A", conviction: 0.5 }),
      signal({ analystId: "a", securityId: "B", conviction: 0.5 }),
    ])
    expect(views.map((v) => v.securityId)).toEqual(["A", "B"])
  })

  it("emits one deterministic, securityId-sorted view per security", () => {
    const committee = createConvictionCommittee()
    const views = committee.combine([
      signal({ analystId: "a", securityId: "B", conviction: 0.5 }),
      signal({ analystId: "a", securityId: "A", conviction: 0.5 }),
    ])
    expect(views.map((v) => v.securityId)).toEqual(["A", "B"])
  })
})

describe("horizonBucket", () => {
  it("buckets by trading-day thresholds", () => {
    expect(horizonBucket(1)).toBe(0)
    expect(horizonBucket(5)).toBe(0)
    expect(horizonBucket(6)).toBe(1)
    expect(horizonBucket(21)).toBe(1)
    expect(horizonBucket(63)).toBe(2)
    expect(horizonBucket(252)).toBe(3)
    expect(horizonBucket(253)).toBe(4)
  })
})
