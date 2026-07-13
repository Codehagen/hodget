import type { DateRange, MarketData } from "../data/market-data.js"
import type { CorporateActionEvent, Currency } from "../data/types.js"
import type { Analyst, Fill, Order, Signal } from "../types.js"
import { Book, type BookValuation, type DividendRecord, type SplitRecord } from "./book.js"
import type { TradingCalendar } from "./calendar.js"
import { computeMetrics, type BacktestMetrics, type EquityPoint } from "./metrics.js"
import type { MarketPrices } from "./pricebook.js"
import { SimBroker, type SimBrokerCosts } from "./sim-broker.js"
import { sizeOrders, type SizingCaps, type SizingContext } from "./sizing.js"

/**
 * The whole-book backtest loop (plan 002 phase 3).
 *
 * One shared capital pool, one shared **union** calendar, cross-symbol exposure.
 * Day by day over the union calendar, for each day:
 *
 * 1. Apply corporate-action events whose ex-date is this day (raw-price
 *    accounting: a split mutates share counts, a dividend credits cash).
 * 2. Settle the fills scheduled for today (orders decided a session earlier).
 * 3. Mark the book to market in base currency and record the daily equity point.
 * 4. After the close, form decisions at a PIT cutoff — but only for symbols whose
 *    own exchange traded today — size them into orders, and schedule each to fill
 *    at that symbol's **next** session. A decision never fills same-bar, and an
 *    abstained signal produces no order.
 *
 * This is the deliberately simple phase-3 kernel: a single analyst and the
 * conviction-proportional sizing rule. Phase 4's committee + construction
 * pipeline slot in behind the same order-producing seam.
 */

/** A settled fill paired with the signal that originated it (thesis + components). */
export interface BacktestTrade {
  readonly fill: Fill
  readonly signal: Signal
}

/** A corporate action applied to the book during the run, for auditability. */
export interface AppliedCorporateAction {
  readonly type: "split" | "dividend"
  readonly exDate: string
  readonly split?: SplitRecord
  readonly dividend?: DividendRecord
}

export interface BacktestResult {
  readonly baseCurrency: Currency
  readonly equityCurve: EquityPoint[]
  readonly metrics: BacktestMetrics
  readonly trades: BacktestTrade[]
  readonly corporateActions: AppliedCorporateAction[]
  /** Always carries the fixed-universe label + the price-adjustment convention. */
  readonly caveats: string[]
}

/** Caveats every phase-3 result carries (plan 002, "Survivorship bias"). */
export const FIXED_UNIVERSE_CAVEAT =
  "fixed-universe case study: results run on an explicit symbol list and are not survivorship-adjusted"
export const PRICE_ADJUSTMENT_CAVEAT =
  "metrics use raw-price accounting; split/dividend-adjusted series feed analytics only, never the book"

export interface BacktestConfig {
  readonly analyst: Analyst
  readonly securityIds: readonly string[]
  /** PIT-scoped data the analyst reasons over. */
  readonly data: MarketData
  /** Raw price + FX access for accounting and valuation. */
  readonly prices: MarketPrices
  readonly calendar: TradingCalendar
  readonly corporateActions: Readonly<Record<string, readonly CorporateActionEvent[]>>
  readonly baseCurrency: Currency
  readonly initialCash: Partial<Record<Currency, number>>
  readonly range: DateRange
  readonly sizing?: SizingCaps
  readonly costs?: SimBrokerCosts
  readonly periodsPerYear?: number
  /** UTC time-of-day for the decision cutoff (after every exchange close). Default 23:00:00Z. */
  readonly decisionCutoffTime?: string
}

interface Scheduled {
  readonly order: Order
  readonly signal: Signal
}

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const { prices, calendar, baseCurrency, range } = config
  const cutoffTime = config.decisionCutoffTime ?? "23:00:00Z"

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
    await settleFills(broker, book, pendingByDate, day, trades)

    equityCurve.push({ date: day, equity: book.equityInBase(valuationAt(day), baseCurrency) })

    const equity = equityCurve[equityCurve.length - 1]?.equity ?? 0
    await decide(config, book, day, cutoffTime, equity, pendingByDate)
  }

  const metrics = computeMetrics(equityCurve, {
    trades: trades.map((t) => t.fill),
    costsBase: broker.costsBase,
    tradedNotionalBase: broker.tradedNotionalBase,
    initialEquity: equityCurve[0]?.equity ?? 0,
    ...(config.periodsPerYear !== undefined ? { periodsPerYear: config.periodsPerYear } : {}),
  })

  return {
    baseCurrency,
    equityCurve,
    metrics,
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
  _book: Book,
  pendingByDate: Map<string, Scheduled[]>,
  day: string,
  trades: BacktestTrade[],
): Promise<void> {
  const due = pendingByDate.get(day)
  if (!due) return
  const fills = await broker.execute(due.map((d) => d.order), day)
  // execute preserves order and drops clipped-to-zero orders; zip fills to signals.
  let fi = 0
  for (const scheduled of due) {
    const fill = fills[fi]
    if (fill && fill.securityId === scheduled.order.securityId && fill.side === scheduled.order.side) {
      trades.push({ fill, signal: scheduled.signal })
      fi += 1
    }
  }
  pendingByDate.delete(day)
}

async function decide(
  config: BacktestConfig,
  book: Book,
  day: string,
  cutoffTime: string,
  equity: number,
  pendingByDate: Map<string, Scheduled[]>,
): Promise<void> {
  const { analyst, prices, calendar, securityIds, data, range } = config
  const asOf = `${day}T${cutoffTime}`

  // Decide only for symbols whose own exchange traded today; their next session
  // is a real fill target and no order is ever left in flight across a decision.
  const active = securityIds.filter((id) => calendar.isTradingDay(prices.micOf(id), day))
  if (active.length === 0) return

  const signals = await Promise.all(active.map((id) => analyst.predict({ securityId: id, asOf, data })))
  const signalBySecurity = new Map(signals.map((s) => [s.securityId, s]))

  const ctx: SizingContext = {
    equityBase: equity,
    markPrice: (id) => prices.markOn(id, day),
    rateToBase: (currency) => prices.rateToBase(currency, day),
    currencyOf: (id) => prices.currencyOf(id),
    heldQuantity: (id) => book.position(id)?.quantity ?? 0,
  }
  const orders = sizeOrders(signals, ctx, config.sizing)

  for (const order of orders) {
    const fillDate = calendar.nextSession(prices.micOf(order.securityId), day)
    if (!fillDate || fillDate > range.to) continue
    const signal = signalBySecurity.get(order.securityId)
    if (!signal) continue
    const list = pendingByDate.get(fillDate) ?? []
    list.push({ order, signal })
    pendingByDate.set(fillDate, list)
  }
}
