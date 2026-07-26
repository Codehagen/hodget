import type { Currency } from "../data/types.js"
import type { Fill } from "../types.js"

/**
 * Backtest metrics (plan 002, "Backtesting and validation").
 *
 * Risk/return statistics are computed from **daily periodic returns**, never
 * per-trade returns (per-trade Sharpe scales with trade count and overstates
 * quality; a trade-indexed curve hides intra-holding drawdowns). Max drawdown is
 * read off the daily equity curve. Win rate is realised per closed lot via
 * average-cost accounting; turnover and cost drag expose the friction that
 * zero-cost backtests hide.
 */
export interface EquityPoint {
  readonly date: string
  readonly equity: number
}

export interface BacktestMetrics {
  /** End/start − 1 over the curve. */
  readonly totalReturn: number
  /** Geometric annualisation of the total return. */
  readonly annualizedReturn: number
  /** Mean/stdev of daily returns × √periodsPerYear (risk-free 0). */
  readonly sharpe: number
  /** Mean/downside-deviation of daily returns × √periodsPerYear. */
  readonly sortino: number
  /** Largest peak-to-trough decline on the daily curve, as a positive fraction. */
  readonly maxDrawdown: number
  /** Fraction of closed lots realised at a profit (average-cost basis). */
  readonly winRate: number
  /** Gross traded notional over average equity, in base currency. */
  readonly turnover: number
  /** Total slippage + commission + FX spread over initial equity. */
  readonly costDrag: number
  /** Number of points on the daily equity curve. */
  readonly tradingDays: number
}

export interface MetricsInput {
  /** Fills in chronological order — for win rate, turnover already summarised. */
  readonly trades: readonly Fill[]
  /** Base-currency slippage + commission + FX spread paid across the run. */
  readonly costsBase: number
  /** Gross traded notional in base currency across the run. */
  readonly tradedNotionalBase: number
  /** Starting equity in base currency (cost-drag denominator). */
  readonly initialEquity: number
  /** Periods per year for annualisation/scaling. Default 252. */
  readonly periodsPerYear?: number
}

function dailyReturns(curve: readonly EquityPoint[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < curve.length; i++) {
    const prev = (curve[i - 1] as EquityPoint).equity
    const curr = (curve[i] as EquityPoint).equity
    if (prev > 0) returns.push(curr / prev - 1)
  }
  return returns
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Sample standard deviation (ddof=1). */
function sampleStdev(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mu = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - mu) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** √(mean of squared negative returns) — the Sortino denominator. */
function downsideDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sumSq = values.reduce((sum, v) => sum + (v < 0 ? v * v : 0), 0)
  return Math.sqrt(sumSq / values.length)
}

function maxDrawdown(curve: readonly EquityPoint[]): number {
  let peak = Number.NEGATIVE_INFINITY
  let worst = 0
  for (const point of curve) {
    if (point.equity > peak) peak = point.equity
    if (peak > 0) worst = Math.max(worst, (peak - point.equity) / peak)
  }
  return worst
}

/** Fraction of closed lots realised profitably, average-cost basis, per currency. */
function winRate(trades: readonly Fill[]): number {
  const lots = new Map<string, { quantity: number; cost: number }>()
  let wins = 0
  let closed = 0
  for (const trade of trades) {
    const lot = lots.get(trade.securityId) ?? { quantity: 0, cost: 0 }
    if (trade.side === "buy") {
      lot.quantity += trade.quantity
      lot.cost += trade.quantity * trade.price + trade.commission
    } else {
      const avg = lot.quantity > 0 ? lot.cost / lot.quantity : 0
      const realised = trade.quantity * trade.price - trade.commission - trade.quantity * avg
      closed += 1
      if (realised > 0) wins += 1
      lot.quantity = Math.max(0, lot.quantity - trade.quantity)
      lot.cost = lot.quantity * avg
    }
    lots.set(trade.securityId, lot)
  }
  return closed > 0 ? wins / closed : 0
}

/**
 * Trade-level diagnostics (plan 002 phase 4) — a **diagnostics** layer that never
 * replaces the daily-return headline metrics above. Computed per closed lot with
 * FIFO matching: each sell consumes the oldest open buy lots, and each match is a
 * closed trade with an entry/exit time and a realized PnL. PnL is expressed in
 * base currency at the provided FX rate (default 1× for single-currency runs).
 */
export interface TradeDiagnostics {
  /** Number of closed trades that realized a profit. */
  readonly wins: number
  /** Number of closed trades that realized a loss. */
  readonly losses: number
  /** Mean base-currency PnL of winning trades (0 if none). */
  readonly avgWin: number
  /** Mean base-currency PnL of losing trades, as a negative number (0 if none). */
  readonly avgLoss: number
  /** Gross profit / gross loss. `Infinity` when there are no losses; 0 if no profit. */
  readonly profitFactor: number
  /** Mean holding period across closed trades, in calendar days. */
  readonly avgHoldingDays: number
}

interface FifoLot {
  quantity: number
  /** Per-share cost in own currency (buy price + allocated commission). */
  unitCost: number
  filledAt: string
}

const MS_PER_DAY = 86_400_000

function holdingDays(entry: string, exit: string): number {
  return Math.max(0, (Date.parse(exit) - Date.parse(entry)) / MS_PER_DAY)
}

export interface DiagnosticsInput {
  /** Final multiplier from a currency to base. Default 1× for every currency. */
  readonly rateToBase?: (currency: Currency) => number
}

