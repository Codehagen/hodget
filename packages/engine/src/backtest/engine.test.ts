import { describe, expect, it } from "vitest"

import { createEarningsDriftAnalyst } from "../analysts/quant/earnings-drift.js"
import { FIXTURE_IDS, loadFixtureDataset } from "../data/fixture/dataset.js"
import { notCovered, type MarketData } from "../data/market-data.js"
import type { Analyst, AnalystContext, Signal } from "../types.js"
import { runBacktest } from "./engine.js"
import { createTradingCalendar } from "./calendar.js"
import { createPriceBook } from "./pricebook.js"
import { runFixtureBacktest } from "./fixture-backtest.js"

/** An analyst that always emits the same conviction — stays invested for testing. */
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
        thesis: "constant",
        abstained: false,
      }
    },
  }
}

/** A MarketData that a data-ignoring analyst never actually reads. */
const emptyData: MarketData = {
  prices: async () => notCovered(),
  fundamentals: async () => notCovered(),
  earnings: async () => notCovered(),
  news: async () => notCovered(),
  insiderTrades: async () => notCovered(),
  corporateActions: async () => notCovered(),
  fxRate: async () => notCovered(),
}

describe("runBacktest — FX affects base-currency equity", () => {
  it("marks a NOK position in base currency using both price and FX", async () => {
    const OSLO = "NO-XOSL-OSYN"
    const days = ["2020-05-18", "2020-05-19", "2020-05-20"]
    const prices = createPriceBook({
      securities: [{ securityId: OSLO, mic: "XOSL", currency: "NOK" }],
      prices: {
        [OSLO]: days.map((date, i) => ({
          securityId: OSLO,
          date,
          knownAt: `${date}T16:00:00Z`,
          close: [100, 100, 110][i] as number,
          adjClose: 100,
          adjustmentFactor: 1,
          currency: "NOK" as const,
        })),
      },
      fx: {
        NOKUSD: days.map((date, i) => ({
          pair: "NOKUSD",
          date,
          knownAt: `${date}T12:00:00Z`,
          rate: [0.1, 0.1, 0.12][i] as number,
        })),
      },
      baseCurrency: "USD",
    })

    const result = await runBacktest({
      analyst: constantAnalyst(1),
      securityIds: [OSLO],
      data: emptyData,
      prices,
      calendar: createTradingCalendar({ XOSL: days }),
      corporateActions: {},
      baseCurrency: "USD",
      initialCash: { NOK: 100_000 },
      range: { from: days[0] as string, to: days[days.length - 1] as string },
      sizing: { maxPositionPct: 1, maxGrossExposure: 1 },
      costs: { commissionPerTrade: 0, slippageBps: 0, fxSpreadBps: 0 },
    })

    const [d1, d2, d3] = result.equityCurve
    // D1: 100000 NOK × 0.10 = 10000 USD (pre-trade).
    expect(d1?.equity).toBeCloseTo(10_000, 6)
    // D2: buy 1000 @ 100 settles; 1000×100×0.10 = 10000 USD.
    expect(d2?.equity).toBeCloseTo(10_000, 6)
    // D3: 1000×110×0.12 = 13200 — moves with BOTH price (110) and FX (0.12).
    // Price-only would be 11000; FX-only would be 12000.
    expect(d3?.equity).toBeCloseTo(13_200, 6)
  })
})

describe("runBacktest over the committed fixtures", () => {
  it("never fills same-bar: every fill settles after its decision cutoff", async () => {
    const dataset = await loadFixtureDataset()
    const result = await runFixtureBacktest(dataset, {
      analyst: createEarningsDriftAnalyst(),
      initialCash: { USD: 1_000_000 },
    })
    expect(result.trades.length).toBeGreaterThan(0)
    for (const trade of result.trades) {
      const decisionDate = trade.signal.asOf.slice(0, 10)
      const fillDate = trade.fill.filledAt.slice(0, 10)
      expect(fillDate > decisionDate).toBe(true)
    }
  })

  it("produces no trade for an always-abstaining symbol (abstain ≠ neutral)", async () => {
    const dataset = await loadFixtureDataset()
    const result = await runFixtureBacktest(dataset, {
      analyst: createEarningsDriftAnalyst(),
      initialCash: { USD: 1_000_000 },
    })
    // The micro-cap has no estimate baseline → earnings-drift always abstains.
    const microTrades = result.trades.filter((t) => t.fill.securityId === FIXTURE_IDS.osloMicroCap)
    expect(microTrades).toEqual([])
  })

  it("marks the whole book on a union day where one exchange is closed", async () => {
    const dataset = await loadFixtureDataset()
    const result = await runFixtureBacktest(dataset, {
      analyst: constantAnalyst(1),
      initialCash: { USD: 1_000_000 },
    })
    // 2020-05-21 is an Oslo holiday but a US trading day — a union day.
    const point = result.equityCurve.find((p) => p.date === "2020-05-21")
    expect(point).toBeDefined()
    expect(point?.equity).toBeGreaterThan(0)
    // No XOSL symbol ever fills on a day its own exchange did not trade.
    const oslo = new Set<string>([FIXTURE_IDS.osloEquity, FIXTURE_IDS.osloMicroCap])
    for (const trade of result.trades) {
      if (oslo.has(trade.fill.securityId)) {
        expect(trade.fill.filledAt.slice(0, 10)).not.toBe("2020-05-21")
      }
    }
  })

  it("applies corporate actions to held positions on their ex-date (split + dividend)", async () => {
    const dataset = await loadFixtureDataset()
    const result = await runFixtureBacktest(dataset, {
      analyst: constantAnalyst(1),
      initialCash: { USD: 1_000_000 },
    })
    const split = result.corporateActions.find((c) => c.type === "split")
    expect(split?.split?.before).toBeGreaterThan(0)
    expect(split?.split?.after).toBe((split?.split?.before ?? 0) * 2)

    const dividend = result.corporateActions.find((c) => c.type === "dividend")
    expect(dividend?.dividend?.cashCredited).toBeGreaterThan(0)
    expect(dividend?.dividend?.currency).toBe("NOK")
  })
})
