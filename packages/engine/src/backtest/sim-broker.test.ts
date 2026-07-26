import { describe, expect, it } from "vitest"

import type { Mic } from "../data/symbols.js"
import type { Currency } from "../data/types.js"
import type { Order } from "../types.js"
import { Book, type BookValuation } from "./book.js"
import type { MarketPrices } from "./pricebook.js"
import { SimBroker } from "./sim-broker.js"

const US = "US-XNAS-SYNA"
const OSLO = "NO-XOSL-OSYN"

interface StubConfig {
  readonly securities: Record<string, { mic: Mic; currency: Currency }>
  readonly closes: Record<string, Record<string, number>>
  readonly rates: Record<string, number> // currency → base multiplier
  readonly baseCurrency: Currency
}

function stubPrices(cfg: StubConfig): MarketPrices {
  return {
    micOf: (id) => cfg.securities[id]?.mic as Mic,
    currencyOf: (id) => cfg.securities[id]?.currency as Currency,
    closeOn: (id, date) => cfg.closes[id]?.[date] ?? null,
    markOn: (id, date) => {
      const series = cfg.closes[id] ?? {}
      const dates = Object.keys(series).filter((d) => d <= date).sort()
      const last = dates[dates.length - 1]
      return last ? (series[last] as number) : null
    },
    rateToBase: (currency) => (currency === cfg.baseCurrency ? 1 : (cfg.rates[currency] ?? 1)),
  }
}

function order(securityId: string, side: "buy" | "sell", quantity: number, currency: Currency): Order {
  return { securityId, side, quantity, currency }
}

describe("SimBroker execution", () => {
  it("fills at the next session's close with slippage worsening the price", async () => {
    const book = new Book({ USD: 1_000_000 })
    const prices = stubPrices({
      securities: { [US]: { mic: "XNAS", currency: "USD" } },
      closes: { [US]: { "2020-05-20": 100 } },
      rates: {},
      baseCurrency: "USD",
    })
    const broker = new SimBroker({ book, prices, baseCurrency: "USD", costs: { slippageBps: 50, commissionPerTrade: 0 } })
    const fills = await broker.execute([order(US, "buy", 10, "USD")], "2020-05-20")
    // 50 bps slippage on a buy → 100 × 1.005 = 100.5
    expect(fills[0]?.price).toBeCloseTo(100.5, 9)
    expect(fills[0]?.filledAt).toBe("2020-05-20T21:00:00Z")
    expect(book.position(US)?.quantity).toBe(10)
  })

  it("maintains the accounting invariant after every fill (money conserved minus costs)", async () => {
    const book = new Book({ USD: 1_000_000 })
    const prices = stubPrices({
      securities: {
        [US]: { mic: "XNAS", currency: "USD" },
        [OSLO]: { mic: "XOSL", currency: "NOK" },
      },
      closes: { [US]: { "2020-05-20": 100 }, [OSLO]: { "2020-05-20": 200 } },
      rates: { NOK: 0.1 },
      baseCurrency: "USD",
    })
    const startEquity = 1_000_000
    const rawCloseValuation: BookValuation = {
      markPrice: (id) => prices.closeOn(id, "2020-05-20") ?? 0,
      rateToBase: (c) => prices.rateToBase(c, "2020-05-20"),
    }
    const broker: SimBroker = new SimBroker({
      book,
      prices,
      baseCurrency: "USD",
      costs: { slippageBps: 20, commissionPerTrade: 1, fxSpreadBps: 15 },
      onFill: (_fill, b) => {
        // Value positions at the raw close: equity == start − all explicit costs,
        // to within minor-unit cash rounding (money is never created/destroyed
        // beyond the documented per-mutation rounding).
        const equity = b.equityInBase(rawCloseValuation, "USD")
        expect(Math.abs(equity - (startEquity - broker.costsBase))).toBeLessThan(0.01)
      },
    })
    // A USD buy and a cross-currency (NOK) buy funded from USD cash.
    await broker.execute([order(US, "buy", 100, "USD"), order(OSLO, "buy", 50, "NOK")], "2020-05-20")
    expect(book.position(OSLO)?.quantity).toBe(50)
    expect(book.cash("USD")).toBeGreaterThan(0)
  })

  it("clips a buy to the cash available and never goes negative", async () => {
    const book = new Book({ USD: 1_050 })
    const prices = stubPrices({
      securities: { [US]: { mic: "XNAS", currency: "USD" } },
      closes: { [US]: { "2020-05-20": 100 } },
      rates: {},
      baseCurrency: "USD",
    })
    const broker = new SimBroker({ book, prices, baseCurrency: "USD", costs: { slippageBps: 0, commissionPerTrade: 10 } })
    const fills = await broker.execute([order(US, "buy", 100, "USD")], "2020-05-20")
    // (1050 − 10 commission) / 100 = 10.4 → 10 shares.
    expect(fills[0]?.quantity).toBe(10)
    expect(book.cash("USD")).toBe(1_050 - 10 * 100 - 10)
    expect(book.cash("USD")).toBeGreaterThanOrEqual(0)
  })

  it("funds a cross-currency buy by converting base cash with a spread", async () => {
    const book = new Book({ USD: 100_000 }) // no NOK cash
    const prices = stubPrices({
      securities: { [OSLO]: { mic: "XOSL", currency: "NOK" } },
      closes: { [OSLO]: { "2020-05-20": 200 } },
      rates: { NOK: 0.1 },
      baseCurrency: "USD",
    })
    const broker = new SimBroker({ book, prices, baseCurrency: "USD", costs: { slippageBps: 0, commissionPerTrade: 0, fxSpreadBps: 100 } })
    const fills = await broker.execute([order(OSLO, "buy", 10, "NOK")], "2020-05-20")
    expect(fills[0]?.currency).toBe("NOK")
    expect(book.position(OSLO)?.quantity).toBe(10)
    // 10 × 200 = 2000 NOK needed; USD spent = 2000×0.1×(1+0.01) = 202.
    expect(book.cash("USD")).toBe(100_000 - 202)
    expect(book.cash("NOK")).toBe(0)
  })

  it("skips a sell of a security not held and one with no session that day", async () => {
    const book = new Book({ USD: 1_000 })
    const prices = stubPrices({
      securities: { [US]: { mic: "XNAS", currency: "USD" } },
      closes: { [US]: { "2020-05-20": 100 } },
      rates: {},
      baseCurrency: "USD",
    })
    const broker = new SimBroker({ book, prices, baseCurrency: "USD" })
    const noSession = await broker.execute([order(US, "buy", 1, "USD")], "2020-05-21")
    expect(noSession).toEqual([])
    const noHolding = await broker.execute([order(US, "sell", 5, "USD")], "2020-05-20")
    expect(noHolding).toEqual([])
  })
})
