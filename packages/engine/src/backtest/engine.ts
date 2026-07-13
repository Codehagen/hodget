import { createConvictionCommittee } from "../committee/committee.js"
import { decideCycle } from "../cycle/run-cycle.js"
import type { DateRange, MarketData } from "../data/market-data.js"
import type { CorporateActionEvent, Currency } from "../data/types.js"
import type { ConstructionConfig } from "../portfolio/construct.js"
import { createRiskEngine, type RiskConfig, type RiskPosition } from "../risk/gates.js"
import { averagePairwiseCorrelation, realizedVolatility, simpleReturns } from "../risk/vol.js"
import type { Analyst, Committee, Fill, Order, TargetView } from "../types.js"
import type { Ledger } from "../ledger/ledger.js"
import { Book, type BookValuation, type DividendRecord, type SplitRecord } from "./book.js"
import type { TradingCalendar } from "./calendar.js"
import {
  computeAttribution,
  computeMetrics,
  computeTradeDiagnostics,
  type BacktestMetrics,
  type EquityPoint,
  type SymbolAttribution,
  type TradeDiagnostics,
} from "./metrics.js"
import type { MarketPrices } from "./pricebook.js"
import { SimBroker, type SimBrokerCosts } from "./sim-broker.js"

/**
 * The whole-book backtest loop (plan 002, phase 3 → phase 4).
 *
 * One shared capital pool, one shared **union** calendar, cross-symbol exposure.
 * Day by day over the union calendar, for each day:
 *
 * 1. Apply corporate-action events whose ex-date is this day (raw-price
 *    accounting: a split mutates share counts, a dividend credits cash).
 * 2. Settle the fills scheduled for today (orders decided a session earlier).
 * 3. Mark the book to market in base currency and record the daily equity point.
 * 4. After the close, form a decision at a PIT cutoff — but only for symbols whose
 *    own exchange traded today — via the shared {@link decideCycle} kernel
 *    (panel → committee → construction → sizing → risk gates), and schedule each
 *    surviving order to fill at that symbol's **next** session. A decision never
 *    fills same-bar; an abstained analyst produces no view and no order.
 *
 * Phase 4 replaces phase 3's single-analyst sizing rule with the full
 * construction + risk pipeline behind the same order-producing seam — the loop's
 * settlement machinery is unchanged, so the kernel is identical to what paper/live
 * run.
 */

/** A settled fill paired with the committee view that originated it. */
export interface BacktestTrade {
  readonly fill: Fill
  readonly view: TargetView
}

/** A corporate action applied to the book during the run, for auditability. */
export interface AppliedCorporateAction {
  readonly type: "split" | "dividend"
  readonly exDate: string
  readonly split?: SplitRecord
  readonly dividend?: DividendRecord
}

/** Diagnostics layer — never replaces the headline daily-return metrics. */
export interface BacktestDiagnostics {
  readonly tradeStats: TradeDiagnostics
  /** Per-symbol realized+unrealized PnL contribution, in base currency. */
  readonly attribution: SymbolAttribution[]
}

export interface BacktestResult {
  readonly baseCurrency: Currency
  readonly equityCurve: EquityPoint[]
  readonly metrics: BacktestMetrics
  readonly diagnostics: BacktestDiagnostics
  readonly trades: BacktestTrade[]
  readonly corporateActions: AppliedCorporateAction[]
  /** Always carries the fixed-universe label + the price-adjustment convention. */
  readonly caveats: string[]
}

/** Caveats every result carries (plan 002, "Survivorship bias"). */
export const FIXED_UNIVERSE_CAVEAT =
  "fixed-universe case study: results run on an explicit symbol list and are not survivorship-adjusted"
export const PRICE_ADJUSTMENT_CAVEAT =
  "metrics use raw-price accounting; split/dividend-adjusted series feed analytics only, never the book"

export interface BacktestConfig {
  /** The analyst panel. Provide `panel` for a committee, or `analyst` for one. */
  readonly panel?: readonly Analyst[]
  /** Convenience for a single-analyst run (wrapped into a one-member panel). */
  readonly analyst?: Analyst
  /** Combining policy. Defaults to an equal-weight conviction committee. */
  readonly committee?: Committee
  readonly securityIds: readonly string[]
  /** PIT-scoped data the analysts reason over (and the risk stage reads vol from). */
  readonly data: MarketData
  /** Raw price + FX access for accounting and valuation. */
  readonly prices: MarketPrices
  readonly calendar: TradingCalendar
  readonly corporateActions: Readonly<Record<string, readonly CorporateActionEvent[]>>
  readonly baseCurrency: Currency
  readonly initialCash: Partial<Record<Currency, number>>
  readonly range: DateRange
  readonly construction?: ConstructionConfig
  readonly risk?: RiskConfig
  readonly costs?: SimBrokerCosts
  readonly periodsPerYear?: number
  /** Trailing window (returns) for realized vol + correlation. Default 60. */
  readonly lookbackTradingDays?: number
  /** UTC time-of-day for the decision cutoff (after every exchange close). Default 23:00:00Z. */
  readonly decisionCutoffTime?: string
  /** Optional ledger recording each cycle's decision (fills settle later). */
  readonly ledger?: Ledger
}

