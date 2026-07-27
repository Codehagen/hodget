import { describe, expect, it } from "vitest"

import type { DecisionRecord } from "../ledger/ledger.js"
import type { Signal } from "../types.js"
import {
  buildScorecards,
  scopeEvidenceToWindows,
  type AnalystScorecard,
} from "./scorecard.js"
import type { Observation } from "./outcomes.js"

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    analystId: "value",
    securityId: "ACME",
    asOf: "2024-01-05",
    conviction: 0.5,
    horizonDays: 3,
    thesis: null,
    abstained: false,
    ...overrides,
  }
}

function decision(asOf: string, signals: readonly Signal[]): DecisionRecord {
  return { asOf, signals, views: [], targetWeights: [], orders: [], gateActions: [], fills: [] }
}

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    analystId: "value",
    securityId: "ACME",
    asOf: "2024-01-05",
    conviction: 0.5,
    horizonDays: 3,
    forwardReturn: 0.03,
    benchmarkReturn: 0.01,
    forwardAlpha: 0.02,
    resolvedAt: "2024-01-11T23:59:59.999Z",
    ...overrides,
  }
}

/**
 * Decisions that record one non-abstained signal per supplied observation, so a
 * fixture focused on IC arithmetic still describes a coherent run.
 */
function decisionsFor(observations: readonly Observation[]): DecisionRecord[] {
  return observations.map((o) =>
    decision(o.asOf, [
      signal({
        analystId: o.analystId,
        securityId: o.securityId,
        asOf: o.asOf,
        conviction: o.conviction,
      }),
    ]),
  )
}

function card(scorecards: readonly AnalystScorecard[], analystId: string): AnalystScorecard {
  const found = scorecards.find((c) => c.analystId === analystId)
  if (!found) throw new Error(`no scorecard for ${analystId}`)
  return found
}

describe("buildScorecards — abstention rate", () => {
  it("computes abstention rate from the decisions, not the observations", () => {
    // Observations have already dropped abstentions, so an abstention rate read
    // from them is always 0 — the flattering answer, and the wrong one.
    const decisions = [
      decision("2024-01-05", [
        signal({ asOf: "2024-01-05" }),
        signal({ asOf: "2024-01-05", conviction: 0, abstained: true }),
      ]),
      decision("2024-01-06", [
        signal({ asOf: "2024-01-06" }),
        signal({ asOf: "2024-01-06", conviction: 0, abstained: true }),
      ]),
    ]
    const observations = [
      observation({ asOf: "2024-01-05" }),
      observation({ asOf: "2024-01-06" }),
    ]

    const scorecards = buildScorecards(decisions, observations)
    expect(card(scorecards, "value").abstentionRate).toBe(0.5)
  })

  it("reports a zero abstention rate for an analyst that never abstained", () => {
    const scorecards = buildScorecards([decision("2024-01-05", [signal()])], [observation()])
    expect(card(scorecards, "value").abstentionRate).toBe(0)
  })
})

describe("buildScorecards — coverage", () => {
  it("keeps an analyst with no resolved observations, reporting null rather than dropping it", () => {
    const decisions = [
      decision("2024-01-05", [signal({ analystId: "shadow" }), signal({ analystId: "shadow", securityId: "ZETA" })]),
    ]

    const scorecards = buildScorecards(decisions, [])
    const shadow = card(scorecards, "shadow")
    expect(shadow.observations).toBe(0)
    expect(shadow.unresolved).toBe(2)
    expect(shadow.ic).toBeNull()
    expect(shadow.hitRate).toBeNull()
    expect(shadow.meanForwardAlpha).toBeNull()
  })

  it("counts unresolved as actionable signals that produced no observation", () => {
    const decisions = [
      decision("2024-01-05", [
        signal({ securityId: "ACME" }),
        signal({ securityId: "ZETA" }),
        signal({ securityId: "NOPE", conviction: 0, abstained: true }),
      ]),
    ]

    const scorecards = buildScorecards(decisions, [observation({ securityId: "ACME" })])
    const value = card(scorecards, "value")
    expect(value.observations).toBe(1)
    expect(value.unresolved).toBe(1)
  })
})

