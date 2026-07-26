import { describe, expect, it } from "vitest"

import type { GateAction } from "../risk/gates.js"
import type { Fill, Order, Signal, TargetView, TargetWeight } from "../types.js"
import { InMemoryLedger, type DecisionRecord } from "./ledger.js"

function record(): DecisionRecord {
  const signals: Signal[] = [
    { analystId: "a", securityId: "A", asOf: "2020-05-19T23:00:00Z", conviction: 0.9, horizonDays: 20, thesis: "buy", abstained: false },
  ]
  const views: TargetView[] = [
    { securityId: "A", asOf: "2020-05-19T23:00:00Z", conviction: 0.9, horizonDays: 20, contributingAnalystIds: ["a"] },
  ]
  const targetWeights: TargetWeight[] = [{ securityId: "A", currency: "USD", weight: 0.18 }]
  const orders: Order[] = [{ securityId: "A", side: "buy", quantity: 1800, currency: "USD" }]
  const gateActions: GateAction[] = []
  const fills: Fill[] = [
    { securityId: "A", side: "buy", quantity: 1800, price: 100, currency: "USD", filledAt: "2020-05-20T21:00:00Z", commission: 1 },
  ]
  return { asOf: "2020-05-19T23:00:00Z", signals, views, targetWeights, orders, gateActions, fills }
}

describe("InMemoryLedger", () => {
  it("records and reconstructs a decision (signals, views, gate actions, fills)", () => {
    const ledger = new InMemoryLedger()
    ledger.record(record())
    const decisions = ledger.decisions()
    expect(decisions).toHaveLength(1)
    const d = decisions[0]
    expect(d?.signals[0]?.analystId).toBe("a")
    expect(d?.views[0]?.conviction).toBe(0.9)
    expect(d?.orders[0]?.quantity).toBe(1800)
    expect(d?.fills[0]?.filledAt).toBe("2020-05-20T21:00:00Z")
  })

  it("copies on record — later mutation of the source cannot alter the log", () => {
    const ledger = new InMemoryLedger()
    const source = record()
    ledger.record(source)
    ;(source.orders as Order[]).push({ securityId: "Z", side: "sell", quantity: 1, currency: "USD" })
    expect(ledger.decisions()[0]?.orders).toHaveLength(1)
  })

  it("deep-freezes: mutating a retained nested input object cannot alter the log", () => {
    const ledger = new InMemoryLedger()
    const source = record()
    ledger.record(source)
    // Reach into a nested object the caller still holds and change it in place.
    ;(source.signals[0] as { conviction: number }).conviction = -1
    ;(source.orders[0] as { quantity: number }).quantity = 999
    const recorded = ledger.decisions()[0]
    expect(recorded?.signals[0]?.conviction).toBe(0.9)
    expect(recorded?.orders[0]?.quantity).toBe(1800)
  })

  it("attachFills backfills settled fills onto the decision recorded at that asOf", () => {
    const ledger = new InMemoryLedger()
    const base = { ...record(), fills: [] as Fill[] }
    ledger.record(base)
    expect(ledger.decisions()[0]?.fills).toHaveLength(0)

    const fill: Fill = {
      securityId: "A", side: "buy", quantity: 1800, price: 100, currency: "USD",
      filledAt: "2020-05-20T21:00:00Z", commission: 1,
    }
    ledger.attachFills(base.asOf, [fill])
    expect(ledger.decisions()[0]?.fills).toHaveLength(1)
    expect(ledger.decisions()[0]?.fills[0]?.filledAt).toBe("2020-05-20T21:00:00Z")

    // A second settlement session for the same decision appends, never replaces.
    ledger.attachFills(base.asOf, [{ ...fill, securityId: "B", filledAt: "2020-05-21T21:00:00Z" }])
    expect(ledger.decisions()[0]?.fills.map((f) => f.securityId)).toEqual(["A", "B"])
  })

  it("attachFills throws when no decision was recorded at the asOf", () => {
    const ledger = new InMemoryLedger()
    expect(() => ledger.attachFills("2099-01-01T23:00:00Z", [])).toThrow(/no decision recorded/)
  })

  it("preserves insertion order across many decisions", () => {
    const ledger = new InMemoryLedger()
    for (let i = 0; i < 3; i++) ledger.record({ ...record(), asOf: `2020-05-2${i}T23:00:00Z` })
    expect(ledger.decisions().map((d) => d.asOf)).toEqual([
      "2020-05-20T23:00:00Z",
      "2020-05-21T23:00:00Z",
      "2020-05-22T23:00:00Z",
    ])
  })
})
