/**
 * Realized-volatility and correlation primitives for the risk gates (plan 002
 * phase 4). Pure float64 research math — hand-checkable and unit-tested against
 * hand-computed values — kept separate from the gate logic that consumes it.
 *
 * These feed two deterministic knobs on the position cap:
 * - {@link volScaledCap}: realized vol buckets the base 20% cap into `[5%, 25%]`.
 * - {@link correlationMultiplier}: average pairwise correlation across held names
 *   shrinks the cap into `[0.7, 1.1]`.
 *
 * An LLM output can never move these; they are computed from PIT price history.
 */

/** Consecutive simple returns of a close series (length n → n−1 returns). */
export function simpleReturns(closes: readonly number[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1] as number
    const curr = closes[i] as number
    if (prev > 0) returns.push(curr / prev - 1)
  }
  return returns
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Sample standard deviation (ddof=1). */
export function sampleStdev(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mu = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - mu) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/**
 * Annualized realized volatility from a close series, or null when there is too
 * little history to estimate it (< 2 returns). `periodsPerYear` scales the daily
 * standard deviation up (√252 by default).
 */
export function realizedVolatility(
  closes: readonly number[],
  periodsPerYear = 252,
): number | null {
  const returns = simpleReturns(closes)
  if (returns.length < 2) return null
  return sampleStdev(returns) * Math.sqrt(periodsPerYear)
}

/** Pearson correlation of two equal-length return series, or null if undefined. */
export function pearson(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 2) return null
  const av = a.slice(0, n)
  const bv = b.slice(0, n)
  const ma = mean(av)
  const mb = mean(bv)
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i++) {
    const da = (av[i] as number) - ma
    const db = (bv[i] as number) - mb
    cov += da * db
    va += da * da
    vb += db * db
  }
  if (va <= 0 || vb <= 0) return null
  return cov / Math.sqrt(va * vb)
}

/**
 * Average pairwise Pearson correlation across a set of return series. Null when
 * fewer than two series have a defined pairwise correlation (e.g. a single held
 * name, or constant series).
 */
export function averagePairwiseCorrelation(series: readonly (readonly number[])[]): number | null {
  let sum = 0
  let pairs = 0
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const r = pearson(series[i] as number[], series[j] as number[])
      if (r !== null) {
        sum += r
        pairs += 1
      }
    }
  }
  return pairs > 0 ? sum / pairs : null
}

/** Annualized-vol thresholds and the position cap each bucket permits. */
const VOL_BUCKETS: readonly { readonly maxVol: number; readonly cap: number }[] = [
  { maxVol: 0.15, cap: 0.25 },
  { maxVol: 0.25, cap: 0.2 },
  { maxVol: 0.4, cap: 0.15 },
  { maxVol: 0.6, cap: 0.1 },
]
const HIGH_VOL_CAP = 0.05

/**
 * Bucket annualized realized vol into a position cap in `[0.05, 0.25]` around a
 * 20% base: quieter names earn a larger cap, turbulent names a smaller one. A
 * null vol (insufficient history) falls back to `baseCap` — the risk stage never
 * scales on a number it could not estimate.
 */
export function volScaledCap(realizedVol: number | null, baseCap = 0.2): number {
  if (realizedVol === null) return baseCap
  for (const bucket of VOL_BUCKETS) {
    if (realizedVol < bucket.maxVol) return bucket.cap
  }
  return HIGH_VOL_CAP
}

/**
 * Map average pairwise correlation to a cap multiplier in `[0.7, 1.1]`: a
 * strongly co-moving book (avg corr → 1) shrinks caps to 0.7, an anti-correlated
 * or diversified book (avg corr → −1) loosens them to 1.1, and an uncorrelated
 * book (0) is neutral (1.0). Null correlation (fewer than two held names) is
 * neutral. The two sides use different slopes so the neutral point sits at 0.
 */
export function correlationMultiplier(avgCorrelation: number | null): number {
  if (avgCorrelation === null) return 1
  const raw = avgCorrelation >= 0 ? 1 - 0.3 * avgCorrelation : 1 - 0.1 * avgCorrelation
  return Math.min(1.1, Math.max(0.7, raw))
}
