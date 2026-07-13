import { describe, expect, it } from "vitest"

import type { FxRate, Price } from "../data/types.js"
import { createPriceBook } from "./pricebook.js"

const OSLO = "NO-XOSL-OSYN"

function price(date: string, close: number): Price {
  return {
    securityId: OSLO,
    date,
    knownAt: `${date}T16:00:00Z`,
    close,
    adjClose: close,
    adjustmentFactor: 1,
    currency: "NOK",
  }
}

function fx(date: string, rate: number): FxRate {
  return { pair: "NOKUSD", date, knownAt: `${date}T12:00:00Z`, rate }
}

const book = createPriceBook({
  securities: [{ securityId: OSLO, mic: "XOSL", currency: "NOK" }],
  prices: { [OSLO]: [price("2020-05-18", 180), price("2020-05-20", 185)] },
  fx: { NOKUSD: [fx("2020-05-18", 0.1), fx("2020-05-20", 0.11)] },
  baseCurrency: "USD",
})

describe("createPriceBook", () => {
  it("returns the exact session close, or null off-session", () => {
    expect(book.closeOn(OSLO, "2020-05-18")).toBe(180)
    expect(book.closeOn(OSLO, "2020-05-19")).toBeNull()
  })

  it("carries the last close forward for mark-to-market on non-trading days", () => {
    expect(book.markOn(OSLO, "2020-05-19")).toBe(180)
    expect(book.markOn(OSLO, "2020-05-21")).toBe(185)
    expect(book.markOn(OSLO, "2020-05-17")).toBeNull()
  })

  it("resolves a direct FX pair to base, carried forward", () => {
    expect(book.rateToBase("NOK", "2020-05-18")).toBeCloseTo(0.1, 12)
    expect(book.rateToBase("NOK", "2020-05-19")).toBeCloseTo(0.1, 12) // carry forward
    expect(book.rateToBase("NOK", "2020-05-20")).toBeCloseTo(0.11, 12)
  })

  it("treats the base currency as rate 1", () => {
    expect(book.rateToBase("USD", "2020-05-20")).toBe(1)
  })

  it("inverts a pair quoted the other way when the direct pair is absent", () => {
    const inverse = createPriceBook({
      securities: [{ securityId: OSLO, mic: "XOSL", currency: "NOK" }],
      prices: {},
      fx: { USDNOK: [fx("2020-05-18", 10)] }, // 10 NOK per USD → NOK→USD = 0.1
      baseCurrency: "USD",
    })
    expect(inverse.rateToBase("NOK", "2020-05-18")).toBeCloseTo(0.1, 12)
  })

  it("throws when no FX path to base exists", () => {
    expect(() => book.rateToBase("NOK" as never, "2020-05-18")).not.toThrow()
    const none = createPriceBook({ securities: [], prices: {}, fx: {}, baseCurrency: "USD" })
    expect(() => none.rateToBase("NOK", "2020-05-18")).toThrow(/no FX rate/)
  })
})
