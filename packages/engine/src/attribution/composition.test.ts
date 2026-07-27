import { describe, expect, it } from "vitest"

import type { DateRange } from "../data/market-data.js"
import type { DecisionRecord } from "../ledger/ledger.js"
import type { Signal } from "../types.js"
import type { Observation } from "./outcomes.js"
import { buildScorecards, scopeEvidenceToWindows, type AnalystScorecard } from "./scorecard.js"
import { evaluateSeat, type SeatGateResult } from "./seat-gate.js"

/**
 * The composition test: ledger + observations → scorecard → seat gate.
 *
 * Each of those three pieces is correct in isolation, and wiring them together
 * the obvious way still promotes a seat that has no out-of-sample edge. That is
 * the failure this file exists to pin down.
 *
 * `buildScorecards` windows exactly one field, `windowIc`. `ic`, `observations`
 * and `abstentionRate` are whole-sample over whatever it was handed. So the
 * caller who passes the full history alongside the out-of-sample windows — the
 * natural reading of both signatures — and then labels the evidence
 * `out-of-sample` gets a seat promoted on an in-sample IC, with an audit trail
 * that says `out-of-sample: ok` and is wrong. `source` is a label the gate
 * cannot corroborate; nothing in an `AnalystScorecard` records the span it was
 * built over.
 *
 * `scopeEvidenceToWindows` is the fix, and the point of these tests is that it
 * is not decoration: the same analyst comes out `active` under the natural
 * composition and `shadow` under the scoped one, on identical underlying data.
 *
 * The fixture is a purpose-built overfitter — an analyst whose conviction
 * ordering tracks realized alpha in-sample (IC exactly +0.15) and mildly
 * inverts out-of-sample (IC exactly −0.05). Every value is literal or derived by
 * pure arithmetic from an index, per AGENTS.md: nothing here depends on when it
 * runs.
 */

const ANALYST = "overfitter"

/** In-sample: 41 views on one cutoff, IC exactly +0.15. */
const IN_SAMPLE_N = 41
/** Out-of-sample: 31 views across two windows, IC exactly −0.05. */
const OUT_OF_SAMPLE_N = 31

/**
 * Rotating the alpha ranking by 7 places against the conviction ranking gives a
 * Spearman rho of `1 − 6·n·k·(n−k)/(n(n²−1))` with no ties. At n = 41 that is
 * exactly +0.15; at n = 31, exactly −0.05. Chosen so the numbers in the
 * assertions are the numbers in the plan, not an artefact of a noise generator.
 */
const ROTATION = 7

const IN_SAMPLE_ASOF = "2024-03-15"
const OOS_WINDOW_ONE_ASOF = "2024-08-15"
const OOS_WINDOW_TWO_ASOF = "2024-11-15"

/** Two out-of-sample windows, as a walk-forward report would supply them. */
const OOS_WINDOWS: readonly DateRange[] = [
  { from: "2024-07-01", to: "2024-09-30" },
  { from: "2024-10-01", to: "2024-12-31" },
]

function observationAt(
  asOf: string,
  index: number,
  conviction: number,
  forwardAlpha: number,
  prefix: string,
): Observation {
  return {
    analystId: ANALYST,
    securityId: `${prefix}-${index}`,
    asOf,
    conviction,
    horizonDays: 5,
    forwardReturn: forwardAlpha + 0.01,
    benchmarkReturn: 0.01,
    forwardAlpha,
    resolvedAt: `${asOf}T23:59:59.999Z`,
  }
}

const inSampleObservations: readonly Observation[] = Array.from(
  { length: IN_SAMPLE_N },
  (_unused, i) =>
    observationAt(
      IN_SAMPLE_ASOF,
      i,
      (i + 1) * 0.02,
      (((i + ROTATION) % IN_SAMPLE_N) + 1) * 0.001,
      "IS",
    ),
)

const outOfSampleObservations: readonly Observation[] = Array.from(
  { length: OUT_OF_SAMPLE_N },
  (_unused, j) =>
    observationAt(
      j < 16 ? OOS_WINDOW_ONE_ASOF : OOS_WINDOW_TWO_ASOF,
      j,
      // Offset half a step off the in-sample grid so the two blocks never tie
      // when they are pooled — a tie would blunt the whole-sample IC for a
      // reason that has nothing to do with the property under test.
      (j + 1) * 0.02 + 0.01,
      ((((j + ROTATION) % OUT_OF_SAMPLE_N) + 1) * 0.001) + 0.0005,
      "OOS",
    ),
)

const allObservations: readonly Observation[] = [
  ...inSampleObservations,
  ...outOfSampleObservations,
]

/** One recorded signal per observation, grouped into a record per cutoff. */
function decisionsFor(observations: readonly Observation[]): DecisionRecord[] {
  const byCutoff = new Map<string, Signal[]>()
  for (const o of observations) {
    const signals = byCutoff.get(o.asOf) ?? []
    signals.push({
      analystId: o.analystId,
      securityId: o.securityId,
      asOf: o.asOf,
      conviction: o.conviction,
      horizonDays: o.horizonDays,
      thesis: null,
      abstained: false,
    })
    byCutoff.set(o.asOf, signals)
  }
  return [...byCutoff.entries()].map(([asOf, signals]) => ({
    asOf,
    signals,
    views: [],
    targetWeights: [],
    orders: [],
    gateActions: [],
    fills: [],
  }))
}

