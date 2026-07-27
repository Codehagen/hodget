import { describe, expect, it } from "vitest"

import type { DateRange } from "../data/market-data.js"
import type { DecisionRecord } from "../ledger/ledger.js"
import type { Signal } from "../types.js"
import { attributeRun, type AttributeRunResult } from "./attribute-run.js"
import type { OutcomeBar, OutcomeData } from "./outcomes.js"

/**
 * `attributeRun` owns one rule: evidence is `out-of-sample` if and only if
 * windows were supplied and the inputs were scoped to them. These tests are
 * built so that rule is the *only* difference between a promoted seat and a
 * shadowed one — same analyst, same data, same thresholds.
 *
 * Every value below is a literal or pure arithmetic on an index (AGENTS.md:
 * fixtures are deterministic). Nothing here depends on when it runs.
 */

const STRONG = "z-strong"
const SILENT = "a-silent"
const BENCHMARK = "BENCH"

/** In-sample cutoff, outside both evaluation windows. */
const IN_SAMPLE_ASOF = "2024-03-15"
const OOS_ONE_ASOF = "2024-08-15"
const OOS_TWO_ASOF = "2024-11-15"

/** Three sessions per cutoff — entry, a middle bar, and the exit at horizon 2. */
const HORIZON_DAYS = 2
const SESSIONS: Readonly<Record<string, readonly [string, string, string]>> = {
  [IN_SAMPLE_ASOF]: ["2024-03-18", "2024-03-19", "2024-03-20"],
  [OOS_ONE_ASOF]: ["2024-08-16", "2024-08-19", "2024-08-20"],
  [OOS_TWO_ASOF]: ["2024-11-18", "2024-11-19", "2024-11-20"],
}

const OOS_WINDOWS: readonly DateRange[] = [
  { from: "2024-07-01", to: "2024-09-30" },
  { from: "2024-10-01", to: "2024-12-31" },
]

/**
 * 64 one-shot views, each on its own security so a security's price series
 * belongs to exactly one cutoff. The first 32 are in-sample; the rest split
 * evenly across the two out-of-sample windows. Both blocks comfortably clear
 * `minObservations: 30` on their own, so the seat gate's verdict turns on the
 * evidence label and nothing else.
 */
const IN_SAMPLE_N = 32
const OOS_N = 32
const TOTAL_N = IN_SAMPLE_N + OOS_N

function cutoffFor(k: number): string {
  if (k < IN_SAMPLE_N) return IN_SAMPLE_ASOF
  return k < IN_SAMPLE_N + OOS_N / 2 ? OOS_ONE_ASOF : OOS_TWO_ASOF
}

function securityFor(k: number): string {
  return `SEC-${String(k).padStart(2, "0")}`
}

/**
 * Conviction and realized alpha both rise with `k`, so the rank correlation is
 * exactly +1 whole-sample and within either window. An analyst whose stronger
 * views really do earn more — the case where the evidence label is the only
 * thing standing between shadow and active.
 */
function convictionFor(k: number): number {
  return (k + 1) / 100
}

const ENTRY_CLOSE = 100

function exitCloseFor(k: number): number {
  return ENTRY_CLOSE + (k + 1) / 10
}

/** A `Map`-backed port with the same strictly-after semantics the real ones owe. */
function outcomeDataFrom(series: ReadonlyMap<string, readonly OutcomeBar[]>): OutcomeData {
  return {
    sessionsAfter(securityId, after, limit) {
      const bars = series.get(securityId) ?? []
      const afterDay = after.slice(0, 10)
      return Promise.resolve(bars.filter((bar) => bar.date > afterDay).slice(0, limit))
    },
  }
}

