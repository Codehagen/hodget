import { describe, expect, it } from "vitest"

import type { Signal } from "../types.js"
import { resolveObservations, type OutcomeBar, type OutcomeData } from "./outcomes.js"

/**
 * A Map-backed {@link OutcomeData}. Every date is a literal — per AGENTS.md
 * fixtures are deterministic, and this module is the one place where a test
 * that resolved "today" would pass or fail depending on when it ran.
 */
function fakeOutcomes(series: Record<string, readonly OutcomeBar[]>): OutcomeData {
  return {
    async sessionsAfter(securityId, after, limit) {
      const bars = series[securityId] ?? []
      return bars.filter((bar) => bar.date > after).slice(0, limit)
    },
  }
}

const ACME: readonly OutcomeBar[] = [
  { date: "2024-01-08", adjClose: 100 },
  { date: "2024-01-09", adjClose: 101 },
  { date: "2024-01-10", adjClose: 102 },
  { date: "2024-01-11", adjClose: 110 },
]

const BENCH: readonly OutcomeBar[] = [
  { date: "2024-01-08", adjClose: 200 },
  { date: "2024-01-09", adjClose: 200 },
  { date: "2024-01-10", adjClose: 200 },
  { date: "2024-01-11", adjClose: 204 },
]

const outcomes = fakeOutcomes({ ACME, BENCH })

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

