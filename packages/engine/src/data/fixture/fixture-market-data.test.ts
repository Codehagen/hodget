import { beforeAll, describe, expect, it } from "vitest"

import { DataQualityError, DataUnavailableError } from "../errors.js"
import {
  PitMarketData,
  type MarketData,
  type RawMarketDataSource,
  type RawResult,
} from "../market-data.js"
import { createSecurityResolver } from "../symbols.js"
import { FIXTURE_IDS, loadFixtureDataset, type FixtureDataset } from "./dataset.js"
import { createFixtureMarketData } from "./fixture-market-data.js"

let dataset: FixtureDataset
let md: MarketData

beforeAll(async () => {
  dataset = await loadFixtureDataset()
  md = createFixtureMarketData(dataset)
})

function nextTradingDay(mic: "XNAS" | "XOSL", day: string): string {
  const cal = dataset.calendars[mic]
  if (!cal) throw new Error(`no calendar for ${mic}`)
  const idx = cal.indexOf(day)
  const next = cal[idx + 1]
  if (idx < 0 || !next) throw new Error(`no trading day after ${day} on ${mic}`)
  return next
}

const LATE = "2021-01-01T00:00:00Z"

describe("coverage envelopes", () => {
  it("covered-empty: a genuine absence returns covered with zero rows", async () => {
    const result = await md.insiderTrades(FIXTURE_IDS.osloMicroCap, LATE)
    expect(result.coverage).toBe("covered")
    expect(result.rows.length).toBe(0)
  })

  it("not-covered: an unknown symbol is never covered-empty", async () => {
    const result = await md.insiderTrades(FIXTURE_IDS.unknown, LATE)
    expect(result.coverage).toBe("not-covered")
    expect(result.rows.length).toBe(0)
  })
})

describe("empty vs throw", () => {
  it("throws DataUnavailableError for a poisoned (transport failure) symbol", async () => {
    await expect(md.prices(FIXTURE_IDS.poison, { from: "2020-01-01", to: "2020-12-31" }, LATE))
      .rejects.toBeInstanceOf(DataUnavailableError)
    await expect(md.fundamentals(FIXTURE_IDS.poison, LATE)).rejects.toBeInstanceOf(
      DataUnavailableError,
    )
    await expect(md.earnings(FIXTURE_IDS.poison, LATE)).rejects.toBeInstanceOf(
      DataUnavailableError,
    )
  })
})

describe("point-in-time: date-only filing", () => {
  it("is invisible the same trading day and visible the next trading day", async () => {
    // The Oslo Q4-2019 filing has a date-only knownAt (coerced to exchange EOD).
    const all = await md.fundamentals(FIXTURE_IDS.osloEquity, LATE)
    const dateOnly = all.rows.find((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.knownAt))
    expect(dateOnly).toBeDefined()
    const filingDay = dateOnly!.knownAt
    const nextDay = nextTradingDay("XOSL", filingDay)

    // A decision at that day's Oslo close (before local end-of-day) cannot see it.
    const sameDay = await md.fundamentals(FIXTURE_IDS.osloEquity, `${filingDay}T20:00:00Z`)
    expect(sameDay.rows.some((r) => r.knownAt === filingDay)).toBe(false)

    // The next trading day reveals it.
    const revealed = await md.fundamentals(FIXTURE_IDS.osloEquity, `${nextDay}T20:00:00Z`)
    expect(revealed.rows.some((r) => r.knownAt === filingDay)).toBe(true)
  })
})

describe("point-in-time: late after-close filing", () => {
  it("does not trade at that day's close but is visible the next day", async () => {
    // The Q1-2020 filing is a full instant after the US close (21:30Z).
    const all = await md.fundamentals(FIXTURE_IDS.usEquity, LATE)
    const late = all.rows.find((r) => r.fiscalPeriod === "2020-Q1")
    expect(late).toBeDefined()
    const filingDay = late!.knownAt.slice(0, 10)
    const nextDay = nextTradingDay("XNAS", filingDay)

    const atClose = await md.fundamentals(FIXTURE_IDS.usEquity, `${filingDay}T20:00:00Z`)
    expect(atClose.rows.some((r) => r.fiscalPeriod === "2020-Q1")).toBe(false)
    // The earlier Q4-2019 filing is still visible — PIT hid only the fresh one.
    expect(atClose.rows.some((r) => r.fiscalPeriod === "2019-Q4")).toBe(true)

    const nextClose = await md.fundamentals(FIXTURE_IDS.usEquity, `${nextDay}T20:00:00Z`)
    expect(nextClose.rows.some((r) => r.fiscalPeriod === "2020-Q1")).toBe(true)
  })
})

describe("point-in-time: no returned fact is ever from the future", () => {
  it("holds for random asOf cutoffs across the range", async () => {
    const cal = dataset.calendars.XNAS ?? []
    for (let i = 0; i < cal.length; i += 7) {
      const day = cal[i]
      if (!day) continue
      const asOf = `${day}T20:00:00Z`
      const asOfMs = Date.parse(asOf)
      const result = await md.earnings(FIXTURE_IDS.usEquity, asOf)
      for (const row of result.rows) {
        // Earnings knownAt are full instants; none may post-date the cutoff.
        expect(Date.parse(row.knownAt)).toBeLessThanOrEqual(asOfMs)
      }
    }
  })
})

describe("data-quality errors (fail loud, never silent-drop)", () => {
  const resolver = createSecurityResolver([
    { securityId: "US-XNAS-SYNA", symbol: "SYNA", mic: "XNAS" },
  ])

  function sourceReturning(rows: readonly unknown[]): RawMarketDataSource {
    const covered: RawResult = { coverage: "covered", rows }
    return {
      prices: () => covered,
      fundamentals: () => covered,
      earnings: () => covered,
      news: () => covered,
      insiderTrades: () => covered,
      corporateActions: () => covered,
      fxRate: () => covered,
    }
  }

  it("throws DataQualityError on a malformed row", async () => {
    const bad = new PitMarketData(
      sourceReturning([
        { securityId: "US-XNAS-SYNA", date: "2020-01-02", knownAt: "2020-01-02T21:00:00Z", close: "not-a-number", adjClose: 1, adjustmentFactor: 1, currency: "USD" },
      ]),
      resolver,
    )
    await expect(
      bad.prices("US-XNAS-SYNA", { from: "2020-01-01", to: "2020-12-31" }, LATE),
    ).rejects.toBeInstanceOf(DataQualityError)
  })

  it("throws DataQualityError on a row missing knownAt", async () => {
    const bad = new PitMarketData(
      sourceReturning([
        { securityId: "US-XNAS-SYNA", date: "2020-01-02", close: 100, adjClose: 100, adjustmentFactor: 1, currency: "USD" },
      ]),
      resolver,
    )
    await expect(
      bad.prices("US-XNAS-SYNA", { from: "2020-01-01", to: "2020-12-31" }, LATE),
    ).rejects.toBeInstanceOf(DataQualityError)
  })

  it("throws DataQualityError on an unusable (garbage) knownAt", async () => {
    const bad = new PitMarketData(
      sourceReturning([
        { securityId: "US-XNAS-SYNA", date: "2020-01-02", knownAt: "not-a-date", close: 100, adjClose: 100, adjustmentFactor: 1, currency: "USD" },
      ]),
      resolver,
    )
    await expect(
      bad.prices("US-XNAS-SYNA", { from: "2020-01-01", to: "2020-12-31" }, LATE),
    ).rejects.toBeInstanceOf(DataQualityError)
  })
})
