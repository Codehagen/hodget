import { describe, expect, it } from "vitest"

import { Book, type BookValuation } from "../backtest/book.js"
import { createTradingCalendar } from "../backtest/calendar.js"
import { FIXED_UNIVERSE_CAVEAT, type BacktestResult } from "../backtest/engine.js"
import type { BacktestMetrics } from "../backtest/metrics.js"
import { createPriceBook, type MarketPrices } from "../backtest/pricebook.js"
import { createConvictionCommittee } from "../committee/committee.js"
import { notCovered, type MarketData } from "../data/market-data.js"
import type { Currency } from "../data/types.js"
import { InMemoryLedger } from "../ledger/ledger.js"
import { createRiskEngine, type RiskConfig, type RiskPosition } from "../risk/gates.js"
import type { ConstructionConfig } from "../portfolio/construct.js"
import type { WalkForwardReport, WindowOutcome } from "../validation/walk-forward.js"
import { promoteToPaper, type StrategyConfig } from "../promotion/workflow.js"
import { runCycle, type CycleClock } from "../cycle/run-cycle.js"
import type { Analyst, AnalystContext, Fill, Order, Signal } from "../types.js"
import { createPaperClock } from "./paper-clock.js"
import { PaperBroker } from "./paper-broker.js"

const SEC = "US-A"
const CUTOFF = "23:00:00Z"
// Five decision days; a sixth calendar session (D5) exists so the last decision's
// order has a real next-session fill target that the loop never reaches.
const DECISION_DAYS = ["2020-06-01", "2020-06-02", "2020-06-03", "2020-06-04", "2020-06-05"]
const D5 = "2020-06-08"
const CALENDAR_DAYS = [...DECISION_DAYS, D5]
const CLOSES = [100, 101, 103, 102, 104]
const RANGE = { from: DECISION_DAYS[0] as string, to: DECISION_DAYS[DECISION_DAYS.length - 1] as string }
const CONSTRUCTION: ConstructionConfig = { maxWeightPerName: 0.2, maxGross: 1 }
const RISK: RiskConfig = { maxPositionPct: 0.5, maxGross: 1, volScaling: false, correlation: false }
const ZERO_COSTS = { commissionPerTrade: 0, slippageBps: 0, fxSpreadBps: 0 }

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
      return { analystId: "test.constant", securityId: ctx.securityId, asOf: ctx.asOf, conviction, horizonDays: 20, thesis: "constant", abstained: false }
    },
  }
}

