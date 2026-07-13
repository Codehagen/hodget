import { describe, expect, it } from "vitest"

import { convictionSchema, isActionable, signalSchema } from "./types.js"

const base = {
  analystId: "quant-1",
  securityId: "US-XNAS-SYNA",
  asOf: "2020-06-15T20:00:00Z",
  horizonDays: 30,
  thesis: null,
}

describe("conviction bounds", () => {
  it("accepts values within [-1, 1]", () => {
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      expect(convictionSchema.parse(v)).toBe(v)
    }
  })

  it("rejects values outside [-1, 1]", () => {
    expect(convictionSchema.safeParse(1.5).success).toBe(false)
    expect(convictionSchema.safeParse(-1.0001).success).toBe(false)
  })

  it("rejects NaN and Infinity", () => {
    expect(convictionSchema.safeParse(Number.NaN).success).toBe(false)
    expect(convictionSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false)
  })
})

describe("abstained vs neutral", () => {
  it("accepts a neutral (conviction 0) non-abstained view", () => {
    const neutral = signalSchema.parse({ ...base, conviction: 0, abstained: false })
    expect(neutral.abstained).toBe(false)
    expect(isActionable(neutral)).toBe(true)
  })

  it("accepts an abstained view and treats it as non-actionable", () => {
    const abstained = signalSchema.parse({ ...base, conviction: 0, abstained: true })
    expect(abstained.abstained).toBe(true)
    expect(isActionable(abstained)).toBe(false)
  })

  it("distinguishes abstained from neutral (a broken analyst is not a neutral view)", () => {
    const neutral = signalSchema.parse({ ...base, conviction: 0, abstained: false })
    const abstained = signalSchema.parse({ ...base, conviction: 0, abstained: true })
    expect(neutral.abstained).not.toBe(abstained.abstained)
    expect(isActionable(neutral)).not.toBe(isActionable(abstained))
  })

  it("rejects an abstained signal that carries a non-zero conviction", () => {
    expect(signalSchema.safeParse({ ...base, conviction: 0.5, abstained: true }).success).toBe(
      false,
    )
  })

  it("rejects a signal with NaN conviction", () => {
    expect(
      signalSchema.safeParse({ ...base, conviction: Number.NaN, abstained: false }).success,
    ).toBe(false)
  })
})