interface Scheduled {
  readonly order: Order
  readonly view: TargetView
  /** The decision cutoff this order was decided at — its ledger key for fill backfill. */
  readonly asOf: string
}

function resolvePanel(config: BacktestConfig): readonly Analyst[] {
  if (config.panel && config.panel.length > 0) return config.panel
  if (config.analyst) return [config.analyst]
  throw new Error("backtest requires a panel or an analyst")
}

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const { prices, calendar, baseCurrency, range } = config
  const cutoffTime = config.decisionCutoffTime ?? "23:00:00Z"
  const lookback = config.lookbackTradingDays ?? 60
  const panel = resolvePanel(config)
  const committee = config.committee ?? createConvictionCommittee()
  const risk = createRiskEngine(config.risk ?? {})

  const book = new Book(config.initialCash)
  const broker = new SimBroker({
    book,
    prices,
    baseCurrency,
    ...(config.costs !== undefined ? { costs: config.costs } : {}),
  })

  const valuationAt = (date: string): BookValuation => ({
    markPrice: (securityId) => prices.markOn(securityId, date) ?? 0,
    rateToBase: (currency) => prices.rateToBase(currency, date),
  })

  const days = calendar.union.filter((d) => d >= range.from && d <= range.to)
  const pendingByDate = new Map<string, Scheduled[]>()
  const equityCurve: EquityPoint[] = []
  const trades: BacktestTrade[] = []
  const corporateActions: AppliedCorporateAction[] = []

  for (const day of days) {
    applyCorporateActions(config, book, day, corporateActions)
    await settleFills(broker, pendingByDate, day, trades, config.ledger)

    equityCurve.push({ date: day, equity: book.equityInBase(valuationAt(day), baseCurrency) })

    const equity = equityCurve[equityCurve.length - 1]?.equity ?? 0
    await decide({ config, panel, committee, risk, lookback }, book, day, cutoffTime, equity, pendingByDate)
  }

  const fills = trades.map((t) => t.fill)
  const metrics = computeMetrics(equityCurve, {
    trades: fills,
    costsBase: broker.costsBase,
    tradedNotionalBase: broker.tradedNotionalBase,
    initialEquity: equityCurve[0]?.equity ?? 0,
    ...(config.periodsPerYear !== undefined ? { periodsPerYear: config.periodsPerYear } : {}),
  })

  const lastDay = days[days.length - 1] ?? range.to
  const finalRateToBase = (currency: Currency): number => prices.rateToBase(currency, lastDay)
  const diagnostics: BacktestDiagnostics = {
    tradeStats: computeTradeDiagnostics(fills, { rateToBase: finalRateToBase }),
    attribution: computeAttribution(fills, {
      finalMark: (id) => prices.markOn(id, lastDay),
      rateToBase: finalRateToBase,
    }),
  }

  return {
    baseCurrency,
    equityCurve,
    metrics,
    diagnostics,
    trades,
    corporateActions,
    caveats: [FIXED_UNIVERSE_CAVEAT, PRICE_ADJUSTMENT_CAVEAT],
  }
}

function applyCorporateActions(
  config: BacktestConfig,
  book: Book,
  day: string,
  out: AppliedCorporateAction[],
): void {
  for (const securityId of config.securityIds) {
    const events = config.corporateActions[securityId] ?? []
    for (const event of events) {
      if (event.exDate !== day) continue
      if (event.type === "split" && event.splitRatio !== null) {
        const record = book.applySplit(securityId, event.splitRatio)
        if (record.before > 0) out.push({ type: "split", exDate: day, split: record })
      } else if (event.type === "dividend" && event.dividendAmount !== null) {
        const record = book.applyDividend(securityId, event.dividendAmount, event.currency)
        if (record.cashCredited > 0) out.push({ type: "dividend", exDate: day, dividend: record })
      }
    }
  }
}

