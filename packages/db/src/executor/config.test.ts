import { describe, expect, it } from "vitest"

import { runConfigSchema } from "./config.js"

const BASE = {
  panel: { analysts: [{ id: "quant.earnings-drift", weight: 1 }] },
  initialCash: { USD: 100_000 },
}

describe("runConfigSchema — initialCash", () => {
  it("accepts positive amounts", () => {
    expect(runConfigSchema.safeParse(BASE).success).toBe(true)
  })

  it("rejects a zero amount", () => {
    expect(runConfigSchema.safeParse({ ...BASE, initialCash: { USD: 0 } }).success).toBe(false)
  })

  it("rejects a negative amount", () => {
    expect(runConfigSchema.safeParse({ ...BASE, initialCash: { USD: -1 } }).success).toBe(false)
  })

  it("rejects an empty record (no currency funded)", () => {
    expect(runConfigSchema.safeParse({ ...BASE, initialCash: {} }).success).toBe(false)
  })
})

describe("runConfigSchema — range", () => {
  it("accepts a valid ISO range with from before to", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      range: { from: "2024-01-01", to: "2024-12-31" },
    })
    expect(result.success).toBe(true)
  })

  it("accepts from equal to to (single-day range)", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      range: { from: "2024-06-01", to: "2024-06-01" },
    })
    expect(result.success).toBe(true)
  })

  it("rejects from after to", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      range: { from: "2024-12-31", to: "2024-01-01" },
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-ISO date string", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      range: { from: "01/01/2024", to: "2024-12-31" },
    })
    expect(result.success).toBe(false)
  })

  it("omits fine — range is optional", () => {
    expect(runConfigSchema.safeParse(BASE).success).toBe(true)
  })
})
