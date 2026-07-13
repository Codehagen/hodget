import { describe, expect, it } from "vitest"

import { DataUnavailableError } from "../../data/errors.js"
import {
  covered,
  notCovered,
  type MarketData,
  type MarketDataResult,
} from "../../data/market-data.js"
import type {
  CorporateActionEvent,
  Currency,
  EarningsEvent,
  FundamentalsSnapshot,
  FxRate,
  InsiderTrade,
  NewsItem,
  Price,
} from "../../data/types.js"
import { createFixtureMarketData } from "../../data/fixture/fixture-market-data.js"
import { FIXTURE_IDS, loadFixtureDataset } from "../../data/fixture/dataset.js"
import type { AnalystContext } from "../../types.js"
import {
  createEarningsDriftAnalyst,
  fiscalOrdinal,
  reconcileEarnings,
} from "./earnings-drift.js"

const SECURITY = "US-XNAS-TEST"

function earnings(
  fiscalPeriod: string,
  knownAt: string,
  epsActual: number,
  epsEstimate: number | null,
  surpriseQuality: EarningsEvent["surpriseQuality"] = "consensus",
): EarningsEvent {
  return { securityId: SECURITY, fiscalPeriod, knownAt, currency: "USD", epsActual, epsEstimate, surpriseQuality }
}

/** Weekday dates in [from, to] as a stand-in trading calendar. */
function businessDays(from: string, to: string): string[] {
  const out: string[] = []
  let t = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  while (t <= end) {
    const d = new Date(t)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10))
    t += 86_400_000
  }
  return out
}

function priceBars(dates: readonly string[]): Price[] {
  return dates.map((date) => ({
    securityId: SECURITY,
    date,
    knownAt: `${date}T21:00:00Z`,
    close: 100,
    adjClose: 100,
    adjustmentFactor: 1,
    currency: "USD" as Currency,
  }))
}

interface StubOptions {
  readonly earnings: EarningsEvent[] | "not-covered" | "throw"
  readonly prices?: Price[] | "not-covered"
}

/** A focused MarketData whose rows are treated as already PIT-scoped. */
class StubMarketData implements MarketData {
  constructor(private readonly opts: StubOptions) {}

  async earnings(): Promise<MarketDataResult<EarningsEvent>> {
    if (this.opts.earnings === "throw") throw new DataUnavailableError("simulated outage")
    if (this.opts.earnings === "not-covered") return notCovered()
    return covered(this.opts.earnings)
  }

  async prices(): Promise<MarketDataResult<Price>> {
    const p = this.opts.prices
    if (p === undefined || p === "not-covered") return notCovered()
    return covered(p)
  }

  async fundamentals(): Promise<MarketDataResult<FundamentalsSnapshot>> {
    return notCovered()
  }
  async news(): Promise<MarketDataResult<NewsItem>> {
    return notCovered()
  }
  async insiderTrades(): Promise<MarketDataResult<InsiderTrade>> {
    return notCovered()
  }
  async corporateActions(): Promise<MarketDataResult<CorporateActionEvent>> {
    return notCovered()
  }
  async fxRate(): Promise<MarketDataResult<FxRate>> {
    return notCovered()
  }
}

function ctx(asOf: string, data: MarketData): AnalystContext {
  return { securityId: SECURITY, asOf, data }
}

const analyst = createEarningsDriftAnalyst()

describe("fiscalOrdinal", () => {
  it("orders quarters within and across years", () => {
    expect(fiscalOrdinal("2020-Q1")).toBeLessThan(fiscalOrdinal("2020-Q2") as number)
    expect(fiscalOrdinal("2019-Q4")).toBeLessThan(fiscalOrdinal("2020-Q1") as number)
  })

  it("ranks a plain-year annual just after that year's Q4", () => {
    expect(fiscalOrdinal("2019-Q4")).toBeLessThan(fiscalOrdinal("2019") as number)
    expect(fiscalOrdinal("2019")).toBeLessThan(fiscalOrdinal("2020-Q1") as number)
  })

  it("returns null for an unparseable period", () => {
    expect(fiscalOrdinal("FY19")).toBeNull()
  })
})