async function settleFills(
  broker: SimBroker,
  pendingByDate: Map<string, Scheduled[]>,
  day: string,
  trades: BacktestTrade[],
  ledger: Ledger | undefined,
): Promise<void> {
  const due = pendingByDate.get(day)
  if (!due) return
  const fills = await broker.execute(due.map((d) => d.order), day)
  // execute preserves order and drops clipped-to-zero orders; zip fills to views.
  let fi = 0
  const settledByAsOf = new Map<string, Fill[]>()
  for (const scheduled of due) {
    const fill = fills[fi]
    if (fill && fill.securityId === scheduled.order.securityId && fill.side === scheduled.order.side) {
      trades.push({ fill, view: scheduled.view })
      const list = settledByAsOf.get(scheduled.asOf) ?? []
      list.push(fill)
      settledByAsOf.set(scheduled.asOf, list)
      fi += 1
    }
  }
  // Backfill each settled fill onto the ledger decision that intended it, so the
  // backtest audit trail carries real fills (not the empty list recorded at decision
  // time) — matching what the live path records synchronously.
  if (ledger) {
    for (const [asOf, settled] of settledByAsOf) ledger.attachFills(asOf, settled)
  }
  pendingByDate.delete(day)
}

interface DecideDeps {
  readonly config: BacktestConfig
  readonly panel: readonly Analyst[]
  readonly committee: Committee
  readonly risk: ReturnType<typeof createRiskEngine>
  readonly lookback: number
}

async function decide(
  deps: DecideDeps,
  book: Book,
  day: string,
  cutoffTime: string,
  equity: number,
  pendingByDate: Map<string, Scheduled[]>,
): Promise<void> {
  const { config, panel, committee, risk, lookback } = deps
  const { prices, calendar, securityIds, data, range } = config
  const asOf = `${day}T${cutoffTime}`

  // Decide only for symbols whose own exchange traded today; their next session
  // is a real fill target and no order is left in flight across a decision.
  const active = securityIds.filter((id) => calendar.isTradingDay(prices.micOf(id), day))
  if (active.length === 0) return

  const positions: RiskPosition[] = [...book.positions()].map(([securityId, p]) => ({
    securityId,
    quantity: p.quantity,
    currency: p.currency,
  }))

  // Realized vol + correlation from PIT-scoped adjusted price history (analytics
  // convention). Precomputed here so the risk gates stay pure/synchronous.
  const volById = new Map<string, number | null>()
  const volUniverse = new Set<string>([...active, ...positions.map((p) => p.securityId)])
  await Promise.all(
    [...volUniverse].map(async (id) => {
      const closes = await trailingCloses(data, id, range.from, day, asOf, lookback)
      volById.set(id, realizedVolatility(closes))
    }),
  )
  const heldReturns = await Promise.all(
    positions.map((p) => trailingCloses(data, p.securityId, range.from, day, asOf, lookback).then(simpleReturns)),
  )
  const averageCorrelation = averagePairwiseCorrelation(heldReturns)

  const decision = await decideCycle({
    asOf,
    securityIds: active,
    data,
    panel,
    committee,
    construction: {
      currencyOf: (id) => prices.currencyOf(id),
      hasMark: (id) => prices.markOn(id, day) !== null,
    },
    ...(config.construction !== undefined ? { constructionConfig: config.construction } : {}),
    sizing: {
      equityBase: equity,
      markPrice: (id) => prices.markOn(id, day),
      rateToBase: (currency) => prices.rateToBase(currency, day),
      heldQuantity: (id) => book.position(id)?.quantity ?? 0,
    },
    risk,
    riskContext: {
      equityBase: equity,
      markPrice: (id) => prices.markOn(id, day),
      rateToBase: (currency) => prices.rateToBase(currency, day),
      heldQuantity: (id) => book.position(id)?.quantity ?? 0,
      positions: () => positions,
      realizedVol: (id) => volById.get(id) ?? null,
      averageCorrelation: () => averageCorrelation,
    },
  })

  config.ledger?.record({
    asOf: decision.asOf,
    signals: decision.signals,
    views: decision.views,
    targetWeights: decision.targetWeights,
    orders: decision.orders,
    gateActions: decision.gateActions,
    fills: [],
  })

  const viewBySecurity = new Map(decision.views.map((v) => [v.securityId, v]))
  for (const order of decision.orders) {
    const fillDate = calendar.nextSession(prices.micOf(order.securityId), day)
    if (!fillDate || fillDate > range.to) continue
    const view = viewBySecurity.get(order.securityId)
    if (!view) continue
    const list = pendingByDate.get(fillDate) ?? []
    list.push({ order, view, asOf: decision.asOf })
    pendingByDate.set(fillDate, list)
  }
}

/**
 * Trailing adjusted closes for `securityId` up to `day`, PIT-scoped to `asOf`,
 * keeping the last `lookback + 1` observations (→ `lookback` returns). Uses
 * `adjClose` — realized vol is analytics, not accounting.
 */
async function trailingCloses(
  data: MarketData,
  securityId: string,
  from: string,
  day: string,
  asOf: string,
  lookback: number,
): Promise<number[]> {
  const result = await data.prices(securityId, { from, to: day }, asOf)
  if (result.coverage === "not-covered") return []
  const closes = result.rows.map((p) => p.adjClose)
  return closes.slice(Math.max(0, closes.length - (lookback + 1)))
}
