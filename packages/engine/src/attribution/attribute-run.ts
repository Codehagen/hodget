import type { DateRange } from "../data/market-data.js"
import type { DecisionRecord } from "../ledger/ledger.js"
import type { OutcomeData } from "./outcomes.js"
import { resolveObservations } from "./outcomes.js"
import { buildScorecards, scopeEvidenceToWindows, type AnalystScorecard } from "./scorecard.js"
import { evaluateSeat, type SeatGateConfig, type SeatGateResult } from "./seat-gate.js"

/**
 * The attribution composition (plan 024, step 2): one recorded run in, a seat
 * verdict per analyst out.
 *
 * The four pieces underneath — `resolveObservations`, `scopeEvidenceToWindows`,
 * `buildScorecards`, `evaluateSeat` — are each correct in isolation, and the
 * *obvious* way to wire them together promotes a seat that has no out-of-sample
 * edge (`composition.test.ts` pins that hazard deliberately). `buildScorecards`
 * windows exactly one field; `ic`, `observations` and `abstentionRate` are
 * whole-sample over whatever it was handed. So a caller who passes the full
 * history alongside the out-of-sample windows and labels the result
 * `out-of-sample` gets a promotion on an in-sample IC with an audit trail that
 * reads clean and is wrong.
 *
 * This function exists so that composition is not something a caller has to get
 * right. It owns the one rule that makes the gate's first check mean anything:
 *
 * > **Evidence is labelled `out-of-sample` if and only if `windows` were
 * > supplied and the inputs were scoped to them. With no windows the label is
 * > `in-sample`, and no seat can be promoted.**
 *
 * That rule is not configurable, and deliberately so. An `AnalystScorecard`
 * carries no provenance, so `source` is a label `evaluateSeat` cannot
 * corroborate (plan 023's known gap). Making it an input here would hand every
 * caller a one-word way to promote a seat on the data it was designed against —
 * which is the single failure this whole layer exists to prevent. If a seat
 * comes back `shadow` with `out-of-sample` failing, the answer is walk-forward
 * windows, not an override.
 */

export interface AttributeRunInput {
  /**
   * The run's decision ledger. Both halves of the evidence come from here: the
   * signals to resolve, and the abstention counts that observations cannot
   * supply (they have already dropped abstentions).
   */
  readonly decisions: readonly DecisionRecord[]
  /**
   * The forward-looking port. Never a `MarketData` — see `outcomes.ts`. Its
   * `sessionsAfter` must be **strictly** after the cutoff; `resolveObservations`
   * verifies this per observation and fails closed if it is not.
   */
  readonly outcomes: OutcomeData
  /**
   * The benchmark alpha is measured against, over the identical two dates.
   *
   * Signals **on this security itself** are dropped before resolution: its alpha
   * against itself is identically 0 by construction, which is an artifact of the
   * arithmetic rather than a measurement of the analyst. Left in, a benchmark
   * that is also a member of the traded universe contributes a block of exact
   * ties that drags the rank correlation toward 0 — not noise around the truth,
   * but a systematic pull. See {@link AttributeRunResult.droppedBenchmarkSignals}.
   */
  readonly benchmarkSecurityId: string
  /**
   * Evaluation windows — typically a `WalkForwardReport`'s out-of-sample
   * windows. Supplying them scopes the evidence and makes it `out-of-sample`;
   * omitting them leaves it `in-sample`, which no seat can be promoted on.
   *
   * An empty array is a caller bug, not a way to opt out: it throws, because
   * "scope to nothing" is never what anyone means and returning the whole
   * sample under an out-of-sample label is exactly the contamination above.
   */
  readonly windows?: readonly DateRange[]
  /** Thresholds for the seat gate. Defaults documented on {@link SeatGateConfig}. */
  readonly seatGate?: SeatGateConfig
}

export interface AnalystAttribution {
  readonly scorecard: AnalystScorecard
  readonly seat: SeatGateResult
}