describe("reconcileEarnings", () => {
  it("dedupes duplicate filings, keeping the earliest source", () => {
    const flash = earnings("2020-Q1", "2020-05-12T20:00:00Z", 1.1, 1.0)
    const restated = earnings("2020-Q1", "2020-05-20T20:00:00Z", 1.05, 1.0)
    const kept = reconcileEarnings([restated, flash])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.knownAt).toBe(flash.knownAt)
  })

  it("drops a retrospective filing (an older period announced after a newer one)", () => {
    const q1 = earnings("2020-Q1", "2020-05-12T20:00:00Z", 1.1, 1.0)
    const q2 = earnings("2020-Q2", "2020-08-11T20:00:00Z", 1.2, 1.0)
    const retro = earnings("2019-Q4", "2020-08-20T20:00:00Z", 0.9, 1.0)
    const kept = reconcileEarnings([q1, q2, retro])
    expect(kept.map((e) => e.fiscalPeriod)).toEqual(["2020-Q1", "2020-Q2"])
  })
})

describe("earnings-drift predict", () => {
  it("beats produce positive conviction scaled by the consensus surprise", async () => {
    const data = new StubMarketData({
      earnings: [earnings("2020-Q1", "2020-05-12T20:00:00Z", 1.1, 1.0)],
      prices: priceBars(businessDays("2020-05-11", "2020-05-13")),
    })
    const signal = await analyst.predict(ctx("2020-05-13T21:00:00Z", data))
    expect(signal.abstained).toBe(false)
    // surprise = 0.10 → magnitude 0.10 * 2 = 0.20
    expect(signal.conviction).toBeCloseTo(0.2, 12)
    expect(signal.components?.consensusSurprise).toBeCloseTo(0.1, 12)
    expect(signal.components?.tradingDaysSinceAnnouncement).toBe(1)
    expect(signal.horizonDays).toBe(20)
  })

  it("misses produce negative conviction", async () => {
    const data = new StubMarketData({
      earnings: [earnings("2020-Q1", "2020-05-12T20:00:00Z", 0.9, 1.0)],
      prices: priceBars(businessDays("2020-05-11", "2020-05-13")),
    })
    const signal = await analyst.predict(ctx("2020-05-13T21:00:00Z", data))
    expect(signal.conviction).toBeCloseTo(-0.2, 12)
    expect(signal.abstained).toBe(false)
  })

  it("abstains on a filing outside the freshness window", async () => {
    const data = new StubMarketData({
      earnings: [earnings("2020-Q1", "2020-05-12T20:00:00Z", 1.1, 1.0)],
      prices: priceBars(businessDays("2020-05-11", "2020-05-20")),
    })
    // 6 trading days after 2020-05-12 > default window of 4
    const signal = await analyst.predict(ctx("2020-05-20T21:00:00Z", data))
    expect(signal.abstained).toBe(true)
    expect(signal.conviction).toBe(0)
  })

  it("abstains on an in-line result (no beat or miss)", async () => {
    const data = new StubMarketData({
      earnings: [earnings("2020-Q1", "2020-05-12T20:00:00Z", 1.0, 1.0)],
      prices: priceBars(businessDays("2020-05-11", "2020-05-13")),
    })
    const signal = await analyst.predict(ctx("2020-05-13T21:00:00Z", data))
    expect(signal.abstained).toBe(true)
  })

  it("uses a flat reduced magnitude for a proxy (momentum) surprise and records it", async () => {
    const data = new StubMarketData({
      earnings: [earnings("2020-Q1", "2020-05-12T20:00:00Z", 1.3, 1.0, "proxy")],
      prices: priceBars(businessDays("2020-05-11", "2020-05-13")),
    })
    const signal = await analyst.predict(ctx("2020-05-13T21:00:00Z", data))
    expect(signal.abstained).toBe(false)
    // proxy magnitude is flat (0.3), NOT scaled by the 0.30 surprise
    expect(signal.conviction).toBeCloseTo(0.3, 12)
    expect(signal.components?.momentumProxy).toBeCloseTo(0.3, 12)
    expect(signal.components?.consensusSurprise).toBeUndefined()
  })

  it("abstains on a proxy event with a null estimate and no prior-year quarter", async () => {
    const data = new StubMarketData({
      earnings: [earnings("2020-Q1", "2020-05-12T20:00:00Z", 1.3, null, "proxy")],
      prices: priceBars(businessDays("2020-05-11", "2020-05-13")),
    })
    const signal = await analyst.predict(ctx("2020-05-13T21:00:00Z", data))
    expect(signal.abstained).toBe(true)
  })

  it("uses the same-quarter prior-year actual as the baseline for a null-estimate proxy", async () => {
    // No estimate ⇒ the baseline is the prior-year same quarter's actual (2019-Q2
    // = 0.80). Momentum surprise = (1.04 - 0.80) / 0.80 = 0.30, a beat.
    const data = new StubMarketData({
      earnings: [
        earnings("2019-Q2", "2019-08-13T20:00:00Z", 0.8, null, "proxy"),
        earnings("2020-Q2", "2020-08-11T20:00:00Z", 1.04, null, "proxy"),
      ],
      prices: priceBars(businessDays("2020-08-10", "2020-08-13")),
    })
    const signal = await analyst.predict(ctx("2020-08-13T21:00:00Z", data))
    expect(signal.abstained).toBe(false)
    // Flat proxy magnitude (0.3), positive because it beat the prior year.
    expect(signal.conviction).toBeCloseTo(0.3, 12)
    expect(signal.components?.momentumProxy).toBeCloseTo(0.3, 12)
    expect(signal.components?.baseline).toBeCloseTo(0.8, 12)
    expect(signal.components?.consensusSurprise).toBeUndefined()
  })

  it("a null-estimate proxy that fell short of the prior year is a miss", async () => {
    const data = new StubMarketData({
      earnings: [
        earnings("2019-Q2", "2019-08-13T20:00:00Z", 1.0, null, "proxy"),
        earnings("2020-Q2", "2020-08-11T20:00:00Z", 0.7, null, "proxy"),
      ],
      prices: priceBars(businessDays("2020-08-10", "2020-08-13")),
    })
    const signal = await analyst.predict(ctx("2020-08-13T21:00:00Z", data))
    expect(signal.abstained).toBe(false)
    expect(signal.conviction).toBeCloseTo(-0.3, 12)
    expect(signal.components?.baseline).toBeCloseTo(1.0, 12)
  })

  it("abstains when the security has no earnings coverage", async () => {
    const signal = await analyst.predict(ctx("2020-05-13T21:00:00Z", new StubMarketData({ earnings: "not-covered" })))
    expect(signal.abstained).toBe(true)
  })

  it("propagates a DataUnavailableError (fail loud, never an abstain)", async () => {
    const data = new StubMarketData({ earnings: "throw" })
    await expect(analyst.predict(ctx("2020-05-13T21:00:00Z", data))).rejects.toBeInstanceOf(
      DataUnavailableError,
    )
  })
})