function prices(): MarketPrices {
  return createPriceBook({
    securities: [{ securityId: SEC, mic: "XNAS", currency: "USD" }],
    prices: {
      [SEC]: DECISION_DAYS.map((date, i) => ({
        securityId: SEC,
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

/** A view of `prices` as known at `today`: sessions after `today` have not priced. */
function pricesAsOf(source: MarketPrices, today: string): MarketPrices {
  return {
    micOf: (id) => source.micOf(id),
    currencyOf: (id) => source.currencyOf(id),
    closeOn: (id, date) => (date <= today ? source.closeOn(id, date) : null),
    markOn: (id, date) => source.markOn(id, date <= today ? date : today),
    rateToBase: (currency, date) => source.rateToBase(currency, date <= today ? date : today),
  }
}

// --- The promotion-produced session, run over a few paper sessions ------------

function passingReport(): WalkForwardReport {
  const stubMetrics: BacktestMetrics = {
    totalReturn: 0.05, annualizedReturn: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, winRate: 0, turnover: 0, costDrag: 0, tradingDays: 0,
  }
  const stubResult: BacktestResult = {
    baseCurrency: "USD",
    equityCurve: [],
    metrics: stubMetrics,
    diagnostics: { tradeStats: { wins: 0, losses: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, avgHoldingDays: 0 }, attribution: [] },
    trades: Array.from({ length: 10 }, () => ({
      fill: { securityId: SEC, side: "buy" as const, quantity: 1, price: 100, currency: "USD" as const, filledAt: "2020-01-01T21:00:00Z", commission: 0 },
      view: { securityId: SEC, asOf: "2020-01-01T23:00:00Z", conviction: 0.5, horizonDays: 20, contributingAnalystIds: ["x"] },
    })),
    corporateActions: [],
    caveats: [FIXED_UNIVERSE_CAVEAT],
  }
  const test: WindowOutcome[] = Array.from({ length: 4 }, (_v, i) => ({
    window: { label: `test-${i + 1}`, kind: "test" as const, range: { from: "2020-01-01", to: "2020-03-31" } },
    metrics: stubMetrics,
    result: stubResult,
  }))
  return { train: null, test, windows: test, aggregate: { windows: 4, meanTotalReturn: 0.05, meanSharpe: 1.2, meanWinRate: 0.6, worstDrawdown: 0.1 } }
}

describe("paper session — a promoted strategy driven by runCycle over several sessions", () => {
  it("records a decision per session and settles fills next-session via the paper broker", async () => {
    const config: StrategyConfig = {
      strategyId: "constant-v1",
      securityIds: [SEC],
      baseCurrency: "USD",
      construction: CONSTRUCTION,
      risk: RISK,
      costs: ZERO_COSTS,
      cutoffTime: CUTOFF,
      caveats: [FIXED_UNIVERSE_CAVEAT],
    }
    const promotion = promoteToPaper({
      config,
      report: passingReport(),
      start: { startDate: RANGE.from, initialCash: { USD: 1_000_000 } },
      now: () => "2026-07-13T00:00:00Z",
    })
    expect(promotion.stage).toBe("paper")
    const session = promotion.session
    if (session === null) throw new Error("expected a promoted paper session")

    const book = new Book(session.start.initialCash)
    const priceBook = prices()
    const calendar = createTradingCalendar({ XNAS: CALENDAR_DAYS })
    const broker = new PaperBroker({ book, baseCurrency: session.config.baseCurrency, costs: session.config.costs ?? {} })
    const committee = createConvictionCommittee()
    const risk = createRiskEngine(session.config.risk ?? {})
    const panel = [constantAnalyst(0.9)]
    const ledger = new InMemoryLedger()

    const valuationAt = (day: string): BookValuation => ({
      markPrice: (id) => priceBook.markOn(id, day) ?? 0,
      rateToBase: (c) => priceBook.rateToBase(c, day),
    })

    // Orders awaiting settlement, tagged with the decision that intended them, so a
    // settled fill can be backfilled onto the right ledger record (the db layer will
    // persist this same attribution).
    const scheduled: { asOf: string; order: Order; fillDate: string }[] = []
    const attach = (fills: readonly Fill[]): void => {
      for (const fill of fills) {
        const date = fill.filledAt.slice(0, 10)
        const idx = scheduled.findIndex(
          (s) => s.fillDate === date && s.order.securityId === fill.securityId && s.order.side === fill.side,
        )
        if (idx < 0) continue
        const entry = scheduled[idx] as (typeof scheduled)[number]
        ledger.attachFills(entry.asOf, [fill])
        scheduled.splice(idx, 1)
      }
    }

    for (const day of calendar.tradingDays("XNAS", RANGE)) {
      // Settle orders whose fill session has priced as of today, then backfill fills.
      attach(broker.settle(pricesAsOf(priceBook, day)))

      const equityBase = book.equityInBase(valuationAt(day), "USD")
      const positions: RiskPosition[] = [...book.positions()].map(([securityId, p]) => ({ securityId, quantity: p.quantity, currency: p.currency }))
      const markPrice = (id: string): number | null => priceBook.markOn(id, day)
      const rateToBase = (c: Currency): number => priceBook.rateToBase(c, day)
      const heldQuantity = (id: string): number => book.position(id)?.quantity ?? 0

      const clock: CycleClock = createPaperClock({
        now: () => `${day}T12:00:00Z`,
        calendar,
        securities: [{ securityId: SEC, mic: "XNAS" }],
        cutoffTime: CUTOFF,
      })

      const decision = await runCycle({
        clock,
        data: emptyData,
        panel,
        committee,
        construction: { currencyOf: () => "USD", hasMark: (id) => priceBook.markOn(id, day) !== null },
        constructionConfig: session.config.construction ?? {},
        sizing: { equityBase, markPrice, rateToBase, heldQuantity },
        risk,
        riskContext: { equityBase, markPrice, rateToBase, heldQuantity, positions: () => positions, realizedVol: () => null, averageCorrelation: () => null },
        broker,
        ledger,
      })

      for (const order of decision.orders) {
        const fillDate = clock.fillDate(order.securityId)
        if (fillDate !== null) scheduled.push({ asOf: decision.asOf, order, fillDate })
      }
    }

    // Every session recorded a decision, keyed by its cutoff.
    const decisions = ledger.decisions()
    expect(decisions).toHaveLength(DECISION_DAYS.length)
    expect(decisions.map((d) => d.asOf)).toEqual(DECISION_DAYS.map((d) => `${d}T${CUTOFF}`))

    // The paper broker actually moved the book — the opening buy settled next-session.
    expect(book.position(SEC)?.quantity ?? 0).toBeGreaterThan(0)

    // Fills were backfilled onto the decisions that intended them (never same-bar:
    // a decision at day D fills at D+1, so its fills attach on a later iteration).
    const withFills = decisions.filter((d) => d.fills.length > 0)
    expect(withFills.length).toBeGreaterThan(0)
    for (const d of withFills) {
      for (const fill of d.fills) {
        expect(fill.filledAt.slice(0, 10) > d.asOf.slice(0, 10)).toBe(true)
      }
    }

    // The final decision's order rests: its fill session (D5) never arrived in the loop.
    expect(broker.pending().length).toBeGreaterThan(0)
    expect(broker.pending().every((p) => p.fillDate === D5)).toBe(true)
  })
})