describe("buildScorecards — IC and hit rate", () => {
  const observations = [
    observation({ securityId: "A", conviction: 0.9, forwardAlpha: 0.05 }),
    observation({ securityId: "B", conviction: 0.5, forwardAlpha: 0.02 }),
    observation({ securityId: "C", conviction: -0.4, forwardAlpha: -0.01 }),
    // A genuine neutral: no directional claim, but a real data point about
    // whether conviction scales with outcome.
    observation({ securityId: "D", conviction: 0, forwardAlpha: 0.1 }),
  ]

  it("excludes neutral views from the hit rate but keeps them in the IC", () => {
    const scorecards = buildScorecards(decisionsFor(observations), observations)
    const value = card(scorecards, "value")

    // All three directional views got the sign right.
    expect(value.hitRate).toBe(1)
    // The neutral view outranks every directional one on realized alpha, which
    // drags the rank correlation well below 1 — proof it was not dropped.
    expect(value.ic).toBeCloseTo(0.4, 12)
  })

  it("reports a null hit rate when every view is neutral", () => {
    const neutral = [
      observation({ securityId: "A", conviction: 0, forwardAlpha: 0.05 }),
      observation({ securityId: "B", conviction: 0, forwardAlpha: -0.02 }),
      observation({ securityId: "C", conviction: 0, forwardAlpha: 0.01 }),
    ]
    const value = card(buildScorecards(decisionsFor(neutral), neutral), "value")
    expect(value.hitRate).toBeNull()
    // Constant conviction ⇒ unmeasurable, not zero.
    expect(value.ic).toBeNull()
  })

  it("averages forward alpha across the resolved observations", () => {
    const scorecards = buildScorecards(decisionsFor(observations), observations)
    expect(card(scorecards, "value").meanForwardAlpha).toBeCloseTo(0.04, 12)
  })
})

describe("buildScorecards — windows", () => {
  const windows = [
    { from: "2024-01-01", to: "2024-01-31" },
    { from: "2024-02-01", to: "2024-02-29" },
  ]

  const observations = [
    // January: conviction and alpha agree perfectly.
    observation({ asOf: "2024-01-05", securityId: "A", conviction: 0.1, forwardAlpha: 0.01 }),
    observation({ asOf: "2024-01-12", securityId: "B", conviction: 0.5, forwardAlpha: 0.03 }),
    observation({ asOf: "2024-01-31T14:00:00Z", securityId: "C", conviction: 0.9, forwardAlpha: 0.09 }),
    // February: perfectly inverted.
    observation({ asOf: "2024-02-02", securityId: "A", conviction: 0.1, forwardAlpha: 0.09 }),
    observation({ asOf: "2024-02-09", securityId: "B", conviction: 0.5, forwardAlpha: 0.03 }),
    observation({ asOf: "2024-02-16", securityId: "C", conviction: 0.9, forwardAlpha: 0.01 }),
  ]

  it("partitions observations into their windows, including an intraday cutoff on the closing date", () => {
    const value = card(buildScorecards(decisionsFor(observations), observations, { windows }), "value")
    expect(value.windowIc).toEqual([1, -1])
  })

  it("reports null for a window with too few observations to measure", () => {
    const value = card(
      buildScorecards(decisionsFor(observations), observations, {
        windows: [...windows, { from: "2024-03-01", to: "2024-03-31" }],
      }),
      "value",
    )
    expect(value.windowIc).toEqual([1, -1, null])
  })

  it("leaves windowIc empty when no windows are supplied", () => {
    expect(card(buildScorecards(decisionsFor(observations), observations), "value").windowIc).toEqual([])
  })
})

describe("buildScorecards — determinism", () => {
  it("sorts output by analystId regardless of input order", () => {
    const decisions = [
      decision("2024-01-05", [
        signal({ analystId: "quant" }),
        signal({ analystId: "value" }),
        signal({ analystId: "macro" }),
        signal({ analystId: "arb" }),
      ]),
    ]
    const scorecards = buildScorecards(decisions, [observation({ analystId: "arb" })])
    expect(scorecards.map((c) => c.analystId)).toEqual(["arb", "macro", "quant", "value"])
  })
})

