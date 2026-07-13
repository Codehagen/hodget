import { describe, expect, it } from "vitest"

import { Book } from "../backtest/book.js"
import type { MarketPrices } from "../backtest/pricebook.js"
import { SimBroker } from "../backtest/sim-broker.js"
import type { Mic } from "../data/symbols.js"
import type { Currency } from "../data/types.js"
import type { Order } from "../types.js"
import { PaperBroker } from "./paper-broker.js"

const US = "US-XNAS-SYNA"
const OSLO = "NO-XOSL-OSYN"

interface StubConfig {
  readonly securities: Record<string, { mic: Mic; currency: Currency }>
  /** Closes keyed by securityId then date. An absent date models "not priced yet". */
  readonly closes: Record<string, Record<string, number>>
  readonly rates?: Record<string, number>
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
    rateToBase: (currency) => (currency === cfg.baseCurrency ? 1 : (cfg.rates?.[currency] ?? 1)),
  }
}

function order(securityId: string, side: "buy" | "sell", quantity: number, currency: Currency): Order {
  return { securityId, side, quantity, currency }
}

describe("PaperBroker — next-session settlement", () => {
  it("never fills at submission (no same-bar execution)", async () => {
    const book = new Book({ USD: 1_000_000 })
    const broker = new PaperBroker({ book, baseCurrency: "USD" })

    const fills = await broker.execute([order(US, "buy", 10, "USD")], "2020-05-20")

    expect(fills).toEqual([]) // submission produces no fills
    expect(broker.pending()).toHaveLength(1)
    expect(broker.pending()[0]?.fillDate).toBe("2020-05-20")
    expect(book.position(US)).toBeUndefined() // book untouched until settlement
  })

  it("rests pending until the fill session prices, then settles exactly once", async () => {
    const book = new Book({ USD: 1_000_000 })
    const broker = new PaperBroker({
      book,
      baseCurrency: "USD",
      costs: { slippageBps: 50, commissionPerTrade: 0 },
    })
    const securities = { [US]: { mic: "XNAS" as Mic, currency: "USD" as Currency } }

    await broker.execute([order(US, "buy", 10, "USD")], "2020-05-20")

    // The fill session has not priced yet — the order stays pending, no fill.
    const notYet = broker.settle(stubPrices({ securities, closes: { [US]: {} }, baseCurrency: "USD" }))
    expect(notYet).toEqual([])
    expect(broker.pending()).toHaveLength(1)
    expect(book.position(US)).toBeUndefined()

    // The session prices — the order settles at that close (50 bps slippage on a buy).
    const priced = stubPrices({ securities, closes: { [US]: { "2020-05-20": 100 } }, baseCurrency: "USD" })
    const fills = broker.settle(priced)
    expect(fills).toHaveLength(1)
    expect(fills[0]?.price).toBeCloseTo(100.5, 9)
    expect(fills[0]?.filledAt).toBe("2020-05-20T21:00:00Z")
    expect(book.position(US)?.quantity).toBe(10)
    expect(broker.pending()).toHaveLength(0)

    // Settling again with the same price never double-fills.
    expect(broker.settle(priced)).toEqual([])
    expect(book.position(US)?.quantity).toBe(10)
  })

  it("mirrors the sim broker's fill (same price, quantity, and commission)", async () => {
    const securities = { [US]: { mic: "XNAS" as Mic, currency: "USD" as Currency } }
    const closes = { [US]: { "2020-05-20": 100 } }
    const costs = { slippageBps: 20, commissionPerTrade: 1, fxSpreadBps: 15 }

    const simBook = new Book({ USD: 1_000_000 })
    const sim = new SimBroker({ book: simBook, prices: stubPrices({ securities, closes, baseCurrency: "USD" }), baseCurrency: "USD", costs })
    const simFills = await sim.execute([order(US, "buy", 100, "USD")], "2020-05-20")

    const paperBook = new Book({ USD: 1_000_000 })
    const paper = new PaperBroker({ book: paperBook, baseCurrency: "USD", costs })
    await paper.execute([order(US, "buy", 100, "USD")], "2020-05-20")
    const paperFills = paper.settle(stubPrices({ securities, closes, baseCurrency: "USD" }))

    expect(paperFills).toEqual(simFills)
    expect(paper.costsBase).toBeCloseTo(sim.costsBase, 9)
    expect(paper.tradedNotionalBase).toBeCloseTo(sim.tradedNotionalBase, 9)
    expect(paperBook.cash("USD")).toBe(simBook.cash("USD"))
  })

  it("clips a buy to available cash and drops it once resolved (never rests unfundable)", async () => {
    const book = new Book({ USD: 1_050 })
    const securities = { [US]: { mic: "XNAS" as Mic, currency: "USD" as Currency } }
    const broker = new PaperBroker({ book, baseCurrency: "USD", costs: { slippageBps: 0, commissionPerTrade: 10 } })

    await broker.execute([order(US, "buy", 100, "USD")], "2020-05-20")
    const fills = broker.settle(stubPrices({ securities, closes: { [US]: { "2020-05-20": 100 } }, baseCurrency: "USD" }))

    // (1050 − 10 commission) / 100 = 10.4 → 10 shares; the priced order does not rest.
    expect(fills[0]?.quantity).toBe(10)
    expect(book.cash("USD")).toBe(1_050 - 10 * 100 - 10)
    expect(broker.pending()).toHaveLength(0)
  })

  it("funds a cross-currency buy by converting base cash with a spread (cost mirror)", async () => {
    const book = new Book({ USD: 100_000 })
    const securities = { [OSLO]: { mic: "XOSL" as Mic, currency: "NOK" as Currency } }
    const broker = new PaperBroker({ book, baseCurrency: "USD", costs: { slippageBps: 0, commissionPerTrade: 0, fxSpreadBps: 100 } })

    await broker.execute([order(OSLO, "buy", 10, "NOK")], "2020-05-20")
    const fills = broker.settle(stubPrices({ securities, closes: { [OSLO]: { "2020-05-20": 200 } }, rates: { NOK: 0.1 }, baseCurrency: "USD" }))

    expect(fills[0]?.currency).toBe("NOK")
    expect(book.position(OSLO)?.quantity).toBe(10)
    // 10 × 200 = 2000 NOK; USD spent = 2000 × 0.1 × (1 + 0.01) = 202.
    expect(book.cash("USD")).toBe(100_000 - 202)
    expect(book.cash("NOK")).toBe(0)
  })
})
