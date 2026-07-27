import type { PromotionReason } from "../promotion/gate.js"
import type { AnalystScorecard } from "./scorecard.js"

/**
 * The seat gate (plan 023, step 4) — the analyst-level twin of the promotion
 * gate, and deliberately the same shape.
 *
 * `analystWeights` is user-supplied configuration: nothing in the engine
 * measures whether a seat's conviction carries information, so nothing can
 * justify its weight. This gate turns a {@link AnalystScorecard} into a
 * deterministic active/shadow decision against documented thresholds, and
 * records **every** check — pass or fail — so a rejection is explainable
 * without rerunning anything.
 *
 * Two properties make it a gate rather than a report:
 *
 * - **A failing seat is `"shadow"`, never an error.** A seat that has not
 *   earned weight is a normal, expected condition; `weight: 0` already means
 *   "recorded but does not move the book", so shadow mode needs no machinery.
 *   This is what makes panel growth safe: a new analyst enters in shadow, costs
 *   nothing, risks nothing, and earns its seat on evidence.
 * - **In-sample evidence can never promote.** An IC measured on the data the
 *   seat was designed against is a description of the past, not a forecast, and
 *   the check is listed first so a reader sees it before the numbers.
 *
 * Expect "insufficient evidence, stay in shadow" to be the honest answer for a
 * long time. That is the layer working, not failing.
 */

export type SeatState = "active" | "shadow"

export interface SeatGateConfig {
  /** Minimum resolved observations before any promotion. Default 30. */
  readonly minObservations?: number
  /** Minimum information coefficient. Default 0.02 — a first bar, not a literature-grade filter. */
  readonly icFloor?: number
  /** Minimum fraction of evaluation windows with positive IC. Default 0.5. */
  readonly minPositiveWindowFraction?: number
  /** Maximum tolerated abstention rate. Default 0.8. */
  readonly maxAbstentionRate?: number
}

export interface SeatEvidence {
  /**
   * The scorecard to score. `ic`, `observations` and `abstentionRate` are
   * whole-sample figures over whatever was fed to `buildScorecards`, so the
   * caller — not this gate — decides what "the sample" is. Claiming
   * `out-of-sample` while passing a scorecard built over the full history
   * promotes on a contaminated IC with the `out-of-sample` reason reading
   * `ok: true`. Scope the decisions and observations first, with
   * {@link scopeEvidenceToWindows} — that is what it is for.
   */
  readonly scorecard: AnalystScorecard
  /**
   * Refuse to promote on in-sample evidence.
   *
   * This is a **label the caller asserts**, not something the gate can
   * corroborate: nothing in an `AnalystScorecard` records which span it was
   * built over. The check earns its keep by being explicit and first, and the
   * scoping that makes the label true is
   * {@link scopeEvidenceToWindows}'s job.
   */
  readonly source: "in-sample" | "out-of-sample"
}

export interface SeatGateResult {
  readonly analystId: string
  readonly state: SeatState
  /** Every check evaluated, in a stable order. `state === "active"` iff all `ok`. */
  readonly reasons: PromotionReason[]
}

type ResolvedSeatGateConfig = Required<SeatGateConfig>

function resolveConfig(config: SeatGateConfig): ResolvedSeatGateConfig {
  return {
    minObservations: config.minObservations ?? 30,
    icFloor: config.icFloor ?? 0.02,
    minPositiveWindowFraction: config.minPositiveWindowFraction ?? 0.5,
    maxAbstentionRate: config.maxAbstentionRate ?? 0.8,
  }
}

/**
 * Evaluate one seat. Deterministic: the same evidence and config always yield
 * the same result, and `reasons` always lists all five checks in the same order
 * whatever the outcome — a gate whose output shape depends on the verdict is a
 * gate you cannot diff.
 */
export function evaluateSeat(
  evidence: SeatEvidence,
  config: SeatGateConfig = {},
): SeatGateResult {
  const { scorecard, source } = evidence
  const cfg = resolveConfig(config)
  const reasons: PromotionReason[] = []

  const outOfSample = source === "out-of-sample"
  reasons.push({
    code: "out-of-sample",
    ok: outOfSample,
    detail: outOfSample
      ? "evidence is out-of-sample"
      : "evidence is in-sample — a seat is never promoted on the data it was designed against",
  })

  reasons.push({
    code: "min-observations",
    ok: scorecard.observations >= cfg.minObservations,
    detail: `${scorecard.observations} resolved observation(s) vs. min ${cfg.minObservations} (${scorecard.unresolved} unresolved)`,
  })

  const ic = scorecard.ic
  reasons.push({
    code: "information-coefficient",
    ok: ic !== null && ic >= cfg.icFloor,
    detail:
      ic === null
        ? `information coefficient unmeasurable (constant conviction or too few observations) vs. floor ${format(cfg.icFloor)}`
        : `information coefficient ${format(ic)} vs. floor ${format(cfg.icFloor)}`,
  })

  reasons.push(icConsistency(scorecard, cfg))

  reasons.push({
    code: "abstention-rate",
    ok: scorecard.abstentionRate <= cfg.maxAbstentionRate,
    detail: `abstention rate ${format(scorecard.abstentionRate)} vs. ceiling ${format(cfg.maxAbstentionRate)}`,
  })

  return {
    analystId: scorecard.analystId,
    state: reasons.every((r) => r.ok) ? "active" : "shadow",
    reasons,
  }
}

/**
 * Consistency across evaluation windows: edge that shows up in one window and
 * nowhere else is a window, not an edge. A `null` window IC counts against the
 * fraction — unmeasurable is not evidence of consistency.
 *
 * With no windows supplied there is nothing to be consistent across, so the
 * check is skipped-as-passing and says so; it must not block a seat for a
 * choice the caller made about how to slice the sample.
 */
function icConsistency(
  scorecard: AnalystScorecard,
  cfg: ResolvedSeatGateConfig,
): PromotionReason {
  if (scorecard.windowIc.length === 0) {
    return {
      code: "ic-consistency",
      ok: true,
      detail: "no evaluation windows supplied — consistency check skipped (treated as passing)",
    }
  }
  const positive = scorecard.windowIc.filter((ic) => ic !== null && ic > 0).length
  const fraction = positive / scorecard.windowIc.length
  return {
    code: "ic-consistency",
    ok: fraction >= cfg.minPositiveWindowFraction,
    detail: `${positive}/${scorecard.windowIc.length} window(s) with positive IC (${format(fraction)}) vs. min ${format(cfg.minPositiveWindowFraction)}`,
  }
}

function format(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : String(value)
}
