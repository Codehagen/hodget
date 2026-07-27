import "server-only"

import { runConfigSchema } from "@workspace/db"
import {
  attributeRun,
  FIXTURE_IDS,
  FixtureOutcomeData,
  loadFixtureDataset,
  type FixtureDataset,
} from "@workspace/engine"

import { getRunDetail, listRuns } from "./runs"

/**
 * Seat-gate evidence for the analysts surface (plan 024, step 3).
 *
 * Every export here validates the session first — through {@link listRuns} and
 * {@link getRunDetail}, which are the DAL's owned-run helpers — so this module
 * keeps `lib/dal/index.ts`'s contract without opening a second path to
 * `@workspace/db`.
 *
 * Three deliberate choices, each of which is a claim about honesty rather than
 * about code:
 *
 * - **Computed on read, never stored** (design decision 1). A scorecard is a
 *   pure function of `(decisions, outcomes, windows)`; persisting it would add a
 *   migration and freeze whatever the formula was on the day the run executed.
 * - **Scoped to the user's most recent completed run** (design decision 2). One
 *   run has clean provenance — an id, a date range, a universe. Pooling across
 *   runs mixes universes and panel configs, and the seat gate cannot corroborate
 *   what it was handed.
 * - **No windows are supplied, so the evidence is `in-sample`** and every seat
 *   comes back `shadow` with the `out-of-sample` check failing. That is the true
 *   answer for a backtest with no walk-forward split, and labelling it otherwise
 *   to make a seat pass would invert the meaning of the gate.
 */

/**
 * The security alpha is measured against — and, in this dataset, a **proxy**.
 *
 * `packages/engine/fixtures/dataset.json` prices exactly three securities
 * (`US-XNAS-SYNA`, `NO-XOSL-OSYN`, `NO-XOSL-MICR`) and contains no benchmark
 * index; plan 003's amendment says the generator should add one per covered MIC
 * and that has not happened. So "alpha" here is excess return over another
 * portfolio name, not over a market — the wrong quantity, not a noisy one
 * (design decision 6). Regenerating the dataset to fix it would churn the
 * committed golden backtests, so instead the fact is propagated: `isProxy` rides
 * along on {@link SeatEvidenceView} and the panel refuses to print an IC.
 *
 * The US equity is the designated proxy because it has the dataset's longest
 * session series (253 sessions across the full generated span, against the Oslo
 * calendar's 252), which maximizes the dates a benchmark leg can be found for.
 * Observations whose entry or exit date is missing from the benchmark resolve to
 * nothing rather than to a wrong number.
 *
 * It is **also a member of the traded universe** — the run executor defaults to
 * all three fixture securities — and that costs real coverage. `attributeRun`
 * drops every signal on the benchmark security before resolution, because a
 * security's alpha against itself is identically 0 and a block of exact ties in
 * the middle of the conviction ranking biases the rank correlation rather than
 * merely widening it. So roughly a third of the panel's coverage goes unscored
 * here, and what survives is measured against a name that is not a market. Both
 * facts are why the panel prints no IC at all.
 */
const BENCHMARK_PROXY_SECURITY_ID = FIXTURE_IDS.usEquity

/** One seat-gate check, exactly as the engine recorded it. */
export interface SeatReasonView {
  readonly code: string
  readonly ok: boolean
  readonly detail: string
}

/** One analyst's seat verdict and the evidence behind it. */
export interface SeatAnalystView {
  readonly analystId: string
  readonly state: "active" | "shadow"
  readonly observations: number
  /**
   * Rank correlation of conviction vs realized forward alpha, or `null` when it
   * is **unmeasurable** (constant conviction, or too few observations).
   *
   * `null` is not zero. A renderer that prints `0.00` for it states "measured,
   * no edge" — a different and false claim.
   */
  readonly ic: number | null
  readonly abstentionRate: number
  readonly reasons: readonly SeatReasonView[]
}

/**
 * A serializable snapshot of one run's seat gate. Plain JSON by construction —
 * no class instances, no functions, no `Date`s — because `AnalystsView` is a
 * client component and this crosses the RSC boundary.
 */
