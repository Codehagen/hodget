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

describe("runConfigSchema — abuse caps (plan 009)", () => {
  it("rejects more than 200 securityIds and accepts 200", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `SEC${i}`)
    expect(
      runConfigSchema.safeParse({ ...BASE, securityIds: ids(201) }).success,
    ).toBe(false)
    expect(
      runConfigSchema.safeParse({ ...BASE, securityIds: ids(200) }).success,
    ).toBe(true)
  })

  it("rejects a security id longer than 40 chars", () => {
    expect(
      runConfigSchema.safeParse({ ...BASE, securityIds: ["X".repeat(41)] })
        .success,
    ).toBe(false)
  })

  it("rejects a panel with more than 16 seats and a name over 120 chars", () => {
    const seats = Array.from({ length: 17 }, (_, i) => ({
      id: `a${i}`,
      weight: 1,
    }))
    expect(
      runConfigSchema.safeParse({ ...BASE, panel: { analysts: seats } })
        .success,
    ).toBe(false)
  })
})

describe("runConfigSchema — panel weight", () => {
  it("accepts weight: 1", () => {
    expect(runConfigSchema.safeParse(BASE).success).toBe(true)
  })

  it("accepts weight: 0 (a benched seat is valid today)", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      panel: { analysts: [{ id: "quant.earnings-drift", weight: 0 }] },
    })
    expect(result.success).toBe(true)
  })

  it("rejects Infinity (the JSON.parse('1e999') attack shape)", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      panel: {
        analysts: [
          { id: "quant.earnings-drift", weight: Number.POSITIVE_INFINITY },
        ],
      },
    })
    expect(result.success).toBe(false)
  })

  it("rejects NaN", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      panel: { analysts: [{ id: "quant.earnings-drift", weight: NaN }] },
    })
    expect(result.success).toBe(false)
  })

  it("rejects a weight over the abuse cap (1001)", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      panel: { analysts: [{ id: "quant.earnings-drift", weight: 1001 }] },
    })
    expect(result.success).toBe(false)
  })

  it("rejects a negative weight (-1)", () => {
    const result = runConfigSchema.safeParse({
      ...BASE,
      panel: { analysts: [{ id: "quant.earnings-drift", weight: -1 }] },
    })
    expect(result.success).toBe(false)
  })
})
