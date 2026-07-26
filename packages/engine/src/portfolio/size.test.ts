import { describe, expect, it } from "vitest"

import type { Currency } from "../data/types.js"
import type { TargetWeight } from "../types.js"
import { sizeOrders, type SizingContext } from "./size.js"

function weight(securityId: string, w: number, currency: Currency = "USD"): TargetWeight {
  return { securityId, currency, weight: w }
}

function ctx(overrides: Partial<SizingContext> = {}): SizingContext {
  return {
    equityBase: 1_000_000,
    markPrice: () => 100,
    rateToBase: () => 1,
    heldQuantity: () => 0,
    ...overrides,
  }
}

describe("sizeOrders", () => {
  it("sizes whole shares from a target weight (0.18 weight → 1800 @ 100)", () => {
    const orders = sizeOrders([weight("A", 0.18)], ctx())
    expect(orders[0]).toEqual({ securityId: "A", side: "buy", quantity: 1800, currency: "USD" })
  })

  it("floors the target quantity so the sized value never exceeds the weight", () => {
    // 0.2 × 1e6 / 300 = 666.67 → floor 666 (667 × 300 = 200,100 > 200,000 cap).
    const orders = sizeOrders([weight("A", 0.2)], ctx({ markPrice: () => 300 }))
    expect(orders[0]?.quantity).toBe(666)
    expect((orders[0]?.quantity ?? 0) * 300).toBeLessThanOrEqual(0.2 * 1_000_000)
  })

  it("emits a delta order against the current holding", () => {
    const orders = sizeOrders([weight("A", 0.18)], ctx({ heldQuantity: () => 800 }))
    expect(orders[0]).toEqual({ securityId: "A", side: "buy", quantity: 1000, currency: "USD" })
  })

  it("sells to flat on a zero target weight", () => {
    const orders = sizeOrders([weight("A", 0)], ctx({ heldQuantity: () => 500 }))
    expect(orders).toEqual([{ securityId: "A", side: "sell", quantity: 500, currency: "USD" }])
  })

  it("emits no order when the target already matches the holding", () => {
    const orders = sizeOrders([weight("A", 0.18)], ctx({ heldQuantity: () => 1800 }))
    expect(orders).toEqual([])
  })

  it("is per-currency aware: converts a base weight through the FX rate", () => {
    // 0.1 × 1e6 = 100,000 base; NOK rate 0.1 → priceBase = 100×0.1 = 10 → 10,000 shares.
    const orders = sizeOrders(
      [weight("A", 0.1, "NOK")],
      ctx({ rateToBase: (c) => (c === "NOK" ? 0.1 : 1) }),
    )
    expect(orders[0]).toEqual({ securityId: "A", side: "buy", quantity: 10_000, currency: "NOK" })
  })

  it("skips a name with no mark price", () => {
    const orders = sizeOrders([weight("A", 0.2)], ctx({ markPrice: () => null }))
    expect(orders).toEqual([])
  })

  it("sorts sells before buys, then by securityId", () => {
    const orders = sizeOrders(
      [weight("B", 0.18), weight("A", 0)],
      ctx({ heldQuantity: (id) => (id === "A" ? 500 : 0) }),
    )
    expect(orders.map((o) => `${o.side}:${o.securityId}`)).toEqual(["sell:A", "buy:B"])
  })
})