export interface SeatEvidenceView {
  readonly runId: string
  /**
   * How to name the run on screen. A `RunConfig` carries no user-supplied name,
   * so the id is the label; inventing a friendlier one would be a claim the data
   * does not support.
   */
  readonly runLabel: string
  /** The run's backtest range, or the dataset's full span when it did not set one. */
  readonly asOfRange: { readonly from: string; readonly to: string }
  /** What alpha was measured against, and whether that thing is a real benchmark. */
  readonly benchmark: { readonly securityId: string; readonly isProxy: boolean }
  readonly analysts: readonly SeatAnalystView[]
}

/**
 * Seat evidence from the session user's most recent completed run, or `null` if
 * they have none.
 *
 * `null` is the honest empty case — not an empty object, not a throw: a user with
 * no completed run has no evidence, which is different from having evidence that
 * says nothing.
 *
 * **"Most recent" is scoped to the newest 50 runs**, which is
 * `listRunsByOwner`'s default page size and the only page {@link listRuns}
 * exposes. Queue 50 runs after your last completed one and this returns `null`
 * — indistinguishable, on screen, from never having completed a run. Widening it
 * needs a status-filtered query in `@workspace/db`, which plan 024 put out of
 * scope; until then the limitation is documented rather than hidden, because the
 * failure is silent and a reader of this function should not have to derive it.
 */
export async function getSeatEvidence(): Promise<SeatEvidenceView | null> {
  // listRuns() is session-validated and owner-scoped, and returns the newest 50.
  const latest = (await listRuns()).find((run) => run.status === "completed")
  if (!latest) return null

  // Re-fetched through the owned-run helper rather than trusted from the list:
  // one authorization path, checked at every read.
  const detail = await getRunDetail(latest.id)
  if (!detail) return null

  const { dataset, outcomes } = await fixtureAttributionInputs()
  const attribution = await attributeRun({
    decisions: detail.decisions,
    outcomes,
    benchmarkSecurityId: BENCHMARK_PROXY_SECURITY_ID,
    // No `windows`: this run was not walk-forward split, so the evidence is
    // in-sample and `attributeRun` labels it so. There is deliberately no way to
    // claim otherwise from here.
  })

  return {
    runId: latest.id,
    runLabel: latest.id,
    asOfRange: runRange(latest.config, dataset),
    benchmark: { securityId: BENCHMARK_PROXY_SECURITY_ID, isProxy: true },
    analysts: attribution.analysts.map(({ scorecard, seat }) => ({
      analystId: scorecard.analystId,
      state: seat.state,
      observations: scorecard.observations,
      ic: scorecard.ic,
      abstentionRate: scorecard.abstentionRate,
      reasons: seat.reasons.map((reason) => ({
        code: reason.code,
        ok: reason.ok,
        detail: reason.detail,
      })),
    })),
  }
}

/**
 * The range the run actually covered. A `RunConfig` may omit `range`, in which
 * case the executor spans the dataset — mirrored here so the line under the
 * panel names the same dates the run used (`run-executor.ts`).
 *
 * An unparseable config falls back the same way rather than throwing: a stored
 * config that no longer matches the schema should cost the date line, not the
 * whole panel.
 */
function runRange(
  config: unknown,
  dataset: FixtureDataset,
): { from: string; to: string } {
  const parsed = runConfigSchema.safeParse(config)
  return parsed.success && parsed.data.range
    ? parsed.data.range
    : { from: dataset.meta.from, to: dataset.meta.to }
}

/**
 * The fixture dataset and the outcome port over it, loaded once per process.
 *
 * `dataset.json` is ~259 KB of JSON that is then Zod-validated and indexed into
 * per-security bar maps; doing that per request would be pure waste for a file
 * that cannot change while the process lives. The promise is cached (not the
 * resolved value) so concurrent requests share one read, and it is cleared on
 * rejection so a transient failure is not memoized forever.
 */
let fixtureInputs:
  | Promise<{ dataset: FixtureDataset; outcomes: FixtureOutcomeData }>
  | undefined

function fixtureAttributionInputs(): Promise<{
  dataset: FixtureDataset
  outcomes: FixtureOutcomeData
}> {
  fixtureInputs ??= loadFixtureDataset()
    .then((dataset) => ({ dataset, outcomes: new FixtureOutcomeData(dataset) }))
    .catch((error: unknown) => {
      fixtureInputs = undefined
      throw error
    })
  return fixtureInputs
}