export function computeTradeDiagnostics(
  trades: readonly Fill[],
  input: DiagnosticsInput = {},
): TradeDiagnostics {
  const rate = input.rateToBase ?? (() => 1)
  const lotsBySecurity = new Map<string, FifoLot[]>()
  const wins: number[] = []
  const losses: number[] = []
  const durations: number[] = []

  for (const trade of trades) {
    const lots = lotsBySecurity.get(trade.securityId) ?? []
    if (trade.side === "buy") {
      const unitCost = trade.price + trade.commission / trade.quantity
      lots.push({ quantity: trade.quantity, unitCost, filledAt: trade.filledAt })
      lotsBySecurity.set(trade.securityId, lots)
      continue
    }
    // Sell: match against oldest lots FIFO; commission spread over sold shares.
    let remaining = trade.quantity
    const sellUnitNet = trade.price - trade.commission / trade.quantity
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0] as FifoLot
      const matched = Math.min(remaining, lot.quantity)
      const pnl = matched * (sellUnitNet - lot.unitCost) * rate(trade.currency)
      if (pnl >= 0) wins.push(pnl)
      else losses.push(pnl)
      durations.push(holdingDays(lot.filledAt, trade.filledAt))
      lot.quantity -= matched
      remaining -= matched
      if (lot.quantity === 0) lots.shift()
    }
    lotsBySecurity.set(trade.securityId, lots)
  }

  const grossProfit = wins.reduce((s, v) => s + v, 0)
  const grossLoss = losses.reduce((s, v) => s + v, 0)
  return {
    wins: wins.length,
    losses: losses.length,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : grossProfit > 0 ? Infinity : 0,
    avgHoldingDays: durations.length > 0 ? mean(durations) : 0,
  }
}

/**
 * Per-symbol PnL attribution (plan 002 phase 4), in base currency — a diagnostic,
 * not a headline metric. Average-cost basis: **realized** PnL accrues on each sell
 * (proceeds net of commission minus average cost consumed), **unrealized** PnL
 * marks the residual open position at its final price. Both are converted to base
 * at the final FX rate.
 *
 * With a single base currency and no dividends, the summed `totalBase` across all
 * symbols equals the run's total PnL (final equity − initial equity) — the
 * property the attribution test asserts.
 */
export interface SymbolAttribution {
  readonly securityId: string
  readonly currency: Currency
  readonly realizedBase: number
  readonly unrealizedBase: number
  readonly totalBase: number
}

export interface AttributionInput {
  /** Final own-currency mark for a security (last close), or null if none held. */
  finalMark(securityId: string): number | null
  /** Final multiplier from a currency to base. Default 1×. */
  rateToBase?: (currency: Currency) => number
}

export function computeAttribution(
  trades: readonly Fill[],
  input: AttributionInput,
): SymbolAttribution[] {
  const rate = input.rateToBase ?? (() => 1)
  interface Acc {
    currency: Currency
    quantity: number
    costBasis: number // own-currency cost of the open position (avg-cost)
    realized: number // own-currency realized PnL
  }
  const bySecurity = new Map<string, Acc>()

  for (const trade of trades) {
    const acc = bySecurity.get(trade.securityId) ?? {
      currency: trade.currency,
      quantity: 0,
      costBasis: 0,
      realized: 0,
    }
    if (trade.side === "buy") {
      acc.quantity += trade.quantity
      acc.costBasis += trade.quantity * trade.price + trade.commission
    } else {
      const avg = acc.quantity > 0 ? acc.costBasis / acc.quantity : 0
      acc.realized += trade.quantity * trade.price - trade.commission - trade.quantity * avg
      acc.quantity = Math.max(0, acc.quantity - trade.quantity)
      acc.costBasis = acc.quantity * avg
    }
    bySecurity.set(trade.securityId, acc)
  }

  const out: SymbolAttribution[] = []
  for (const [securityId, acc] of bySecurity) {
    const mark = input.finalMark(securityId)
    const unrealizedOwn =
      acc.quantity > 0 && mark !== null ? acc.quantity * mark - acc.costBasis : 0
    const r = rate(acc.currency)
    const realizedBase = acc.realized * r
    const unrealizedBase = unrealizedOwn * r
    out.push({
      securityId,
      currency: acc.currency,
      realizedBase,
      unrealizedBase,
      totalBase: realizedBase + unrealizedBase,
    })
  }
  return out.sort((a, b) => (a.securityId < b.securityId ? -1 : a.securityId > b.securityId ? 1 : 0))
}

export function computeMetrics(
  curve: readonly EquityPoint[],
  input: MetricsInput,
): BacktestMetrics {
  const periodsPerYear = input.periodsPerYear ?? 252
  const returns = dailyReturns(curve)
  const first = curve[0]?.equity ?? 0
  const last = curve[curve.length - 1]?.equity ?? 0

  const totalReturn = first > 0 ? last / first - 1 : 0
  const periods = returns.length
  const annualizedReturn =
    periods > 0 && totalReturn > -1 ? (1 + totalReturn) ** (periodsPerYear / periods) - 1 : 0

  const mu = mean(returns)
  const sd = sampleStdev(returns)
  const dd = downsideDeviation(returns)
  const scale = Math.sqrt(periodsPerYear)
  const sharpe = sd > 0 ? (mu / sd) * scale : 0
  const sortino = dd > 0 ? (mu / dd) * scale : 0

  const avgEquity = mean(curve.map((p) => p.equity))
  const turnover = avgEquity > 0 ? input.tradedNotionalBase / avgEquity : 0
  const costDrag = input.initialEquity > 0 ? input.costsBase / input.initialEquity : 0

  return {
    totalReturn,
    annualizedReturn,
    sharpe,
    sortino,
    maxDrawdown: maxDrawdown(curve),
    winRate: winRate(input.trades),
    turnover,
    costDrag,
    tradingDays: curve.length,
  }
}
