import { describe, expect, it } from "vitest"

import type { Currency } from "../data/types.js"
import type { Signal } from "../types.js"
import { sizeOrders, type SizingContext } from "./sizing.js"

function signal(securityId: string, conviction: number, abstained = false): Signal {
  return {
    analystId: "quant.test",
    securityId,
    asOf: "2020-05-20T23:00:00Z",
    conviction: abstained ? 0 : conviction,
    horizonDays: 20,
    thesis: null,
    abstained,
  }
}

/** A USD-only context: every security priced at 100, equity 1,000,000, flat book. */
function ctx(overrides: Partial<SizingContext> = {}): SizingContext {
  return {
    equityBase: 1_000_000,
    markPrice: () => 100,
    rateToBase: () => 1,
    currencyOf: (): Currency => "USD",
    heldQuantity: () => 0,
    ...overrides,
  }
}

describe("sizeOrders", () => {
  it("scales position size proportionally to conviction (0.9 vs 0.1 under equal caps)", () => {
    const orders = sizeOrders([signal("A", 0.9), signal("B", 0.1)], ctx())
    const a = orders.find((o) => o.securityId === "A")
    const b = orders.find((o) => o.securityId === "B")
    // weight = conviction × maxPositionPct(0.2); value/price = qty.
    // A: 0.9×0.2×1e6/100 = 1800 ; B: 0.1×0.2×1e6/100 = 200 → 9× ratio.
    expect(a?.quantity).toBe(1800)
    expect(b?.quantity).toBe(200)
    expect((a?.quantity ?? 0) / (b?.quantity ?? 1)).toBe(9)
  })

  it("caps any single position at maxPositionPct of equity", () => {
    const orders = sizeOrders([signal("A", 1)], ctx(), { maxPositionPct: 0.1 })
    // 1.0 conviction × 0.1 cap × 1e6 / 100 = 1000 shares (not more).
    expect(orders[0]?.quantity).toBe(1000)
  })

  it("scales all targets down when gross exposure exceeds the cap", () => {
    // Six names each at conviction 1 → 6×0.2 = 1.2 gross > 1.0 cap → ×(1/1.2).
    const signals = ["A", "B", "C", "D", "E", "F"].map((s) => signal(s, 1))
    const orders = sizeOrders(signals, ctx(), { maxGrossExposure: 1 })
    // each target 0.2×(1/1.2)×1e6/100 = 1666.67 → floor 1666 (never rounded up).
    for (const order of orders) expect(order.quantity).toBe(1666)
  })

  it("floors the target quantity so hard caps are never exceeded by rounding", () => {
    // A price that does not divide the target value evenly forces a fractional
    // share: 0.2×1e6 / 300 = 666.67. Rounding up (667) would put 667×300 =
    // 200,100 > the 200,000 (20%) cap; flooring to 666 keeps 199,800 ≤ cap.
    const maxPositionPct = 0.2
    const equityBase = 1_000_000
    const price = 300
    const orders = sizeOrders([signal("A", 1)], ctx({ markPrice: () => price }), { maxPositionPct })
    const qty = orders[0]?.quantity ?? 0
    expect(qty).toBe(666)
    // The invariant: the filled position value never exceeds the cap.
    expect(qty * price).toBeLessThanOrEqual(maxPositionPct * equityBase)

    // And the gross cap holds after flooring across many names.
    const maxGrossExposure = 1
    const names = ["A", "B", "C", "D", "E", "F"].map((s) => signal(s, 1))
    const grossOrders = sizeOrders(names, ctx({ markPrice: () => price }), {
      maxPositionPct,
      maxGrossExposure,
    })
    const grossValue = grossOrders.reduce((sum, o) => sum + o.quantity * price, 0)
    expect(grossValue).toBeLessThanOrEqual(maxGrossExposure * equityBase)
  })

  it("produces no order for an abstained signal (abstain ≠ neutral)", () => {
    const orders = sizeOrders([signal("A", 0, true)], ctx({ heldQuantity: () => 500 }))
    expect(orders).toEqual([])
  })

  it("sells to flat on a genuine neutral view (conviction 0, not abstained)", () => {
    const orders = sizeOrders([signal("A", 0)], ctx({ heldQuantity: () => 500 }))
    expect(orders).toEqual([{ securityId: "A", side: "sell", quantity: 500, currency: "USD" }])
  })

  it("emits a delta order against the current holding", () => {
    const orders = sizeOrders([signal("A", 0.9)], ctx({ heldQuantity: () => 800 }))
    // target 1800, held 800 → buy 1000
    expect(orders[0]).toEqual({ securityId: "A", side: "buy", quantity: 1000, currency: "USD" })
  })

  it("targets zero for a negative conviction (long-only in phase 3)", () => {
    const orders = sizeOrders([signal("A", -0.9)], ctx({ heldQuantity: () => 300 }))
    expect(orders[0]).toEqual({ securityId: "A", side: "sell", quantity: 300, currency: "USD" })
  })
})