export interface AttributeRunResult {
  /** One entry per analyst the ledger recorded, sorted by `analystId`. */
  readonly analysts: readonly AnalystAttribution[]
  /**
   * Resolved observations behind these scorecards, i.e. the sum of
   * `scorecard.observations`.
   *
   * Scoped: when `windows` are supplied these are the counts over the scoped
   * evidence, not over the whole run. Reporting whole-run totals next to
   * window-scoped scorecards would restate the very mismatch
   * `scopeEvidenceToWindows` exists to remove — a reader comparing the two
   * would find them disagreeing and have no way to tell which was the truth.
   */
  readonly resolved: number
  /**
   * Actionable signals in the same evidence that produced no resolved
   * observation — an open or unmeasurable window, never a zero return.
   */
  readonly unresolved: number
  /**
   * Signals excluded before resolution because they were on the benchmark
   * security itself, abstentions included.
   *
   * Reported rather than dropped silently: a non-zero count here means the
   * benchmark is a member of the traded universe, so the scorecards below are
   * built over a smaller sample than the ledger recorded and the reader should
   * know by how much.
   *
   * Counted over the whole ledger, before any window scoping — it describes the
   * inputs, not the evaluated evidence.
   */
  readonly droppedBenchmarkSignals: number
}

/**
 * Attribute one run: resolve every recorded signal into realized forward alpha,
 * score each analyst, and gate its seat.
 *
 * Deterministic and pure given its inputs and the port's answers: no clock, no
 * randomness, and the output order is `analystId`-sorted whatever order the
 * ledger recorded things in.
 */
export async function attributeRun(input: AttributeRunInput): Promise<AttributeRunResult> {
  const { decisions, outcomes, benchmarkSecurityId, windows, seatGate } = input

  // A security cannot be attributed against itself. Its forward return *is* the
  // benchmark return over the identical two dates, so `forwardAlpha` is exactly
  // 0 for every such signal whatever the analyst thought — and a benchmark that
  // is also traded (the fixture dataset's case) turns that into a block of exact
  // ties in the middle of the sample. Dropping the signals from the *decisions*,
  // not just from the resolution input, keeps `unresolved` honest: these are not
  // views whose outcome is still open, they are views this layer declines to
  // score at all.
  const { attributable, droppedBenchmarkSignals } = withoutBenchmarkSignals(
    decisions,
    benchmarkSecurityId,
  )

  const signals = attributable.flatMap((decision) => decision.signals)
  const resolution = await resolveObservations(signals, outcomes, {
    benchmark: benchmarkSecurityId,
  })

  // The whole rule, in one branch. Note that `source` is derived here and never
  // read from the input — there is no path to an `out-of-sample` label that did
  // not go through `scopeEvidenceToWindows`.
  const evidence =
    windows === undefined
      ? {
          decisions: attributable,
          observations: resolution.observations,
          windows: [] as readonly DateRange[],
          source: "in-sample" as const,
        }
      : {
          ...scopeEvidenceToWindows(attributable, resolution.observations, windows),
          source: "out-of-sample" as const,
        }

  const scorecards = buildScorecards(evidence.decisions, evidence.observations, {
    windows: evidence.windows,
  })

  return {
    analysts: scorecards.map((scorecard) => ({
      scorecard,
      seat: evaluateSeat({ scorecard, source: evidence.source }, seatGate),
    })),
    resolved: scorecards.reduce((total, card) => total + card.observations, 0),
    unresolved: scorecards.reduce((total, card) => total + card.unresolved, 0),
    droppedBenchmarkSignals,
  }
}

/**
 * The ledger with every signal on the benchmark security removed, plus how many
 * that was.
 *
 * Records left with no signals are dropped, mirroring
 * {@link scopeEvidenceToWindows}. An analyst that only ever covered the
 * benchmark therefore leaves the panel entirely — which is the truthful answer:
 * nothing it emitted is attributable, so it has no evidence rather than empty
 * evidence.
 */
function withoutBenchmarkSignals(
  decisions: readonly DecisionRecord[],
  benchmarkSecurityId: string,
): { attributable: readonly DecisionRecord[]; droppedBenchmarkSignals: number } {
  const attributable: DecisionRecord[] = []
  let droppedBenchmarkSignals = 0

  for (const decision of decisions) {
    const signals = decision.signals.filter(
      (signal) => signal.securityId !== benchmarkSecurityId,
    )
    droppedBenchmarkSignals += decision.signals.length - signals.length
    if (signals.length === 0) continue
    attributable.push(
      signals.length === decision.signals.length ? decision : { ...decision, signals },
    )
  }

  return { attributable, droppedBenchmarkSignals }
}
