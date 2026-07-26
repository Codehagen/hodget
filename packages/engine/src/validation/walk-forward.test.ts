import { describe, expect, it } from "vitest"

import { runBacktest } from "../backtest/engine.js"
import { createTradingCalendar } from "../backtest/calendar.js"
import { createPriceBook } from "../backtest/pricebook.js"
import { notCovered, type DateRange, type MarketData } from "../data/market-data.js"
import type { Analyst, AnalystContext, Signal } from "../types.js"
import { splitWindows, walkForward } from "./walk-forward.js"

const emptyData: MarketData = {
  prices: async () => notCovered(),
  fundamentals: async () => notCovered(),
  earnings: async () => notCovered(),
  news: async () => notCovered(),
  insiderTrades: async () => notCovered(),
  corporateActions: async () => notCovered(),
  fxRate: async () => notCovered(),
}

function constantAnalyst(conviction: number): Analyst {
  return {
    id: "test.constant",
    kind: "quant",
    async predict(ctx: AnalystContext): Promise<Signal> {
      return {
        analystId: "test.constant",
        securityId: ctx.securityId,
        asOf: ctx.asOf,
        conviction,
        horizonDays: 20,
        thesis: null,
        abstained: false,
      }
    },
  }
}

/** 20 sequential trading days: price rises for the first 10, falls for the last 10. */
const DATES = Array.from({ length: 20 }, (_, i) => `2020-06-${String(i + 1).padStart(2, "0")}`)
const CLOSES = DATES.map((_, i) => (i < 10 ? 100 + 5 * i : 145 - 5 * (i - 9)))

function prices() {
  return createPriceBook({
    securities: [{ securityId: "A", mic: "XNAS", currency: "USD" }],
    prices: {
      A: DATES.map((date, i) => ({
        securityId: "A",
        date,
        knownAt: `${date}T20:00:00Z`,
        close: CLOSES[i] as number,
        adjClose: CLOSES[i] as number,
        adjustmentFactor: 1,
        currency: "USD" as const,
      })),
    },
    fx: {},
    baseCurrency: "USD",
  })
}

describe("splitWindows", () => {
  it("carves one train window and sequential test windows", () => {
    const days = Array.from({ length: 10 }, (_, i) => `d${i}`)
    const windows = splitWindows(days, { trainFraction: 0.6, testWindows: 2 })
    expect(windows.map((w) => `${w.kind}:${w.range.from}-${w.range.to}`)).toEqual([
      "train:d0-d5",
      "test:d6-d7",
      "test:d8-d9",
    ])
  })

  it("defaults to a single frozen-holdout test window", () => {
    const days = Array.from({ length: 4 }, (_, i) => `d${i}`)
    const windows = splitWindows(days)
    expect(windows.filter((w) => w.kind === "test")).toHaveLength(1)
  })

  it("throws when there are too few days to split", () => {
    expect(() => splitWindows(["d0"], { testWindows: 2 })).toThrow()
  })
})

describe("walkForward on a known regime change", () => {
  it("profits in-sample but degrades out-of-sample when the trend flips", async () => {
    const priceBook = prices()
    const run = (range: DateRange) =>
      runBacktest({
        analyst: constantAnalyst(1),
        securityIds: ["A"],
        data: emptyData,
        prices: priceBook,
        calendar: createTradingCalendar({ XNAS: DATES }),
        corporateActions: {},
        baseCurrency: "USD",
        initialCash: { USD: 1_000_000 },
        range,
        costs: { commissionPerTrade: 0, slippageBps: 0, fxSpreadBps: 0 },
      })

    const report = await walkForward({ dates: DATES, run, trainFraction: 0.5, testWindows: 1 })

    // The train window (rising regime) is profitable.
    expect(report.train?.metrics.totalReturn).toBeGreaterThan(0)
    // The frozen holdout (falling regime) loses — the strategy did not generalize.
    expect(report.test).toHaveLength(1)
    expect(report.test[0]?.metrics.totalReturn).toBeLessThan(0)
    // Aggregate out-of-sample return is well below the in-sample return: degradation.
    expect(report.aggregate.meanTotalReturn).toBeLessThan(report.train?.metrics.totalReturn ?? 0)
  })
})
