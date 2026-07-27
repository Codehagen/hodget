import { beforeAll, describe, expect, it } from "vitest"

import { FIXTURE_IDS, loadFixtureDataset, type FixtureDataset } from "../data/fixture/dataset.js"
import { FixtureOutcomeData, loadFixtureOutcomeData } from "./fixture-outcomes.js"
import { resolveObservations } from "./outcomes.js"
import type { Signal } from "../types.js"

/**
 * Every date here is a literal drawn from the committed fixture, never derived
 * from the clock (AGENTS.md: fixtures are deterministic). The first assertion in
 * each block re-derives the anchor from the dataset, so if the generator is ever
 * reseeded these tests fail loudly on the anchor rather than silently asserting
 * nothing.
 */

/** The first XNAS session in the fixture, and the one the split adjusts. */
const FIRST_XNAS_SESSION = "2020-01-02"
const SECOND_XNAS_SESSION = "2020-01-03"
/** The last two XNAS sessions in the fixture. */
const PENULTIMATE_XNAS_SESSION = "2020-12-30"
const LAST_XNAS_SESSION = "2020-12-31"

let dataset: FixtureDataset
let outcomes: FixtureOutcomeData

beforeAll(async () => {
  dataset = await loadFixtureDataset()
  outcomes = new FixtureOutcomeData(dataset)
})

describe("FixtureOutcomeData — strictly after (plan 024, design decision 4)", () => {
  it("excludes a bar dated exactly on `after`", async () => {
    // The anchor really is a trading session, so the exclusion below is a
    // statement about the comparison and not about a missing date.
    const rows = dataset.prices[FIXTURE_IDS.usEquity] ?? []
    expect(rows.some((row) => row.date === FIRST_XNAS_SESSION)).toBe(true)

    const bars = await outcomes.sessionsAfter(FIXTURE_IDS.usEquity, FIRST_XNAS_SESSION, 3)

    expect(bars.map((bar) => bar.date)).not.toContain(FIRST_XNAS_SESSION)
    expect(bars[0]?.date).toBe(SECOND_XNAS_SESSION)
    for (const bar of bars) expect(bar.date > FIRST_XNAS_SESSION).toBe(true)
  })

  it("excludes it when `after` arrives as a full instant on that session", async () => {
    // A decision cutoff is an ISO timestamp; the comparison is date-only, so a
    // provider serving bare dates and a caller passing an instant must agree.
    const bars = await outcomes.sessionsAfter(
      FIXTURE_IDS.usEquity,
      `${FIRST_XNAS_SESSION}T21:00:00Z`,
      1,
    )
    expect(bars.map((bar) => bar.date)).toEqual([SECOND_XNAS_SESSION])
  })

  it("skips a non-session `after` date without skipping the next session", async () => {
    // 2020-01-04/05 is a weekend: nothing is dated on it, and the next session
    // must still be returned rather than swallowed by an off-by-one.
    const bars = await outcomes.sessionsAfter(FIXTURE_IDS.usEquity, "2020-01-04", 1)
    expect(bars.map((bar) => bar.date)).toEqual(["2020-01-06"])
  })
})

describe("FixtureOutcomeData — ordering, limit, and the end of the data", () => {
  it("returns ascending sessions", async () => {
    const bars = await outcomes.sessionsAfter(FIXTURE_IDS.usEquity, FIRST_XNAS_SESSION, 40)
    expect(bars.length).toBe(40)
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i]!.date > bars[i - 1]!.date).toBe(true)
    }
  })

  it("respects `limit`", async () => {
    const bars = await outcomes.sessionsAfter(FIXTURE_IDS.osloEquity, "2020-06-01", 5)
    expect(bars).toHaveLength(5)
    expect(await outcomes.sessionsAfter(FIXTURE_IDS.osloEquity, "2020-06-01", 0)).toEqual([])
  })

  it("returns fewer than `limit` near the end of the dataset rather than throwing", async () => {
    const rows = dataset.prices[FIXTURE_IDS.usEquity] ?? []
    expect(rows[rows.length - 1]?.date).toBe(LAST_XNAS_SESSION)

    const bars = await outcomes.sessionsAfter(FIXTURE_IDS.usEquity, PENULTIMATE_XNAS_SESSION, 10)
    expect(bars.map((bar) => bar.date)).toEqual([LAST_XNAS_SESSION])
  })

  it("returns empty past the end of the dataset", async () => {
    expect(await outcomes.sessionsAfter(FIXTURE_IDS.usEquity, LAST_XNAS_SESSION, 10)).toEqual([])
  })

  it("carries adjusted closes, not raw ones", async () => {
    // The US equity's split makes these differ on the early sessions; measuring
    // attribution on `close` would turn that split into fake alpha.
    const row = (dataset.prices[FIXTURE_IDS.usEquity] ?? []).find(
      (r) => r.date === SECOND_XNAS_SESSION,
    )
    expect(row).toBeDefined()
    expect(row!.adjClose).not.toBe(row!.close)

    const bars = await outcomes.sessionsAfter(FIXTURE_IDS.usEquity, FIRST_XNAS_SESSION, 1)
    expect(bars[0]?.adjClose).toBe(row!.adjClose)
  })
})

