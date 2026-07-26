import { describe, expect, it } from "vitest"

import { Book, type BookValuation } from "./book.js"

const SEC = "US-XNAS-SYNA"
const OSLO = "NO-XOSL-OSYN"

describe("Book cash + positions", () => {
  it("rounds cash to the minor unit on every mutation", () => {
    const book = new Book({ USD: 100 })
    book.creditCash("USD", 0.005)
    expect(book.cash("USD")).toBe(100.01)
  })

  it("conserves money on a buy: cash spent equals notional + commission", () => {
    const book = new Book({ USD: 10_000 })
    book.buy(SEC, 50, 100, "USD", 1)
    // 50 × 100 + 1 commission debited; position of 50 remains.
    expect(book.cash("USD")).toBe(10_000 - 5_001)
    expect(book.position(SEC)).toEqual({ quantity: 50, currency: "USD" })
  })

  it("credits proceeds net of commission on a sell and clears an emptied position", () => {
    const book = new Book({ USD: 10_000 })
    book.buy(SEC, 50, 100, "USD", 1)
    book.sell(SEC, 50, 110, "USD", 1)
    // proceeds 50×110 − 1 = 5499 credited
    expect(book.cash("USD")).toBe(10_000 - 5_001 + 5_499)
    expect(book.position(SEC)).toBeUndefined()
  })

  it("throws rather than overdraw cash (never fabricates money)", () => {
    const book = new Book({ USD: 100 })
    expect(() => book.debitCash("USD", 101)).toThrow(/overdraw/)
  })

  it("rejects fractional share quantities", () => {
    const book = new Book({ USD: 10_000 })
    expect(() => book.buy(SEC, 1.5, 100, "USD", 0)).toThrow(/whole number/)
  })

  it("refuses to sell more shares than held", () => {
    const book = new Book({ USD: 10_000 })
    book.buy(SEC, 10, 100, "USD", 0)
    expect(() => book.sell(SEC, 11, 100, "USD", 0)).toThrow(/only 10 held/)
  })
})

describe("Book corporate actions", () => {
  it("applies a 2:1 split by doubling the share count", () => {
    const book = new Book({ USD: 10_000 })
    book.buy(SEC, 40, 100, "USD", 0)
    const record = book.applySplit(SEC, 2)
    expect(record).toEqual({ securityId: SEC, ratio: 2, before: 40, after: 80, fractionalDropped: 0 })
    expect(book.position(SEC)?.quantity).toBe(80)
  })

  it("records the fraction dropped by whole-share rounding on a non-integer split", () => {
    const book = new Book({ USD: 10_000 })
    book.buy(SEC, 3, 100, "USD", 0)
    const record = book.applySplit(SEC, 1.5)
    // 3 × 1.5 = 4.5 → 4 shares, 0.5 dropped (never fabricated into cash).
    expect(record.after).toBe(4)
    expect(record.fractionalDropped).toBeCloseTo(0.5, 12)
  })

  it("credits a dividend on the held quantity in the position's currency", () => {
    const book = new Book({ NOK: 0 })
    book.creditCash("NOK", 100_000)
    book.buy(OSLO, 100, 180, "NOK", 0)
    const record = book.applyDividend(OSLO, 5.5, "NOK")
    expect(record.cashCredited).toBe(550)
    expect(book.cash("NOK")).toBe(100_000 - 18_000 + 550)
  })
})

describe("Book FX + valuation", () => {
  it("converts across currencies applying the configured spread", () => {
    const book = new Book({ USD: 1_000 })
    const record = book.convert({ from: "USD", to: "NOK", amountTo: 1_000, fromPerTo: 0.1, spreadBps: 100 })
    // mid cost 100 USD; 100bps spread on 100 = 1 USD → 101 USD for 1000 NOK.
    expect(record.spreadCost).toBeCloseTo(1, 12)
    expect(record.costFrom).toBe(101)
    expect(book.cash("USD")).toBe(899)
    expect(book.cash("NOK")).toBe(1_000)
  })

  it("values cash and positions in base currency at the given FX rates", () => {
    const book = new Book({ USD: 500, NOK: 3_000 })
    book.buy(OSLO, 10, 200, "NOK", 0) // 2000 NOK spent → 1000 NOK left
    const valuation: BookValuation = {
      markPrice: () => 200,
      rateToBase: (currency) => (currency === "NOK" ? 0.1 : 1),
    }
    // 500 USD + 1000 NOK×0.1 + 10×200×0.1 = 500 + 100 + 200 = 800
    expect(book.equityInBase(valuation, "USD")).toBeCloseTo(800, 9)
    expect(book.position(OSLO)?.quantity).toBe(10)
  })
})