describe("resolveObservations", () => {
  it("measures forward alpha from the first session after asOf to the horizon session", async () => {
    const summary = await resolveObservations([signal()], outcomes, { benchmark: "BENCH" })

    expect(summary.unresolved).toBe(0)
    expect(summary.abstained).toBe(0)
    expect(summary.observations).toHaveLength(1)

    const observation = summary.observations[0]
    if (!observation) throw new Error("expected one observation")
    // Entry 2024-01-08 @100 → exit 2024-01-11 @110.
    expect(observation.forwardReturn).toBeCloseTo(0.1, 12)
    // Benchmark over the identical two dates: 200 → 204.
    expect(observation.benchmarkReturn).toBeCloseTo(0.02, 12)
    expect(observation.forwardAlpha).toBeCloseTo(0.08, 12)
    expect(observation.conviction).toBe(0.5)
    expect(observation.horizonDays).toBe(3)
  })

  it("stamps resolvedAt at end of the EXIT session, not the entry session", async () => {
    const summary = await resolveObservations([signal()], outcomes, { benchmark: "BENCH" })
    const observation = summary.observations[0]
    if (!observation) throw new Error("expected one observation")

    expect(observation.resolvedAt).toBe("2024-01-11T23:59:59.999Z")
    // Entry was 2024-01-08; stamping from there would understate when the
    // outcome became knowable, which is the look-ahead-adjacent mistake.
    expect(observation.resolvedAt).not.toBe("2024-01-08T23:59:59.999Z")
  })

  it("keeps resolvedAt after asOf even when asOf is a full instant", async () => {
    const summary = await resolveObservations(
      [signal({ asOf: "2024-01-05T21:00:00.000Z" })],
      outcomes,
      { benchmark: "BENCH" },
    )
    const observation = summary.observations[0]
    if (!observation) throw new Error("expected one observation")
    expect(Date.parse(observation.resolvedAt)).toBeGreaterThan(Date.parse(observation.asOf))
  })

  it("honours the exchange timezone when stamping resolvedAt", async () => {
    const summary = await resolveObservations([signal()], outcomes, {
      benchmark: "BENCH",
      timeZone: "Europe/Oslo",
    })
    const observation = summary.observations[0]
    if (!observation) throw new Error("expected one observation")
    // Oslo is UTC+1 in January, so end of the local session is 22:59:59.999Z.
    expect(observation.resolvedAt).toBe("2024-01-11T22:59:59.999Z")
  })

  it("selects a timezone per security so a multi-exchange panel stamps each correctly", async () => {
    const multi = fakeOutcomes({ ACME, OSLO: ACME, BENCH })
    const summary = await resolveObservations(
      [signal({ securityId: "ACME" }), signal({ securityId: "OSLO" })],
      multi,
      {
        benchmark: "BENCH",
        timeZone: (securityId) => (securityId === "OSLO" ? "Europe/Oslo" : "UTC"),
      },
    )

    expect(summary.observations.map((o) => o.resolvedAt)).toEqual([
      "2024-01-11T23:59:59.999Z",
      "2024-01-11T22:59:59.999Z",
    ])
  })

  it("excludes abstentions and counts them separately", async () => {
    const summary = await resolveObservations(
      [signal(), signal({ analystId: "broken", conviction: 0, abstained: true })],
      outcomes,
      { benchmark: "BENCH" },
    )

    expect(summary.abstained).toBe(1)
    expect(summary.unresolved).toBe(0)
    expect(summary.observations.map((o) => o.analystId)).toEqual(["value"])
  })

  it("counts a truncated window as unresolved instead of zero-filling it", async () => {
    const summary = await resolveObservations([signal({ horizonDays: 5 })], outcomes, {
      benchmark: "BENCH",
    })

    expect(summary.observations).toEqual([])
    expect(summary.unresolved).toBe(1)
  })

  it("counts a missing benchmark leg as unresolved rather than falling back to raw return", async () => {
    const gappyBench = fakeOutcomes({
      ACME,
      BENCH: BENCH.filter((bar) => bar.date !== "2024-01-11"),
    })

    const summary = await resolveObservations([signal()], gappyBench, { benchmark: "BENCH" })
    expect(summary.observations).toEqual([])
    expect(summary.unresolved).toBe(1)
  })

  it("selects a benchmark per security when given a function", async () => {
    // The two benchmarks must disagree, or an implementation that ignored the
    // selector and always used a fixed key would pass this test.
    const OSLO_BENCH: readonly OutcomeBar[] = BENCH.map((bar) => ({
      date: bar.date,
      adjClose: bar.date === "2024-01-11" ? 220 : 200,
    }))
    const multi = fakeOutcomes({ ACME, BENCH, OSLO_BENCH })

    const summary = await resolveObservations([signal()], multi, {
      benchmark: (securityId) => (securityId === "ACME" ? "OSLO_BENCH" : "BENCH"),
    })

    const observation = summary.observations[0]
    if (!observation) throw new Error("expected one observation")
    // OSLO_BENCH runs 200 → 220 (+10%), where BENCH runs 200 → 204 (+2%).
    expect(observation.benchmarkReturn).toBeCloseTo(0.1, 12)
    expect(observation.forwardAlpha).toBeCloseTo(0, 12)
  })

  it("resolves a signal whose security missed a session the benchmark traded through", async () => {
    // ACME is halted on 2024-01-09, so its 3rd session is 2024-01-12 — further
    // out on the benchmark's calendar than three benchmark sessions reach.
    // Asking for only the security's session count would read as a data gap and
    // silently bias the sample toward securities whose calendar matches.
    const halted = fakeOutcomes({
      ACME: [
        { date: "2024-01-08", adjClose: 100 },
        { date: "2024-01-10", adjClose: 102 },
        { date: "2024-01-11", adjClose: 105 },
        { date: "2024-01-12", adjClose: 110 },
      ],
      BENCH: [...BENCH, { date: "2024-01-12", adjClose: 208 }],
    })

    const summary = await resolveObservations([signal()], halted, { benchmark: "BENCH" })
    expect(summary.unresolved).toBe(0)
    const observation = summary.observations[0]
    if (!observation) throw new Error("expected one observation")
    expect(observation.forwardReturn).toBeCloseTo(0.1, 12)
    expect(observation.benchmarkReturn).toBeCloseTo(0.04, 12)
    expect(observation.resolvedAt).toBe("2024-01-12T23:59:59.999Z")
  })

  it("orders output by (asOf, securityId, analystId) regardless of input order", async () => {
    const wide = fakeOutcomes({ ACME, ZETA: ACME, BENCH })
    const shuffled = [
      signal({ analystId: "quant", securityId: "ZETA" }),
      signal({ analystId: "value", securityId: "ZETA" }),
      signal({ analystId: "value", securityId: "ACME", asOf: "2024-01-04" }),
      signal({ analystId: "quant", securityId: "ACME" }),
      signal({ analystId: "value", securityId: "ACME" }),
    ]

    const summary = await resolveObservations(shuffled, wide, { benchmark: "BENCH" })
    expect(summary.observations.map((o) => `${o.asOf} ${o.securityId} ${o.analystId}`)).toEqual([
      "2024-01-04 ACME value",
      "2024-01-05 ACME quant",
      "2024-01-05 ACME value",
      "2024-01-05 ZETA quant",
      "2024-01-05 ZETA value",
    ])
  })

  it("normalizes a timestamp-valued bar date to end of the exit SESSION, not its midnight", async () => {
    // `OutcomeBar.date` is an unvalidated provider string. A provider that
    // serves `2024-01-11T00:00:00.000Z` and gets it stamped verbatim would claim
    // the outcome was knowable a full session before it was — a day early, on
    // the one field the downstream PIT re-filtering rests on.
    const stamp = (bars: readonly OutcomeBar[]): OutcomeBar[] =>
      bars.map((bar) => ({ date: `${bar.date}T00:00:00.000Z`, adjClose: bar.adjClose }))
    const timestamped = fakeOutcomes({ ACME: stamp(ACME), BENCH: stamp(BENCH) })

    const summary = await resolveObservations([signal()], timestamped, { benchmark: "BENCH" })
    const observation = summary.observations[0]
    if (!observation) throw new Error("expected one observation")

    expect(observation.resolvedAt).toBe("2024-01-11T23:59:59.999Z")
    expect(observation.resolvedAt).not.toBe("2024-01-11T00:00:00.000Z")
    // The benchmark legs still line up across the two formats.
    expect(observation.forwardAlpha).toBeCloseTo(0.08, 12)
  })

  it("treats a non-positive entry price as unresolvable rather than emitting Infinity", async () => {
    const broken = fakeOutcomes({
      ACME: [{ date: "2024-01-08", adjClose: 0 }, ...ACME.slice(1)],
      BENCH,
    })

    const summary = await resolveObservations([signal()], broken, { benchmark: "BENCH" })
    expect(summary.observations).toEqual([])
    expect(summary.unresolved).toBe(1)
  })
})