function buildSeries(): ReadonlyMap<string, readonly OutcomeBar[]> {
  const series = new Map<string, readonly OutcomeBar[]>()
  for (let k = 0; k < TOTAL_N; k++) {
    const sessions = SESSIONS[cutoffFor(k)]!
    series.set(securityFor(k), [
      { date: sessions[0], adjClose: ENTRY_CLOSE },
      { date: sessions[1], adjClose: ENTRY_CLOSE },
      { date: sessions[2], adjClose: exitCloseFor(k) },
    ])
  }
  // A flat benchmark across every session, so forward alpha is the raw forward
  // return and the arithmetic in the assertions stays readable.
  series.set(
    BENCHMARK,
    Object.values(SESSIONS)
      .flat()
      .sort()
      .map((date) => ({ date, adjClose: ENTRY_CLOSE })),
  )
  return series
}

const outcomes = outcomeDataFrom(buildSeries())

type SignalOverrides = Partial<Signal> & Pick<Signal, "analystId" | "securityId" | "asOf">

function signal(overrides: SignalOverrides): Signal {
  return {
    conviction: 0,
    horizonDays: HORIZON_DAYS,
    thesis: null,
    abstained: false,
    ...overrides,
  }
}

/**
 * The ledger: `STRONG` emits an actionable view per security (plus one whose
 * horizon runs past the data, so `unresolved` is exercised), and `SILENT`
 * abstains on every one of them. `STRONG` is pushed first so a sorted output is
 * observably a choice rather than insertion order.
 */