describe("earnings-drift over FixtureMarketData (micro-cap momentum path)", () => {
  it("the null-estimate proxy micro-cap yields a non-abstained momentum signal", async () => {
    // The committed fixture spans 2020 only, so the micro-cap's proxy events have
    // no same-quarter-prior-year partner and the momentum path is never reached
    // through the seeded generator. Injecting a synthetic 2019-Q2 proxy actual
    // (the one quarter the 2020-only fixture cannot contain) exercises the real
    // PIT provider end to end without regenerating the seeded dataset — which
    // would shift the PRNG stream and churn every golden.
    const base = await loadFixtureDataset()
    const microId = FIXTURE_IDS.osloMicroCap
    const priorYear: EarningsEvent = {
      securityId: microId,
      fiscalPeriod: "2019-Q2",
      knownAt: "2019-08-13T20:00:00Z",
      currency: "NOK",
      epsActual: 0.6,
      epsEstimate: null,
      surpriseQuality: "proxy",
    }
    const dataset = {
      ...base,
      earnings: { ...base.earnings, [microId]: [priorYear, ...(base.earnings[microId] ?? [])] },
    }
    const md = createFixtureMarketData(dataset)

    // asOf two trading days after the 2020-Q2 announcement (2020-08-11) — inside
    // the freshness window. Latest = 2020-Q2 (actual 0.78); baseline = 2019-Q2
    // actual 0.60. Momentum surprise = (0.78 - 0.60) / 0.60 = 0.30, a beat.
    const signal = await analyst.predict({
      securityId: microId,
      asOf: "2020-08-13T21:00:00Z",
      data: md,
    })

    expect(signal.abstained).toBe(false)
    expect(signal.conviction).toBeCloseTo(0.3, 12)
    expect(signal.components?.momentumProxy).toBeCloseTo(0.3, 12)
    expect(signal.components?.baseline).toBeCloseTo(0.6, 12)
    expect(signal.components?.consensusSurprise).toBeUndefined()
  })
})
