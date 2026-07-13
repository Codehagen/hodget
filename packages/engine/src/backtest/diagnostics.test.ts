import { describe, expect, it } from "vitest"

import { notCovered, type MarketData } from "../data/market-data.js"
import type { Analyst, AnalystContext, Fill, Signal } from "../types.js"
import { createTradingCalendar } from "./calendar.js"
import { runBacktest } from "./engine.js"
import { computeTradeDiagnostics } from "./metrics.js"
import { createPriceBook } from "./pricebook.js"

function fill(overrides: Partial<Fill> & Pick<Fill, "securityId" | "side" | "quantity" | "price" | "filledAt">): Fill {
  return { currency: "USD", commission: 0, ...overrides }
}

describe("computeTradeDiagnostics", () => {
  it("summarizes wins, losses, profit factor and holding days (FIFO, hand-computed)", () => {
    const trades: Fill[] = [
      // Winner on A: buy 10@100, sell 10@120 five days later → +200 over 5 days.
      fill({ securityId: "A", side: "buy", quantity: 10, price: 100, filledAt: "2020-06-01T21:00:00Z" }),
      fill({ securityId: "A", side: "sell", quantity: 10, price: 120, filledAt: "2020-06-06T21:00:00Z" }),
      // Loser on B: buy 10@100, sell 10@90 two days later → −100 over 2 days.
      fill({ securityId: "B", side: "buy", quantity: 10, price: 100, filledAt: "2020-06-01T21:00:00Z" }),
      fill({ securityId: "B", side: "sell", quantity: 10, price: 90, filledAt: "2020-06-03T21:00:00Z" }),
    ]
    const d = computeTradeDiagnostics(trades)
    expect(d.wins).toBe(1)
    expect(d.losses).toBe(1)
    expect(d.avgWin).toBeCloseTo(200, 9)
    expect(d.avgLoss).toBeCloseTo(-100, 9)
    expect(d.profitFactor).toBeCloseTo(2, 9)
    expect(d.avgHoldingDays).toBeCloseTo(3.5, 9) // (5 + 2) / 2
  })

  it("reports Infinity profit factor when there are no losing trades", () => {
    const trades: Fill[] = [
      fill({ securityId: "A", side: "buy", quantity: 1, price: 100, filledAt: "2020-06-01T21:00:00Z" }),
      fill({ securityId: "A", side: "sell", quantity: 1, price: 110, filledAt: "2020-06-02T21:00:00Z" }),
    ]
    expect(computeTradeDiagnostics(trades).profitFactor).toBe(Infinity)
  })
})

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

describe("computeAttribution — sums to total PnL", () => {
  it("per-symbol realized + unrealized equals the run's total base PnL (USD, no dividends)", async () => {
    const DATES = ["2020-06-01", "2020-06-02", "2020-06-03", "2020-06-04", "2020-06-05"]
    const CLOSES: Record<string, number[]> = {
      A: [100, 101, 103, 106, 110],
      B: [50, 49, 48, 52, 55],
    }
    const prices = createPriceBook({
      securities: [
        { securityId: "A", mic: "XNAS", currency: "USD" },
        { securityId: "B", mic: "XNAS", currency: "USD" },
      ],
      prices: Object.fromEntries(
        Object.entries(CLOSES).map(([id, closes]) => [
          id,
          DATES.map((date, i) => ({
            securityId: id,
            date,
            knownAt: `${date}T20:00:00Z`,
            close: closes[i] as number,
            adjClose: closes[i] as number,
            adjustmentFactor: 1,
            currency: "USD" as const,
          })),
        ]),
      ),
      fx: {},
      baseCurrency: "USD",
    })

    const result = await runBacktest({
      analyst: constantAnalyst(0.8),
      securityIds: ["A", "B"],
      data: emptyData,
      prices,
      calendar: createTradingCalendar({ XNAS: DATES }),
      corporateActions: {},
      baseCurrency: "USD",
      initialCash: { USD: 1_000_000 },
      range: { from: DATES[0] as string, to: DATES[DATES.length - 1] as string },
      costs: { commissionPerTrade: 0, slippageBps: 0, fxSpreadBps: 0 },
    })

    const initial = result.equityCurve[0]?.equity ?? 0
    const final = result.equityCurve[result.equityCurve.length - 1]?.equity ?? 0
    const totalPnl = final - initial
    const attributed = result.diagnostics.attribution.reduce((s, a) => s + a.totalBase, 0)

    expect(result.diagnostics.attribution.length).toBeGreaterThan(0)
    expect(attributed).toBeCloseTo(totalPnl, 4)
  })
})
