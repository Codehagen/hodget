import type { DateRange } from "../data/market-data.js"
import type { DecisionRecord } from "../ledger/ledger.js"
import type { Observation } from "./outcomes.js"
import { spearman } from "./stats.js"

/**
 * Per-analyst scorecards (plan 023, step 3).
 *
 * A scorecard is the evidence the seat gate scores — and it reads from **two**
 * sources on purpose. The observations say what an analyst's views earned; the
 * decision ledger says what it was asked and how often it declined to answer.
 * Only the ledger can answer the second question, because observations have
 * already dropped abstentions: computing an abstention rate from them would
 * always yield exactly 0, which is the most flattering possible lie about a
 * seat that abstains constantly.
 *
 * Every field is nullable where the truth is "unmeasurable". An analyst with no
 * resolved observations is kept in the output with `ic: null` rather than
 * dropped — a seat that has produced no measurable evidence is a fact the gate
 * needs, and silently omitting it would make an unproven seat indistinguishable
 * from one that was never configured.
 *
 * The two inputs must describe the same run. Observations from an analyst the
 * ledger never recorded are rejected rather than scored against a fabricated
 * `abstentionRate: 0` — see {@link buildScorecards}.
 */
export interface AnalystScorecard {
  readonly analystId: string
  /**
   * Resolved observations in the supplied `observations`.
   *
   * Whole-sample over whatever was passed in — this function does no windowing
   * beyond `windowIc`. Building out-of-sample evidence therefore means scoping
   * the *inputs*, which is what {@link scopeEvidenceToWindows} is for.
   */
  readonly observations: number
  /**
   * Actionable signals in `decisions` that produced no resolved observation.
   *
   * Measured against the decisions supplied, so it is only meaningful when
   * `decisions` and `observations` cover the same span: pass the out-of-sample
   * decisions alongside out-of-sample observations, not the whole history
   * alongside a windowed slice, or every in-sample signal reads as unresolved.
   */
  readonly unresolved: number
  /** Abstained signals / total signals emitted. */
  readonly abstentionRate: number
  /**
   * Rank correlation of conviction vs forward alpha. `null` = unmeasurable.
   *
   * Whole-sample, like `observations` and `abstentionRate` — only `windowIc` is
   * windowed. The seat gate scores *this* field, so evidence labelled
   * `out-of-sample` must have been scoped before it got here.
   */
  readonly ic: number | null
  /** Sign agreement among observations with |conviction| > epsilon. */
  readonly hitRate: number | null
  readonly meanForwardAlpha: number | null
  /** IC per evaluation window, for the consistency check. Empty if unwindowed. */
  readonly windowIc: readonly (number | null)[]
}

export interface ScorecardOptions {
  /**
   * Evaluation windows to compute a per-window IC over — typically the
   * out-of-sample windows of a `WalkForwardReport`. Bounds are inclusive dates.
   */
  readonly windows?: readonly DateRange[]
  /**
   * Magnitude below which a conviction counts as neutral. Default 1e-9.
   *
   * A genuine neutral view is excluded from `hitRate` (it made no directional
   * claim, so there is no sign to be right about) but **stays in the IC**: it
   * is a real data point about whether conviction scales with outcome.
   */
  readonly epsilon?: number
}

/**
 * Build one scorecard per analyst seen in `decisions` or `observations`,
 * sorted by `analystId`.
 *
 * Throws if an observation names an analyst the decisions never recorded. That
 * combination is a caller error — the two inputs describe different runs — and
 * scoring it anyway would emit `abstentionRate: 0` for a seat whose abstentions
 * are simply unknown, which the seat gate would then read as a passing check
 * and promote on. Better to fail loud than to promote on invented numbers.
 */
export function buildScorecards(
  decisions: readonly DecisionRecord[],
  observations: readonly Observation[],
  options: ScorecardOptions = {},
): AnalystScorecard[] {
  const windows = options.windows ?? []
  const epsilon = options.epsilon ?? 1e-9

  const emitted = new Map<string, { total: number; abstained: number }>()
  for (const decision of decisions) {
    for (const signal of decision.signals) {
      const tally = emitted.get(signal.analystId) ?? { total: 0, abstained: 0 }
      tally.total++
      if (signal.abstained) tally.abstained++
      emitted.set(signal.analystId, tally)
    }
  }

  const resolved = new Map<string, Observation[]>()
  for (const observation of observations) {
    if (!emitted.has(observation.analystId)) {
      throw new Error(
        `buildScorecards: observation for analyst "${observation.analystId}" but no decision recorded one — ` +
          `decisions and observations must describe the same run, or the abstention rate is unknowable`,
      )
    }
    const list = resolved.get(observation.analystId) ?? []
    list.push(observation)
    resolved.set(observation.analystId, list)
  }

  // Every observed analyst is in `emitted` (the guard above), so the ledger
  // alone defines the panel — a seat that emitted only abstentions still gets a
  // scorecard saying so.
  const analystIds = [...emitted.keys()].sort()

  return analystIds.map((analystId) => {
    const tally = emitted.get(analystId) ?? { total: 0, abstained: 0 }
    const mine = resolved.get(analystId) ?? []

    // Signals that were actionable but never produced a measurable outcome.
    // Clamped: `observations` may be a window of what `decisions` covers, and a
    // negative count would be nonsense.
    const actionable = tally.total - tally.abstained
    const unresolved = Math.max(0, actionable - mine.length)

    return {
      analystId,
      observations: mine.length,
      unresolved,
      abstentionRate: tally.abstained / tally.total,
      ic: informationCoefficient(mine),
      hitRate: hitRate(mine, epsilon),
      meanForwardAlpha:
        mine.length === 0
          ? null
          : mine.reduce((sum, o) => sum + o.forwardAlpha, 0) / mine.length,
      windowIc: windows.map((window) =>
        informationCoefficient(mine.filter((o) => within(o.asOf, window))),
      ),
    }
  })
}

