import type { FundamentalsSnapshot } from "../data/types.js"

/**
 * Shared fundamentals math (plan 002). Pure functions over the phase-1
 * {@link FundamentalsSnapshot} type — no I/O, no state, no persona-specific
 * knowledge. Personas and quant models compose these; the math lives here once
 * so it is never copy-pasted per analyst.
 *
 * Every function returns `number | null`: `null` is an explicit "undefined for
 * these inputs" (a zero denominator, a non-positive base a growth rate can't be
 * taken over, a loss where a valuation model needs positive earnings). Callers
 * decide what an undefined metric means — the math never guesses.
 */

/** A snapshot's raw reported metrics. */
type Metrics = FundamentalsSnapshot["metrics"]

const EPSILON = 1e-9

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > EPSILON
}

/**
 * Compound annual growth rate from `begin` to `end` over `years`.
 * `null` unless `begin`, `end`, and `years` are all strictly positive (a CAGR
 * across a non-positive base or into a loss is not a real number).
 */
export function cagr(begin: number, end: number, years: number): number | null {
  if (!isPositive(begin) || !isPositive(end) || !isPositive(years)) return null
  return (end / begin) ** (1 / years) - 1
}

/** Net profit margin: net income / revenue. `null` when revenue is ~0. */
export function netMargin(snapshot: FundamentalsSnapshot): number | null {
  const { netIncome, revenue } = snapshot.metrics
  if (Math.abs(revenue) <= EPSILON) return null
  return netIncome / revenue
}

/** Slope of the best-fit line through `values` at unit-spaced indices. */
function linearSlope(values: readonly number[]): number | null {
  const n = values.length
  if (n < 2) return null
  const meanX = (n - 1) / 2
  let mean = 0
  for (const v of values) mean += v
  mean /= n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = i - meanX
    num += dx * ((values[i] ?? 0) - mean)
    den += dx * dx
  }
  if (den <= EPSILON) return null
  return num / den
}

export type TrendDirection = "improving" | "flat" | "declining"

export interface MarginTrend {
  /** Net margin per snapshot, in the order supplied (oldest → newest). */
  readonly netMargins: readonly number[]
  /** Least-squares slope of net margin per period. */
  readonly slope: number
  readonly direction: TrendDirection
}

/**
 * Net-margin trend across snapshots supplied oldest → newest. `null` when
 * fewer than two snapshots carry a computable margin. `direction` treats a
 * slope within ±`flatBand` (default 0.5pp/period) as flat.
 */
export function marginTrend(
  snapshots: readonly FundamentalsSnapshot[],
  flatBand = 0.005,
): MarginTrend | null {
  const netMargins: number[] = []
  for (const s of snapshots) {
    const m = netMargin(s)
    if (m === null) return null
    netMargins.push(m)
  }
  const slope = linearSlope(netMargins)
  if (slope === null) return null
  const direction: TrendDirection =
    slope > flatBand ? "improving" : slope < -flatBand ? "declining" : "flat"
  return { netMargins, slope, direction }
}

/**
 * Owner earnings ≈ operating cash flow − capital expenditure (the OCF-less-capex
 * free-cash-flow proxy; the data model carries no separate D&A / maintenance-
 * capex split). `capitalExpenditure` is treated as a magnitude.
 */
export function ownerEarnings(snapshot: FundamentalsSnapshot): number {
  const { operatingCashFlow, capitalExpenditure } = snapshot.metrics
  return operatingCashFlow - Math.abs(capitalExpenditure)
}

/** Debt-to-equity ratio: total debt / total equity. `null` when equity is ~0. */
export function debtToEquity(snapshot: FundamentalsSnapshot): number | null {
  const { totalDebt, totalEquity } = snapshot.metrics
  if (Math.abs(totalEquity) <= EPSILON) return null
  return totalDebt / totalEquity
}

/** Book value (total equity) per share. `null` when shares are ~0. */
export function bookValuePerShare(snapshot: FundamentalsSnapshot): number | null {
  const { totalEquity, sharesOutstanding } = snapshot.metrics
  if (Math.abs(sharesOutstanding) <= EPSILON) return null
  return totalEquity / sharesOutstanding
}

/**
 * Per-share book-value CAGR from `oldest` to `newest` over `years`. Per share
 * (not absolute equity) so share issuance/buybacks are reflected. `null` when
 * either book value per share is non-positive.
 */
export function bookValueGrowth(
  oldest: FundamentalsSnapshot,
  newest: FundamentalsSnapshot,
  years: number,
): number | null {
  const begin = bookValuePerShare(oldest)
  const end = bookValuePerShare(newest)
  if (begin === null || end === null) return null
  return cagr(begin, end, years)
}

export interface IntrinsicValueOptions {
  /** Discount rate (required return). Default 10%. */
  readonly discountRate?: number
  /** Assumed perpetual growth of owner earnings. Default 0 (no growth). */
  readonly growthRate?: number
}

/**
 * A deliberately simple intrinsic value: a Gordon-growth capitalisation of
 * owner earnings per share, `oe/share × (1 + g) / (r − g)`. `null` when owner
 * earnings are non-positive (this model does not value a cash-burning
 * business) or the discount rate does not exceed the growth rate.
 */
export function intrinsicValuePerShare(
  snapshot: FundamentalsSnapshot,
  options: IntrinsicValueOptions = {},
): number | null {
  const { discountRate = 0.1, growthRate = 0 } = options
  if (discountRate - growthRate <= EPSILON) return null
  const oe = ownerEarnings(snapshot)
  const shares = snapshot.metrics.sharesOutstanding
  if (!isPositive(oe) || !isPositive(shares)) return null
  const oePerShare = oe / shares
  return (oePerShare * (1 + growthRate)) / (discountRate - growthRate)
}

/**
 * Margin of safety of `price` against an `intrinsicValuePerShare`:
 * `(intrinsic − price) / intrinsic`. Positive ⇒ trading below intrinsic value.
 * `null` when intrinsic value is non-positive.
 */
export function marginOfSafety(
  intrinsicValue: number,
  price: number,
): number | null {
  if (!isPositive(intrinsicValue)) return null
  return (intrinsicValue - price) / intrinsicValue
}

/** Read-only view of the metrics a snapshot carries (re-exported for callers). */
export type FundamentalsMetrics = Metrics