describe("FixtureOutcomeData — securities it does not price", () => {
  it("returns empty for an unregistered security instead of throwing", async () => {
    await expect(
      outcomes.sessionsAfter(FIXTURE_IDS.unknown, FIRST_XNAS_SESSION, 5),
    ).resolves.toEqual([])
  })

  it("returns empty for the poisoned security rather than simulating a transport failure", async () => {
    // Deliberate: the poisoned id is a `MarketData` affordance for testing the
    // fail-loud path. This port's contract is "no series, no sessions", and the
    // caller counts the short result as unresolved.
    await expect(
      outcomes.sessionsAfter(FIXTURE_IDS.poison, FIRST_XNAS_SESSION, 5),
    ).resolves.toEqual([])
  })
})

describe("FixtureOutcomeData — through resolveObservations", () => {
  const signal: Signal = {
    analystId: "fixture",
    securityId: FIXTURE_IDS.usEquity,
    asOf: `${FIRST_XNAS_SESSION}T21:00:00Z`,
    conviction: 0.5,
    horizonDays: 3,
    thesis: null,
    abstained: false,
  }

  it("resolves an observation whose entry is the session after the cutoff", async () => {
    const summary = await resolveObservations([signal], outcomes, {
      benchmark: FIXTURE_IDS.osloEquity,
      timeZone: "UTC",
    })

    // The benchmark trades a different calendar than the security, which is
    // exactly the case `benchmarkSpanning` widens for; both legs exist here.
    expect(summary.unresolved).toBe(0)
    const observation = summary.observations[0]
    expect(observation).toBeDefined()

    // Entry = 2020-01-03 (strictly after the cutoff), exit = three sessions on.
    const rows = dataset.prices[FIXTURE_IDS.usEquity] ?? []
    const entry = rows.find((r) => r.date === SECOND_XNAS_SESSION)!
    const exit = rows.find((r) => r.date === "2020-01-08")!
    expect(observation!.forwardReturn).toBeCloseTo(exit.adjClose / entry.adjClose - 1, 12)
    // Never measured from the cutoff's own close — that is the fill the fund
    // could not have gotten.
    const cutoffClose = rows.find((r) => r.date === FIRST_XNAS_SESSION)!.adjClose
    expect(observation!.forwardReturn).not.toBeCloseTo(exit.adjClose / cutoffClose - 1, 12)
    expect(observation!.resolvedAt >= observation!.asOf).toBe(true)
  })

  it("leaves a signal whose horizon runs past the data unresolved, never zero-filled", async () => {
    const summary = await resolveObservations(
      [{ ...signal, asOf: `${PENULTIMATE_XNAS_SESSION}T21:00:00Z` }],
      outcomes,
      { benchmark: FIXTURE_IDS.osloEquity, timeZone: "UTC" },
    )
    expect(summary.observations).toEqual([])
    expect(summary.unresolved).toBe(1)
  })
})

describe("loadFixtureOutcomeData", () => {
  it("builds a provider over the default committed dataset", async () => {
    const loaded = await loadFixtureOutcomeData()
    expect(await loaded.sessionsAfter(FIXTURE_IDS.usEquity, FIRST_XNAS_SESSION, 1)).toEqual(
      await outcomes.sessionsAfter(FIXTURE_IDS.usEquity, FIRST_XNAS_SESSION, 1),
    )
  })
})