function informationCoefficient(observations: readonly Observation[]): number | null {
  return spearman(
    observations.map((o) => o.conviction),
    observations.map((o) => o.forwardAlpha),
  )
}

/**
 * Sign agreement over the directional views only. A zero realized alpha counts
 * as a miss: the view claimed a direction and nothing happened.
 */
function hitRate(observations: readonly Observation[], epsilon: number): number | null {
  const directional = observations.filter((o) => Math.abs(o.conviction) > epsilon)
  if (directional.length === 0) return null
  const hits = directional.filter((o) =>
    o.conviction > 0 ? o.forwardAlpha > 0 : o.forwardAlpha < 0,
  ).length
  return hits / directional.length
}

/** Decisions and observations narrowed to a set of evaluation windows. */
export interface ScopedEvidence {
  /** Decisions whose signals fall inside the windows, with the rest removed. */
  readonly decisions: readonly DecisionRecord[]
  /** Observations whose `asOf` falls inside the windows. */
  readonly observations: readonly Observation[]
  /** The windows, echoed so the whole composition is one expression. */
  readonly windows: readonly DateRange[]
}

/**
 * Narrow both halves of the evidence to a set of evaluation windows.
 *
 * This exists because the natural composition is the wrong one. `buildScorecards`
 * windows exactly one field — `windowIc`. `ic`, `observations` and
 * `abstentionRate` are whole-sample over whatever it was handed. So a caller who
 * passes the full history with the out-of-sample windows, and then labels the
 * result `source: "out-of-sample"`, gets a seat promoted on an IC measured over
 * the in-sample period, with an audit trail that reads clean and is wrong. It is
 * the most natural way to use these two functions together and it is the one
 * failure this layer exists to prevent.
 *
 * The same composition also inflates `unresolved` to the entire in-sample
 * history: every signal outside the windows is an actionable signal with no
 * matching observation.
 *
 * Both go away if the *inputs* are scoped first, so this makes that the easy
 * path:
 *
 * ```ts
 * const scoped = scopeEvidenceToWindows(decisions, observations, report.outOfSampleWindows)
 * const scorecards = buildScorecards(scoped.decisions, scoped.observations, {
 *   windows: scoped.windows,
 * })
 * const seat = evaluateSeat({ scorecard: scorecards[0], source: "out-of-sample" })
 * ```
 *
 * Signals are filtered on their own `asOf` rather than the record's, so the
 * abstention rate reflects exactly the signals the windows cover. A record left
 * with no signals is dropped.
 *
 * Throws when `windows` is empty. Returning everything unfiltered would make
 * this helper the very contamination path it exists to close, and "scope to
 * nothing" is never what a caller means.
 */
export function scopeEvidenceToWindows(
  decisions: readonly DecisionRecord[],
  observations: readonly Observation[],
  windows: readonly DateRange[],
): ScopedEvidence {
  if (windows.length === 0) {
    throw new Error(
      "scopeEvidenceToWindows: no windows supplied — scoping to nothing is never what a caller means, " +
        "and returning the whole sample would produce exactly the in-sample evidence this helper exists to prevent",
    )
  }

  const inWindows = (asOf: string): boolean => windows.some((window) => within(asOf, window))

  const scopedDecisions: DecisionRecord[] = []
  for (const decision of decisions) {
    const signals = decision.signals.filter((signal) => inWindows(signal.asOf))
    if (signals.length === 0) continue
    scopedDecisions.push(
      signals.length === decision.signals.length ? decision : { ...decision, signals },
    )
  }

  return {
    decisions: scopedDecisions,
    observations: observations.filter((observation) => inWindows(observation.asOf)),
    windows,
  }
}

/**
 * Inclusive date-window membership. A signal's `asOf` may be a full instant
 * while window bounds are dates, so compare on the date part — otherwise an
 * intraday cutoff on the closing date of a window would sort *after* the bound
 * and fall out of its own window.
 */
function within(asOf: string, window: DateRange): boolean {
  const day = asOf.slice(0, 10)
  return day >= window.from && day <= window.to
}
