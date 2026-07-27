/**
 * Rank-correlation primitives for analyst attribution (plan 023, step 1).
 *
 * Attribution scores an analyst by **information coefficient** — the rank
 * correlation between the conviction it expressed and the alpha that view
 * actually realized. Rank, not level, because `construct` sizes proportionally
 * to conviction magnitude: the question that decides whether sizing is signal
 * or decoration is "does a stronger view earn more", which is monotonicity, not
 * linearity.
 *
 * Spearman rather than Pearson for three concrete reasons: conviction scales
 * are not comparable across analysts, LLM personas emit clustered values, and a
 * single outlier return must not dominate the estimate. Ranks are robust to all
 * three.
 *
 * The `null` return is load-bearing and deliberately not `0`. A constant series
 * has no rank variance, so the correlation is *undefined*, not zero — and an
 * analyst that always says the same thing has demonstrated nothing. Returning 0
 * would let "unmeasurable" read downstream as "measured, no edge", which is the
 * one misreading the seat gate must never make.
 */

/**
 * Ordinal ranks (1-based) with **average ranks for ties**.
 *
 * Ties must share a rank: breaking them by input order would invent an ordering
 * the data does not contain, and that phantom ordering would show up as
 * correlation. The returned array is aligned to the input positions.
 */
export function rank(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index }))
  order.sort((a, b) => a.value - b.value)

  const ranks = new Array<number>(values.length).fill(0)
  let start = 0
  while (start < order.length) {
    const head = order[start]
    if (!head) break

    // Extend the block over every entry equal to the head.
    let end = start
    for (;;) {
      const next = order[end + 1]
      if (!next || next.value !== head.value) break
      end++
    }

    // Ranks are 1-based; the tied block shares the mean of its ranks.
    const tiedRank = (start + end) / 2 + 1
    for (let i = start; i <= end; i++) {
      const entry = order[i]
      if (entry) ranks[entry.index] = tiedRank
    }
    start = end + 1
  }
  return ranks
}

/**
 * Spearman rank correlation: Pearson correlation computed over {@link rank}s.
 *
 * Returns `null` — never `0` — when the coefficient is undefined:
 * - fewer than 3 pairs (a correlation over two points is an artefact), or
 * - either ranked series has zero variance (a constant conviction, or a
 *   constant realized alpha).
 *
 * Throws on a length mismatch: that is a caller bug, not an unmeasurable
 * sample, and silently truncating would fabricate pairings.
 */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length) {
    throw new Error(
      `spearman: length mismatch (${xs.length} vs ${ys.length}) — inputs must be paired observations`,
    )
  }
  if (xs.length < 3) return null

  const rx = rank(xs)
  const ry = rank(ys)
  const mx = mean(rx)
  const my = mean(ry)

  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (let i = 0; i < rx.length; i++) {
    const dx = (rx[i] ?? 0) - mx
    const dy = (ry[i] ?? 0) - my
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }

  // Zero variance on either side ⇒ undefined, not uncorrelated.
  if (varianceX === 0 || varianceY === 0) return null

  const rho = covariance / Math.sqrt(varianceX * varianceY)
  if (!Number.isFinite(rho)) return null
  // Clamp away float error at the extremes so a perfect fit reads as exactly ±1.
  return Math.min(1, Math.max(-1, rho))
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}