/**
 * Design decision 4 says entry is the **first session strictly after `asOf`**.
 * Every other fixture in this file honours that, so none of them exercises what
 * the module does when a port does not — and no `OutcomeData` implementation
 * exists yet to be trusted or distrusted.
 *
 * These fixtures are deliberately non-conforming. A `sessionsAfter` written with
 * `>=` instead of `>` is a one-character mistake that no type catches, and its
 * payoff is a same-day fill the sim broker could never have produced, handed
 * free to every analyst on the panel. The alpha it yields is arithmetically
 * perfect and entirely fictional, which is why the module must check the
 * boundary itself rather than document it.
 */
describe("resolveObservations — a port that violates the entry-session contract", () => {
  /** `sessionsAfter` implemented with `>=`: the plausible off-by-one. */
  function inclusiveOutcomes(series: Record<string, readonly OutcomeBar[]>): OutcomeData {
    return {
      async sessionsAfter(securityId, after, limit) {
        const bars = series[securityId] ?? []
        return bars.filter((bar) => bar.date >= after.slice(0, 10)).slice(0, limit)
      },
    }
  }

  const inclusive = inclusiveOutcomes({ ACME, BENCH })

  it("counts a signal as unresolved when the entry bar lands ON asOf", async () => {
    // asOf is itself a session, so the `>=` port offers 2024-01-08 as "the next
    // session". Measuring 100 → 110 from there would be a free same-day fill.
    const summary = await resolveObservations(
      [signal({ asOf: "2024-01-08", horizonDays: 3 })],
      inclusive,
      { benchmark: "BENCH" },
    )

    expect(summary.observations).toEqual([])
    expect(summary.unresolved).toBe(1)
  })

  it("still resolves normally when the same port happens to return a conforming bar", async () => {
    // asOf is not a session, so `>=` and `>` agree — the guard must bite at the
    // boundary only, not reject every observation from an imperfect provider.
    const summary = await resolveObservations([signal({ asOf: "2024-01-05" })], inclusive, {
      benchmark: "BENCH",
    })

    expect(summary.unresolved).toBe(0)
    expect(summary.observations).toHaveLength(1)
  })

  it("counts a signal as unresolved when the port ignores `after` entirely", async () => {
    const ignoresAfter: OutcomeData = {
      async sessionsAfter(securityId, _after, limit) {
        return ({ ACME, BENCH } as Record<string, readonly OutcomeBar[]>)[securityId]?.slice(0, limit) ?? []
      },
    }

    const summary = await resolveObservations(
      [signal({ asOf: "2024-01-09", horizonDays: 3 })],
      ignoresAfter,
      { benchmark: "BENCH" },
    )

    expect(summary.observations).toEqual([])
    expect(summary.unresolved).toBe(1)
  })

  it("counts a signal as unresolved when the exit session predates asOf", async () => {
    // Descending bars: entry clears the asOf check but the exit does not, so the
    // resolvedAt guard is the only thing standing between this and a record
    // claiming an outcome was knowable before the decision that produced it.
    const descending: OutcomeData = {
      async sessionsAfter(_securityId, _after, limit) {
        return [
          { date: "2024-01-08", adjClose: 100 },
          { date: "2024-01-04", adjClose: 101 },
          { date: "2024-01-03", adjClose: 102 },
          { date: "2024-01-02", adjClose: 110 },
        ].slice(0, limit)
      },
    }

    const summary = await resolveObservations([signal()], descending, { benchmark: "BENCH" })
    expect(summary.observations).toEqual([])
    expect(summary.unresolved).toBe(1)
  })

  it("never emits an observation whose resolvedAt precedes its asOf", async () => {
    // The property, asserted over every fixture in this suite at once.
    const ports: OutcomeData[] = [outcomes, inclusive]
    for (const port of ports) {
      for (const asOf of ["2024-01-05", "2024-01-08", "2024-01-09T21:00:00.000Z"]) {
        const summary = await resolveObservations([signal({ asOf })], port, { benchmark: "BENCH" })
        for (const observation of summary.observations) {
          expect(Date.parse(observation.resolvedAt)).toBeGreaterThanOrEqual(
            Date.parse(observation.asOf),
          )
        }
      }
    }
  })
})