function buildDecisions(): DecisionRecord[] {
  const byCutoff = new Map<string, Signal[]>()
  const push = (asOf: string, s: Signal): void => {
    const list = byCutoff.get(asOf) ?? []
    list.push(s)
    byCutoff.set(asOf, list)
  }

  for (let k = 0; k < TOTAL_N; k++) {
    const asOf = cutoffFor(k)
    const securityId = securityFor(k)
    push(asOf, signal({ analystId: STRONG, securityId, asOf, conviction: convictionFor(k) }))
    push(asOf, signal({ analystId: SILENT, securityId, asOf, abstained: true }))
  }

  // Horizon 5 needs six sessions; the fixture has three. Unresolved, never
  // zero-filled — and it sits inside an evaluation window, so it survives
  // scoping and the count holds in both modes.
  push(
    OOS_TWO_ASOF,
    signal({
      analystId: STRONG,
      securityId: securityFor(TOTAL_N - 1),
      asOf: OOS_TWO_ASOF,
      conviction: 0.5,
      horizonDays: 5,
    }),
  )

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

const decisions = buildDecisions()

function seatFor(result: AttributeRunResult, analystId: string) {
  const entry = result.analysts.find((a) => a.scorecard.analystId === analystId)
  if (!entry) throw new Error(`no attribution for ${analystId}`)
  return entry
}

function failing(result: AttributeRunResult, analystId: string): string[] {
  return seatFor(result, analystId).seat.reasons.filter((r) => !r.ok).map((r) => r.code)
}

describe("attributeRun — no windows means in-sample, and in-sample never promotes", () => {
  it("shadows every seat, with `out-of-sample` among the failures", async () => {
    const result = await attributeRun({ decisions, outcomes, benchmarkSecurityId: BENCHMARK })

    for (const { seat } of result.analysts) {
      expect(seat.state).toBe("shadow")
      expect(seat.reasons.find((r) => r.code === "out-of-sample")?.ok).toBe(false)
    }
  })

  it("shadows an otherwise flawless analyst on the label alone", async () => {
    const result = await attributeRun({ decisions, outcomes, benchmarkSecurityId: BENCHMARK })
    const { scorecard } = seatFor(result, STRONG)

    // Every other check passes: a perfect IC over a large sample with no
    // abstentions. The only thing standing between this seat and a promotion is
    // that nothing scoped the evidence.
    expect(scorecard.observations).toBe(TOTAL_N)
    expect(scorecard.ic).toBeCloseTo(1, 12)
    expect(scorecard.abstentionRate).toBe(0)
    expect(failing(result, STRONG)).toEqual(["out-of-sample"])
  })

  it("labels the evidence in-sample even when the caller wants otherwise", async () => {
    // There is no input that flips this. The absence of a `source` option is the
    // point: `AnalystScorecard` carries no provenance, so a caller-supplied
    // label would be an uncorroborated one-word promotion path.
    const input = { decisions, outcomes, benchmarkSecurityId: BENCHMARK }
    expect(Object.keys(input)).not.toContain("source")
    const result = await attributeRun(input)
    const reason = seatFor(result, STRONG).seat.reasons[0]
    expect(reason?.code).toBe("out-of-sample")
    expect(reason?.ok).toBe(false)
  })
})

describe("attributeRun — windows scope the evidence and make it out-of-sample", () => {
  it("scores only the observations the windows cover", async () => {
    const unscoped = await attributeRun({ decisions, outcomes, benchmarkSecurityId: BENCHMARK })
    const scoped = await attributeRun({
      decisions,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
      windows: OOS_WINDOWS,
    })

    // The counts differ, which is the observable proof that windows scoped the
    // *inputs* rather than only adding a `windowIc` column.
    expect(unscoped.resolved).toBe(TOTAL_N)
    expect(scoped.resolved).toBe(OOS_N)
    expect(seatFor(unscoped, STRONG).scorecard.observations).toBe(TOTAL_N)
    expect(seatFor(scoped, STRONG).scorecard.observations).toBe(OOS_N)

    // And `unresolved` stays scoped too: the one truncated signal, not the whole
    // in-sample history restated as unresolved out-of-sample work.
    expect(unscoped.unresolved).toBe(1)
    expect(scoped.unresolved).toBe(1)
  })

  it("promotes the analyst that earned it, on the same data that shadowed it unscoped", async () => {
    const result = await attributeRun({
      decisions,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
      windows: OOS_WINDOWS,
    })

    expect(failing(result, STRONG)).toEqual([])
    expect(seatFor(result, STRONG).seat.state).toBe("active")
    expect(seatFor(result, STRONG).scorecard.windowIc).toHaveLength(OOS_WINDOWS.length)
  })

  it("rejects an empty window set instead of silently scoping to nothing", async () => {
    await expect(
      attributeRun({ decisions, outcomes, benchmarkSecurityId: BENCHMARK, windows: [] }),
    ).rejects.toThrow(/scopeEvidenceToWindows/)
  })

  it("respects seat-gate config overrides", async () => {
    const result = await attributeRun({
      decisions,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
      windows: OOS_WINDOWS,
      seatGate: { minObservations: OOS_N + 1 },
    })
    expect(failing(result, STRONG)).toEqual(["min-observations"])
    expect(seatFor(result, STRONG).seat.state).toBe("shadow")
  })
})

describe("attributeRun — the analysts that produced nothing", () => {
  it("keeps an always-abstaining analyst with an unmeasurable IC", async () => {
    const result = await attributeRun({
      decisions,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
      windows: OOS_WINDOWS,
    })
    const { scorecard, seat } = seatFor(result, SILENT)

    // Dropped, it would be indistinguishable from a seat that was never
    // configured. `ic: null` is "unmeasurable", which is not 0 — 0 would read as
    // "measured, no edge".
    expect(scorecard.observations).toBe(0)
    expect(scorecard.ic).toBeNull()
    expect(scorecard.abstentionRate).toBe(1)
    expect(seat.state).toBe("shadow")
    expect(failing(result, SILENT)).toEqual([
      "min-observations",
      "information-coefficient",
      "ic-consistency",
      "abstention-rate",
    ])
  })
})

/**
 * Signals on the benchmark security itself. `BENCH_ONLY` covers nothing else, so
 * it has no attributable evidence at all — the case that proves the drop happens
 * on the ledger rather than only on the resolution input.
 */
const BENCH_ONLY = "m-benchonly"
const BENCHMARK_SIGNALS_PER_CUTOFF = 3

const decisionsOnBenchmark: DecisionRecord[] = decisions.map((decision) => ({
  ...decision,
  signals: [
    ...decision.signals,
    // The strongest conviction in the sample, on the one security whose alpha
    // against the benchmark is 0 by construction — so if these survived, they
    // would land a tie block at the top of the conviction ranking.
    signal({
      analystId: STRONG,
      securityId: BENCHMARK,
      asOf: decision.asOf,
      conviction: 0.99,
    }),
    signal({ analystId: SILENT, securityId: BENCHMARK, asOf: decision.asOf, abstained: true }),
    signal({ analystId: BENCH_ONLY, securityId: BENCHMARK, asOf: decision.asOf, conviction: 0.5 }),
  ],
}))

describe("attributeRun — a security is never attributed against itself", () => {
  it("drops benchmark-security signals and reports how many", async () => {
    const clean = await attributeRun({ decisions, outcomes, benchmarkSecurityId: BENCHMARK })
    const polluted = await attributeRun({
      decisions: decisionsOnBenchmark,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
    })

    expect(clean.droppedBenchmarkSignals).toBe(0)
    expect(polluted.droppedBenchmarkSignals).toBe(
      decisions.length * BENCHMARK_SIGNALS_PER_CUTOFF,
    )
    // The whole point: the extra signals change the count that reports them and
    // nothing else. Undropped they would resolve to `forwardAlpha === 0` — not a
    // noisier IC but a systematically biased one, since the ties sit at the top
    // of the conviction ranking.
    expect(JSON.stringify(polluted.analysts)).toBe(JSON.stringify(clean.analysts))
    expect(polluted.resolved).toBe(clean.resolved)
    expect(polluted.unresolved).toBe(clean.unresolved)
    expect(seatFor(polluted, STRONG).scorecard.ic).toBeCloseTo(1, 12)
  })

  it("drops abstentions on the benchmark too, so the abstention rate is unmoved", async () => {
    const polluted = await attributeRun({
      decisions: decisionsOnBenchmark,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
    })

    expect(seatFor(polluted, STRONG).scorecard.abstentionRate).toBe(0)
    expect(seatFor(polluted, SILENT).scorecard.abstentionRate).toBe(1)
  })

  it("leaves the panel entirely when an analyst covered nothing else", async () => {
    const polluted = await attributeRun({
      decisions: decisionsOnBenchmark,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
    })

    // No evidence, not empty evidence: every signal it emitted is unscorable, so
    // reporting a scorecard would be reporting a measurement that was never made.
    expect(polluted.analysts.map((a) => a.scorecard.analystId)).toEqual([SILENT, STRONG])
  })

  it("counts the drop over the whole ledger, before any window scoping", async () => {
    const scoped = await attributeRun({
      decisions: decisionsOnBenchmark,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
      windows: OOS_WINDOWS,
    })

    // Two of the three cutoffs are in-window; the count describes the inputs.
    expect(scoped.droppedBenchmarkSignals).toBe(
      decisions.length * BENCHMARK_SIGNALS_PER_CUTOFF,
    )
    expect(scoped.resolved).toBe(OOS_N)
  })
})

describe("attributeRun — determinism", () => {
  it("sorts analysts by id regardless of ledger order", async () => {
    const result = await attributeRun({ decisions, outcomes, benchmarkSecurityId: BENCHMARK })
    expect(result.analysts.map((a) => a.scorecard.analystId)).toEqual([SILENT, STRONG])
    // The ledger recorded the other order.
    expect(decisions[0]?.signals[0]?.analystId).toBe(STRONG)
  })

  it("returns byte-identical results across runs and shuffled decisions", async () => {
    const forwards = await attributeRun({
      decisions,
      outcomes,
      benchmarkSecurityId: BENCHMARK,
      windows: OOS_WINDOWS,
    })
    const backwards = await attributeRun({
      decisions: [...decisions].reverse(),
      outcomes,
      benchmarkSecurityId: BENCHMARK,
      windows: OOS_WINDOWS,
    })
    expect(JSON.stringify(backwards)).toBe(JSON.stringify(forwards))
  })
})
