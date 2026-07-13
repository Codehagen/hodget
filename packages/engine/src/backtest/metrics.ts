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
