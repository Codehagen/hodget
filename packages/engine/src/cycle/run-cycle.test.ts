import { describe, expect, it } from "vitest"

import { Book, type BookValuation } from "../backtest/book.js"
import { createTradingCalendar } from "../backtest/calendar.js"
import { runBacktest } from "../backtest/engine.js"
import { createPriceBook, type MarketPrices } from "../backtest/pricebook.js"
import { SimBroker } from "../backtest/sim-broker.js"
import { createConvictionCommittee } from "../committee/committee.js"
import { notCovered, type MarketData } from "../data/market-data.js"
import type { Currency } from "../data/types.js"
import { InMemoryLedger, type DecisionRecord } from "../ledger/ledger.js"
import { createRiskEngine, type RiskConfig, type RiskPosition } from "../risk/gates.js"
import type { ConstructionConfig } from "../portfolio/construct.js"
import type { Analyst, AnalystContext, Signal } from "../types.js"
import { decideCycle, runCycle, type CycleClock, type DecideCycleInput } from "./run-cycle.js"

const DAYS = ["2020-05-18", "2020-05-19", "2020-05-20"]
const DECISION_DAY = DAYS[1] as string
const SECURITY = "A"

/** A data-ignoring analyst — the parity test controls vol/correlation via context. */
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

const emptyData: MarketData = {
  prices: async () => notCovered(),
  fundamentals: async () => notCovered(),
  earnings: async () => notCovered(),
  news: async () => notCovered(),
  insiderTrades: async () => notCovered(),
  corporateActions: async () => notCovered(),
  fxRate: async () => notCovered(),
}

function priceBook(): MarketPrices {
  return createPriceBook({
    securities: [{ securityId: SECURITY, mic: "XNAS", currency: "USD" }],
    prices: {
      [SECURITY]: DAYS.map((date, i) => ({
        securityId: SECURITY,
        date,
        knownAt: `${date}T20:00:00Z`,
        close: [100, 100, 105][i] as number,
        adjClose: [100, 100, 105][i] as number,
        adjustmentFactor: 1,
        currency: "USD" as const,
      })),
    },
    fx: {},
    baseCurrency: "USD",
  })
}

/** Build the book-derived contexts + broker for one decision at DECISION_DAY. */
function scenario() {
  const prices = priceBook()
  const book = new Book({ USD: 1_000_000 })
  const broker = new SimBroker({
    book,
    prices,
    baseCurrency: "USD",
    costs: { commissionPerTrade: 0, slippageBps: 0, fxSpreadBps: 0 },
  })
  const equityBase = 1_000_000
  const shared = {
    data: emptyData,
    panel: [constantAnalyst(0.9)],
    committee: createConvictionCommittee(),
    construction: {
      currencyOf: () => "USD" as const,
      hasMark: (id: string) => prices.markOn(id, DECISION_DAY) !== null,
    },
    sizing: {
      equityBase,
      markPrice: (id: string) => prices.markOn(id, DECISION_DAY),
      rateToBase: () => 1,
      heldQuantity: (id: string) => book.position(id)?.quantity ?? 0,
    },
    risk: createRiskEngine(),
    riskContext: {
      equityBase,
      markPrice: (id: string) => prices.markOn(id, DECISION_DAY),
      rateToBase: () => 1,
      heldQuantity: (id: string) => book.position(id)?.quantity ?? 0,
      positions: () => [],
      realizedVol: () => null,
      averageCorrelation: () => null,
    },
  }
  return { broker, shared }
}

function decideInput(): DecideCycleInput {
  const { shared } = scenario()
  return { asOf: `${DECISION_DAY}T23:00:00Z`, securityIds: [SECURITY], ...shared }
}