const allDecisions = decisionsFor(allObservations)

function only(scorecards: readonly AnalystScorecard[]): AnalystScorecard {
  const card = scorecards.find((c) => c.analystId === ANALYST)
  if (!card) throw new Error(`no scorecard for ${ANALYST}`)
  return card
}

function failing(result: SeatGateResult): string[] {
  return result.reasons.filter((r) => !r.ok).map((r) => r.code)
}

describe("attribution composition — the fixture", () => {
  it("is an analyst that works in-sample and does not out-of-sample", () => {
    const inSample = only(buildScorecards(decisionsFor(inSampleObservations), inSampleObservations))
    const outOfSample = only(
      buildScorecards(decisionsFor(outOfSampleObservations), outOfSampleObservations),
    )

    expect(inSample.observations).toBe(IN_SAMPLE_N)
    expect(inSample.ic).toBeCloseTo(0.15, 12)
    expect(outOfSample.observations).toBe(OUT_OF_SAMPLE_N)
    expect(outOfSample.ic).toBeCloseTo(-0.05, 12)
    // Enough out-of-sample observations to clear the sample-size bar on their
    // own, so the seat gate's verdict below turns on the IC and nothing else.
    expect(OUT_OF_SAMPLE_N).toBeGreaterThanOrEqual(30)
  })
})

describe("attribution composition — evidence scoped through the helper", () => {
  const scoped = scopeEvidenceToWindows(allDecisions, allObservations, OOS_WINDOWS)
  const scorecard = only(
    buildScorecards(scoped.decisions, scoped.observations, { windows: scoped.windows }),
  )

  it("scopes both halves of the evidence, not just the windowed IC", () => {
    expect(scorecard.observations).toBe(OUT_OF_SAMPLE_N)
    expect(scorecard.ic).toBeCloseTo(-0.05, 12)
    // The decisions were scoped too, so `unresolved` counts only signals the
    // windows actually cover. Left whole (see below) it would report the entire
    // in-sample history as unresolved out-of-sample work.
    expect(scorecard.unresolved).toBe(0)
    expect(scorecard.windowIc).toHaveLength(OOS_WINDOWS.length)
  })

  it("keeps the seat in shadow, failing on the information coefficient alone", () => {
    const result = evaluateSeat({ scorecard, source: "out-of-sample" })
    expect(result.state).toBe("shadow")
    expect(failing(result)).toEqual(["information-coefficient"])
  })

  it("would not have been saved by the consistency check", () => {
    // Half the windows show a positive IC, so `ic-consistency` passes while the
    // pooled out-of-sample IC is negative. Per-window agreement is not a
    // substitute for scoping the evidence.
    const consistency = evaluateSeat({ scorecard, source: "out-of-sample" }).reasons.find(
      (r) => r.code === "ic-consistency",
    )
    expect(consistency?.ok).toBe(true)
  })
})

describe("attribution composition — the contaminated alternative", () => {
  /*
   * DELIBERATE: these two tests assert the wrong answer, because the wrong
   * answer is what the natural composition produces today and the seat gate is
   * specified not to detect it (`source` is a caller-asserted label, and the
   * five checks and their order are fixed).
   *
   * They exist so the hazard is visible and pinned rather than latent. If a
   * future change makes the gate reject whole-sample evidence carrying an
   * `out-of-sample` label, these tests SHOULD fail — that is the fix landing,
   * and the right response is to update them, not to restore the old behaviour.
   */

  it("promotes the same analyst to active on whole-sample evidence labelled out-of-sample", () => {
    const scorecard = only(buildScorecards(allDecisions, allObservations))

    // The in-sample block dominates the pooled IC and lifts it over the floor.
    expect(scorecard.observations).toBe(IN_SAMPLE_N + OUT_OF_SAMPLE_N)
    expect(scorecard.ic).toBeCloseTo(0.1399, 4)

    const result = evaluateSeat({ scorecard, source: "out-of-sample" })
    expect(result.state).toBe("active")
    expect(failing(result)).toEqual([])
    // And the audit trail reads clean, which is what makes it dangerous: the
    // record of this promotion contains nothing a reviewer could object to.
    expect(result.reasons.find((r) => r.code === "out-of-sample")?.ok).toBe(true)
  })

  it("inflates unresolved to the whole in-sample history when only observations are scoped", () => {
    // The half-scoped middle ground: out-of-sample observations, whole-history
    // decisions. The IC is now honest but `unresolved` reports 41 signals that
    // were never in scope, which reads as a data-quality problem that is not
    // there — and is one `minObservations`-style threshold away from mattering.
    const scorecard = only(buildScorecards(allDecisions, outOfSampleObservations))
    expect(scorecard.observations).toBe(OUT_OF_SAMPLE_N)
    expect(scorecard.unresolved).toBe(IN_SAMPLE_N)
  })
})
