import { describe, expect, it } from "vitest"

import type { PromotionReason } from "../promotion/gate.js"
import type { AnalystScorecard } from "./scorecard.js"
import { evaluateSeat, type SeatEvidence } from "./seat-gate.js"

/** A scorecard that clears every default threshold. */
function passingScorecard(overrides: Partial<AnalystScorecard> = {}): AnalystScorecard {
  return {
    analystId: "value",
    observations: 60,
    unresolved: 4,
    abstentionRate: 0.1,
    ic: 0.08,
    hitRate: 0.55,
    meanForwardAlpha: 0.004,
    windowIc: [0.05, 0.12, -0.02, 0.09],
    ...overrides,
  }
}

function oos(overrides: Partial<AnalystScorecard> = {}): SeatEvidence {
  return { scorecard: passingScorecard(overrides), source: "out-of-sample" }
}

function reason(result: { reasons: PromotionReason[] }, code: string): PromotionReason {
  const found = result.reasons.find((r) => r.code === code)
  if (!found) throw new Error(`no reason with code ${code}`)
  return found
}

const ALL_CODES = [
  "out-of-sample",
  "min-observations",
  "information-coefficient",
  "ic-consistency",
  "abstention-rate",
]

describe("evaluateSeat", () => {
  it("activates a seat that clears every check and records them all as passing", () => {
    const result = evaluateSeat(oos())
    expect(result.analystId).toBe("value")
    expect(result.state).toBe("active")
    expect(result.reasons.map((r) => r.code)).toEqual(ALL_CODES)
    expect(result.reasons.every((r) => r.ok)).toBe(true)
  })

  it("refuses in-sample evidence even when every other check passes", () => {
    const result = evaluateSeat({ scorecard: passingScorecard(), source: "in-sample" })
    expect(result.state).toBe("shadow")
    expect(reason(result, "out-of-sample").ok).toBe(false)
    expect(result.reasons.filter((r) => !r.ok)).toHaveLength(1)
  })

  it("keeps a seat in shadow when the IC is unmeasurable", () => {
    const result = evaluateSeat(oos({ ic: null }))
    expect(result.state).toBe("shadow")
    const ic = reason(result, "information-coefficient")
    expect(ic.ok).toBe(false)
    expect(ic.detail).toMatch(/unmeasurable/)
  })

  it("keeps a seat in shadow when the IC is below the floor", () => {
    const result = evaluateSeat(oos({ ic: 0.01 }), { icFloor: 0.02 })
    expect(result.state).toBe("shadow")
    expect(reason(result, "information-coefficient").ok).toBe(false)
  })

  it("keeps a seat in shadow on a thin sample", () => {
    const result = evaluateSeat(oos({ observations: 12 }))
    expect(result.state).toBe("shadow")
    const check = reason(result, "min-observations")
    expect(check.ok).toBe(false)
    // The detail must name the observed value and the threshold, so a rejection
    // is explainable without rerunning anything.
    expect(check.detail).toMatch(/12 resolved observation\(s\) vs\. min 30/)
  })

  it("keeps a seat in shadow when its IC is inconsistent across windows", () => {
    const result = evaluateSeat(oos({ windowIc: [0.1, -0.2, -0.3, -0.05] }))
    expect(result.state).toBe("shadow")
    expect(reason(result, "ic-consistency").ok).toBe(false)
  })

  it("counts an unmeasurable window against consistency", () => {
    const result = evaluateSeat(oos({ windowIc: [0.1, null, null, null] }))
    expect(reason(result, "ic-consistency").ok).toBe(false)
  })

  it("does not block promotion when no evaluation windows were supplied", () => {
    const result = evaluateSeat(oos({ windowIc: [] }))
    expect(result.state).toBe("active")
    const check = reason(result, "ic-consistency")
    expect(check.ok).toBe(true)
    expect(check.detail).toMatch(/skipped/)
  })

  it("keeps a seat in shadow when it abstains too often", () => {
    const result = evaluateSeat(oos({ abstentionRate: 0.95 }))
    expect(result.state).toBe("shadow")
    expect(reason(result, "abstention-rate").ok).toBe(false)
  })

  it("lists all five checks in a stable order whatever the outcome", () => {
    const failing = evaluateSeat({
      scorecard: passingScorecard({ observations: 0, ic: null, abstentionRate: 1, windowIc: [] }),
      source: "in-sample",
    })
    expect(failing.reasons.map((r) => r.code)).toEqual(ALL_CODES)
    expect(failing.state).toBe("shadow")
  })

  it("honours overridden thresholds", () => {
    const thin = oos({ observations: 5, ic: 0.5 })
    expect(evaluateSeat(thin).state).toBe("shadow")
    expect(evaluateSeat(thin, { minObservations: 5 }).state).toBe("active")
  })

  it("treats every threshold as inclusive — a seat exactly on the bar promotes", () => {
    // The difference between promoting and not promoting a marginal seat.
    const onTheBar = oos({
      observations: 30,
      ic: 0.02,
      abstentionRate: 0.8,
      windowIc: [0.01, -0.01],
    })
    const result = evaluateSeat(onTheBar)
    expect(result.reasons.filter((r) => !r.ok)).toEqual([])
    expect(result.state).toBe("active")
  })

  it("keeps a seat in shadow just below each bar", () => {
    expect(evaluateSeat(oos({ observations: 29 })).state).toBe("shadow")
    expect(evaluateSeat(oos({ ic: 0.0199 })).state).toBe("shadow")
    expect(evaluateSeat(oos({ abstentionRate: 0.8001 })).state).toBe("shadow")
    expect(evaluateSeat(oos({ windowIc: [0.01, -0.01, -0.02] })).state).toBe("shadow")
  })
})
