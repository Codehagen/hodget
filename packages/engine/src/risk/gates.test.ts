import { describe, expect, it } from "vitest"

import type { Currency } from "../data/types.js"
import type { Order } from "../types.js"
import { createRiskEngine, type RiskContext, type RiskPosition } from "./gates.js"

function ctx(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    equityBase: 1_000_000,
    markPrice: () => 100,
    rateToBase: () => 1,
    heldQuantity: () => 0,
    positions: () => [],
    realizedVol: () => null,
    averageCorrelation: () => null,
    ...overrides,
  }
}

function buy(securityId: string, quantity: number, currency: Currency = "USD"): Order {
  return { securityId, side: "buy", quantity, currency }
}

describe("createRiskEngine — max position", () => {
  it("clips a maximal-conviction order to the hard cap and records the clip", () => {
    // Order sized at full conviction (1000 @ 100 = 100k = 10% of equity) is still
    // clipped by the 5% hard cap. Gates fire regardless of how sure the panel was.
    const engine = createRiskEngine({ maxPositionPct: 0.05, volScaling: false, correlation: false })
    const { orders, actions } = engine.apply([buy("A", 1000)], ctx())
    // cap = 0.05 × 1e6 / 100 = 500 shares.
    expect(orders).toEqual([buy("A", 500)])
    expect(actions).toEqual([
      {
        gate: "max-position",
        securityId: "A",
        action: "clip",
        before: 1000,
        after: 500,
        reason: expect.stringContaining("exceeds cap 500"),
      },
    ])
  })

  it("vetoes a buy when the holding already fills the cap", () => {
    const engine = createRiskEngine({ maxPositionPct: 0.05, volScaling: false, correlation: false })
    const { orders, actions } = engine.apply([buy("A", 100)], ctx({ heldQuantity: () => 500 }))
    expect(orders).toEqual([])
    expect(actions[0]?.action).toBe("veto")
    expect(actions[0]?.after).toBe(0)
  })

  it("never clips sells — they only reduce exposure", () => {
    const engine = createRiskEngine({ maxPositionPct: 0.01, volScaling: false, correlation: false })
    const sell: Order = { securityId: "A", side: "sell", quantity: 9999, currency: "USD" }
    const { orders, actions } = engine.apply([sell], ctx({ heldQuantity: () => 9999 }))
    expect(orders).toEqual([sell])
    expect(actions).toEqual([])
  })
})

describe("createRiskEngine — vol-scaled × correlation", () => {
  it("clips using the vol-scaled cap and labels the gate", () => {
    // High realized vol → 5% cap. 1000 @ 100 (10%) clips to 500.
    const engine = createRiskEngine({ correlation: false })
    const { orders, actions } = engine.apply([buy("A", 1000)], ctx({ realizedVol: () => 0.8 }))
    expect(orders).toEqual([buy("A", 500)])
    expect(actions[0]?.gate).toBe("vol-scaled-position")
  })

  it("shrinks the cap by the correlation multiplier", () => {
    // Vol null → base cap 0.2; avg corr 1 → ×0.7 → effective 0.14 → 1400 shares.
    const engine = createRiskEngine({ volScaling: false })
    const { orders, actions } = engine.apply(
      [buy("A", 2000)],
      ctx({ averageCorrelation: () => 1 }),
    )
    // cap = 0.14 × 1e6 / 100 = 1400.
    expect(orders).toEqual([buy("A", 1400)])
    expect(actions[0]?.gate).toBe("vol-scaled-position")
  })

  it("does not clip when the resulting position sits under the dynamic cap", () => {
    const engine = createRiskEngine()
    // Quiet name (10% vol → 25% cap), small order → no action.
    const { orders, actions } = engine.apply([buy("A", 100)], ctx({ realizedVol: () => 0.1 }))
    expect(orders).toEqual([buy("A", 100)])
    expect(actions).toEqual([])
  })
})

describe("createRiskEngine — gross exposure", () => {
  it("scales buys down when total resulting gross exceeds the cap", () => {
    // Two fresh names, each 6000 @ 100 = 600k → 1.2M gross > 1.0M cap.
    const engine = createRiskEngine({
      maxPositionPct: 1,
      maxGross: 1,
      volScaling: false,
      correlation: false,
    })
    const { orders, actions } = engine.apply([buy("A", 6000), buy("B", 6000)], ctx())
    const gross = orders.reduce((s, o) => s + o.quantity * 100, 0)
    expect(gross).toBeLessThanOrEqual(1_000_000)
    expect(actions.some((a) => a.gate === "max-gross")).toBe(true)
  })

  it("counts existing holdings toward the gross cap", () => {
    const positions: RiskPosition[] = [{ securityId: "H", quantity: 9000, currency: "USD" }]
    const engine = createRiskEngine({
      maxPositionPct: 1,
      maxGross: 1,
      volScaling: false,
      correlation: false,
    })
    // Held 9000 @ 100 = 900k; a 2000-share buy (200k) would push gross to 1.1M.
    const { orders } = engine.apply(
      [buy("A", 2000)],
      ctx({ positions: () => positions, heldQuantity: (id) => (id === "H" ? 9000 : 0) }),
    )
    const buyA = orders.find((o) => o.securityId === "A")
    expect((buyA?.quantity ?? 0) * 100).toBeLessThanOrEqual(100_000)
  })
})