describe("decideCycle", () => {
  it("is deterministic — identical inputs yield an identical decision", async () => {
    const [a, b] = await Promise.all([decideCycle(decideInput()), decideCycle(decideInput())])
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("runs the full pipeline: signal → view → weight → order", async () => {
    const decision = await decideCycle(decideInput())
    expect(decision.views[0]?.conviction).toBeCloseTo(0.9, 12)
    // 0.9 × 0.2 cap × 1e6 / 100 = 1800 shares.
    expect(decision.orders).toEqual([{ securityId: SECURITY, side: "buy", quantity: 1800, currency: "USD" }])
  })
})

/**
 * Backtest == live parity, driven end-to-end rather than on hand-built clocks:
 *
 * - The ACTUAL backtest engine ({@link runBacktest}) runs a multi-day fixture
 *   with an {@link InMemoryLedger} — its shell settles fills next-session.
 * - A live-style loop drives {@link runCycle} day-by-day over the same range,
 *   with the same analyst / committee / construction / risk and its own book +
 *   sim broker fed the same prices — its shell settles fills synchronously.
 *
 * The two shells evolve the book on different timelines (the engine settles a
 * decision's fill on a later day; the live loop settles it inside the same
 * `runCycle` call), but at every decision cutoff the book is in the same state,
 * so the recorded decisions — views, orders, and gate actions — must be identical.
 * Risk is configured to force a clip AND a veto so the parity covers gate actions,
 * not just the trivially-empty case.
 */
describe("backtest == live parity (engine loop vs. runCycle loop)", () => {
  const SEC = "US-A"
  const RANGE = { from: "2020-06-01", to: "2020-06-05" }
  const PARITY_DAYS = ["2020-06-01", "2020-06-02", "2020-06-03", "2020-06-04", "2020-06-05"]
  const CLOSES = [100, 102, 101, 105, 103]
  const CUTOFF = "23:00:00Z"
  const CONSTRUCTION: ConstructionConfig = { maxWeightPerName: 0.5, maxGross: 1 }
  // maxPositionPct (0.3) below the construction target (0.45) forces a clip on the
  // opening buy and a veto once the position sits above the cap.
  const RISK: RiskConfig = { maxPositionPct: 0.3, maxGross: 1, volScaling: false, correlation: false }
  const ZERO_COSTS = { commissionPerTrade: 0, slippageBps: 0, fxSpreadBps: 0 }

  function parityPrices(): MarketPrices {
    return createPriceBook({
      securities: [{ securityId: SEC, mic: "XNAS", currency: "USD" }],
      prices: {
        [SEC]: PARITY_DAYS.map((date, i) => ({
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

  /** ledgerA: the real backtest engine over the fixture range. */
  async function runEngine(): Promise<InMemoryLedger> {
    const ledger = new InMemoryLedger()
    await runBacktest({
      analyst: constantAnalyst(0.9),
      securityIds: [SEC],
      data: emptyData,
      prices: parityPrices(),
      calendar: createTradingCalendar({ XNAS: PARITY_DAYS }),
      corporateActions: {},
      baseCurrency: "USD",
      initialCash: { USD: 1_000_000 },
      range: RANGE,
      construction: CONSTRUCTION,
      risk: RISK,
      costs: ZERO_COSTS,
      ledger,
    })
    return ledger
  }

  /** ledgerB: a live-style loop driving runCycle day-by-day over the same prices. */
  async function runLiveLoop(): Promise<InMemoryLedger> {
    const prices = parityPrices()
    const calendar = createTradingCalendar({ XNAS: PARITY_DAYS })
    const book = new Book({ USD: 1_000_000 })
    const broker = new SimBroker({ book, prices, baseCurrency: "USD", costs: ZERO_COSTS })
    const committee = createConvictionCommittee()
    const risk = createRiskEngine(RISK)
    const panel = [constantAnalyst(0.9)]
    const ledger = new InMemoryLedger()

    const valuationAt = (day: string): BookValuation => ({
      markPrice: (id) => prices.markOn(id, day) ?? 0,
      rateToBase: (c) => prices.rateToBase(c, day),
    })

    for (const day of calendar.tradingDays("XNAS", RANGE)) {
      const equityBase = book.equityInBase(valuationAt(day), "USD")
      const positions: RiskPosition[] = [...book.positions()].map(([securityId, p]) => ({
        securityId,
        quantity: p.quantity,
        currency: p.currency,
      }))
      const next = calendar.nextSession("XNAS", day)
      const clock: CycleClock = {
        asOf: () => `${day}T${CUTOFF}`,
        activeSecurities: () => [SEC],
        fillDate: () => (next !== null && next <= RANGE.to ? next : null),
      }
      const markPrice = (id: string): number | null => prices.markOn(id, day)
      const rateToBase = (c: Currency): number => prices.rateToBase(c, day)
      const heldQuantity = (id: string): number => book.position(id)?.quantity ?? 0

      // The live loop is inherently sequential: each day's decision reads the book
      // the previous day's fill mutated, so these runCycle calls cannot be parallelized.
      await runCycle({
        clock,
        data: emptyData,
        panel,
        committee,
        construction: { currencyOf: () => "USD", hasMark: (id) => prices.markOn(id, day) !== null },
        constructionConfig: CONSTRUCTION,
        sizing: { equityBase, markPrice, rateToBase, heldQuantity },
        risk,
        riskContext: {
          equityBase,
          markPrice,
          rateToBase,
          heldQuantity,
          positions: () => positions,
          realizedVol: () => null,
          averageCorrelation: () => null,
        },
        broker,
        ledger,
      })
    }
    return ledger
  }

  it("records identical decisions (views, orders, gate actions) on both shells", async () => {
    const [engineLedger, liveLedger] = await Promise.all([runEngine(), runLiveLoop()])

    const byAsOf = (ledger: InMemoryLedger): Map<string, DecisionRecord> =>
      new Map(ledger.decisions().map((d) => [d.asOf, d]))
    const engine = byAsOf(engineLedger)
    const live = byAsOf(liveLedger)

    // A decision recorded every trading day, on both shells, keyed identically.
    expect(engine.size).toBe(PARITY_DAYS.length)
    expect([...live.keys()].sort()).toEqual([...engine.keys()].sort())

    for (const asOf of engine.keys()) {
      const a = engine.get(asOf) as DecisionRecord
      const b = live.get(asOf) as DecisionRecord
      expect(JSON.stringify(b.views)).toBe(JSON.stringify(a.views))
      expect(JSON.stringify(b.orders)).toBe(JSON.stringify(a.orders))
      expect(JSON.stringify(b.gateActions)).toBe(JSON.stringify(a.gateActions))
    }

    // The scenario is non-trivial: it produced real orders and exercised both a
    // clip and a veto, so the gate-action parity above is meaningful.
    const engineActions = engineLedger.decisions().flatMap((d) => d.gateActions)
    expect(engineLedger.decisions().some((d) => d.orders.length > 0)).toBe(true)
    expect(engineActions.some((a) => a.action === "clip")).toBe(true)
    expect(engineActions.some((a) => a.action === "veto")).toBe(true)
  })
})
