import type { AnalystScorecard } from "./scorecard.js"

/**
 * Evidence-derived analyst weights, shrunk hard toward equal weight
 * (plan 023, step 5).
 *
 * With a handful of analysts and a short history, an estimated IC is mostly
 * noise. Handing that noise straight to the committee would let three lucky
 * months swing the whole book, so weights are pulled toward equal weight by a
 * factor of sample size:
 *
 * ```
 * lambda_i = n_i / (n_i + shrinkageConstant)
 * weight_i = (1 - lambda_i) * 1 + lambda_i * normalizedScore_i
 * ```
 *
 * At `n = 0` this is *exactly* equal weight; at `n = shrinkageConstant` it is
 * half-way to the raw evidence; reaching the raw evidence requires a sample
 * this project will not have for a long time. That is deliberate — the default
 * is conservative, not tuned, and "insufficient evidence, stay equal-weighted"
 * is the expected honest output for a while.
 *
 * Note what this module does *not* do: it does not apply anything. It returns a
 * recommendation. Wiring derived weights into `runConfigSchema` waits for real
 * data behind the numbers — shipping an unproven weighting scheme into the book
 * would be the exact mistake this layer exists to prevent.
 */
export interface WeightConfig {
  /** Shrinkage half-point in observations. Default 100. */
  readonly shrinkageConstant?: number
  /** Upper clamp on a derived weight. Default 10. */
  readonly maxWeight?: number
}

/**
 * Derive a `analystWeights` map from scorecards. Every returned weight is
 * finite and within `[0, maxWeight]`.
 *
 * A negative or unmeasurable IC scores 0 — it is no evidence *for* extra
 * weight — but never goes negative: a negative weight would invert an analyst,
 * and betting against your own seat is a strategy decision, not an attribution
 * one.
 *
 * If no analyst shows any positive evidence the result is equal weight 1 for
 * everyone, not a zeroed panel. No evidence anywhere means no reweighting.
 */
export function shrunkAnalystWeights(
  scorecards: readonly AnalystScorecard[],
  config: WeightConfig = {},
): Record<string, number> {
  const shrinkageConstant = config.shrinkageConstant ?? 100
  const maxWeight = config.maxWeight ?? 10

  const scores = scorecards.map((card) => Math.max(0, card.ic ?? 0))
  const total = scores.reduce((sum, score) => sum + score, 0)

  const weights: Record<string, number> = {}
  if (!(total > 0)) {
    for (const card of scorecards) weights[card.analystId] = 1
    return weights
  }

  const meanScore = total / scores.length
  scorecards.forEach((card, index) => {
    const normalized = (scores[index] ?? 0) / meanScore
    // `n = 0` with `shrinkageConstant = 0` is 0/0; no observations means no
    // evidence, so the honest lambda there is 0 (pure equal weight).
    const denominator = card.observations + shrinkageConstant
    const lambda = denominator > 0 ? card.observations / denominator : 0
    const weight = (1 - lambda) * 1 + lambda * normalized
    weights[card.analystId] = clamp(weight, 0, maxWeight)
  })
  return weights
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return Math.min(high, Math.max(low, value))
}