describe("scopeEvidenceToWindows", () => {
  const windows = [{ from: "2024-02-01", to: "2024-02-29" }]

  const decisions = [
    decision("2024-01-15", [signal({ asOf: "2024-01-15" }), signal({ asOf: "2024-01-15", abstained: true, conviction: 0 })]),
    decision("2024-02-15", [signal({ asOf: "2024-02-15" })]),
    decision("2024-03-15", [signal({ asOf: "2024-03-15" })]),
  ]
  const observations = [
    observation({ asOf: "2024-01-15" }),
    observation({ asOf: "2024-02-15" }),
    observation({ asOf: "2024-03-15" }),
  ]

  it("keeps only the decisions and observations inside the windows", () => {
    const scoped = scopeEvidenceToWindows(decisions, observations, windows)
    expect(scoped.decisions.map((d) => d.asOf)).toEqual(["2024-02-15"])
    expect(scoped.observations.map((o) => o.asOf)).toEqual(["2024-02-15"])
    expect(scoped.windows).toEqual(windows)
  })

  it("filters signals on their own asOf, so the abstention rate covers only the windows", () => {
    // The January record carries one abstention. Left in, it would halve the
    // measured abstention rate of a seat that never abstained out-of-sample.
    const scoped = scopeEvidenceToWindows(decisions, observations, windows)
    expect(scoped.decisions.flatMap((d) => d.signals).map((s) => s.asOf)).toEqual(["2024-02-15"])
    expect(card(buildScorecards(scoped.decisions, scoped.observations), "value").abstentionRate).toBe(0)
  })

  it("drops a record left with no signals rather than emitting an empty one", () => {
    const scoped = scopeEvidenceToWindows(
      [decision("2024-02-15", [signal({ asOf: "2024-01-15" }), signal({ asOf: "2024-02-15" })])],
      [],
      windows,
    )
    expect(scoped.decisions).toHaveLength(1)
    expect(scoped.decisions[0]?.signals).toHaveLength(1)

    const empty = scopeEvidenceToWindows(
      [decision("2024-02-15", [signal({ asOf: "2024-01-15" })])],
      [],
      windows,
    )
    expect(empty.decisions).toEqual([])
  })

  it("unions multiple windows and honours an intraday cutoff on a bound", () => {
    const scoped = scopeEvidenceToWindows(decisions, observations, [
      { from: "2024-01-01", to: "2024-01-31" },
      { from: "2024-03-01", to: "2024-03-31" },
    ])
    expect(scoped.observations.map((o) => o.asOf)).toEqual(["2024-01-15", "2024-03-15"])

    const intraday = scopeEvidenceToWindows(
      [decision("2024-02-29", [signal({ asOf: "2024-02-29T21:00:00.000Z" })])],
      [observation({ asOf: "2024-02-29T21:00:00.000Z" })],
      windows,
    )
    expect(intraday.observations).toHaveLength(1)
  })

  it("refuses an empty window set instead of quietly returning the whole sample", () => {
    // Returning everything here would make the helper the contamination path it
    // exists to close: whole-sample evidence, labelled out-of-sample.
    expect(() => scopeEvidenceToWindows(decisions, observations, [])).toThrow(
      /no windows supplied/,
    )
  })

  it("leaves an untouched record identical, so scoping a fully in-window run is a no-op", () => {
    const inWindow = [decision("2024-02-15", [signal({ asOf: "2024-02-15" })])]
    const scoped = scopeEvidenceToWindows(inWindow, [], windows)
    expect(scoped.decisions[0]).toBe(inWindow[0])
  })
})

describe("buildScorecards — mismatched inputs", () => {
  it("refuses to score an analyst the decisions never recorded", () => {
    // Without this guard the analyst gets abstentionRate 0 and unresolved 0 —
    // two invented passing checks the seat gate would happily promote on.
    expect(() =>
      buildScorecards([decision("2024-01-05", [signal()])], [observation({ analystId: "ghost" })]),
    ).toThrow(/no decision recorded one/)
  })
})
