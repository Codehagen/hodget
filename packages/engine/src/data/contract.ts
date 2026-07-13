import { describe, expect, it } from "vitest"

import { DataUnavailableError } from "./errors.js"
import type { DateRange, MarketData } from "./market-data.js"
import { earningsEventSchema, fxRateSchema, priceSchema } from "./types.js"

/**
 * A shared, provider-agnostic contract suite. `describeMarketDataContract`
 * asserts the semantics every `MarketData` implementation must honour, so the
 * same suite runs against `FixtureMarketData` in CI and against each live
 * provider behind `LIVE_DATA_TESTS=1` (plan 003). If a provider renames a
 * field, this breaks — not a backtest three weeks later.
 */
export interface MarketDataContractOptions {
  /** A covered equity with prices/fundamentals/earnings across `range`. */
  readonly coveredSecurityId: string
  /** The covered equity's exchange range to query prices over. */
  readonly range: DateRange
  /** A securityId the provider does not cover (asserts `not-covered`). */
  readonly uncoveredSecurityId: string
  /** A securityId whose access simulates a transport failure (asserts throw). */
  readonly failingSecurityId: string
  /** FX pair present for every trading day. */
  readonly fxPair: string
  /** Union trading-day calendar (ISO dates) FX must cover. */
  readonly tradingDays: readonly string[]
  /** An asOf late enough to reveal all fixture data. */
  readonly lateAsOf: string
  /** An asOf earlier than any data (reveals nothing / a strict subset). */
  readonly earlyAsOf: string
}

export function describeMarketDataContract(
  makeClient: () => MarketData | Promise<MarketData>,
  opts: MarketDataContractOptions,
): void {
  describe("MarketData contract", () => {
    async function client(): Promise<MarketData> {
      return makeClient()
    }

    it("returns covered, schema-valid, ordered prices with no duplicate dates", async () => {
      const c = await client()
      const result = await c.prices(opts.coveredSecurityId, opts.range, opts.lateAsOf)
      expect(result.coverage).toBe("covered")
      expect(result.rows.length).toBeGreaterThan(0)

      const seen = new Set<string>()
      let prev = ""
      for (const row of result.rows) {
        expect(() => priceSchema.parse(row)).not.toThrow()
        expect(typeof row.close).toBe("number")
        expect(typeof row.adjClose).toBe("number")
        expect(row.currency).toBeTruthy()
        expect(seen.has(row.date)).toBe(false)
        seen.add(row.date)
        expect(row.date >= prev).toBe(true)
        prev = row.date
      }
    })

    it("distinguishes not-covered from covered-empty", async () => {
      const c = await client()
      const result = await c.prices(opts.uncoveredSecurityId, opts.range, opts.lateAsOf)
      expect(result.coverage).toBe("not-covered")
      expect(result.rows.length).toBe(0)
    })

    it("throws DataUnavailableError on a transport failure (never empty)", async () => {
      const c = await client()
      await expect(
        c.prices(opts.failingSecurityId, opts.range, opts.lateAsOf),
      ).rejects.toBeInstanceOf(DataUnavailableError)
      await expect(c.fundamentals(opts.failingSecurityId, opts.lateAsOf)).rejects.toBeInstanceOf(
        DataUnavailableError,
      )
    })

    it("reveals more facts at a later asOf (PIT is monotonic)", async () => {
      const c = await client()
      const early = await c.fundamentals(opts.coveredSecurityId, opts.earlyAsOf)
      const late = await c.fundamentals(opts.coveredSecurityId, opts.lateAsOf)

      expect(late.rows.length).toBeGreaterThan(early.rows.length)

      const lateSet = new Set(late.rows.map((r) => JSON.stringify(r)))
      for (const row of early.rows) {
        // Everything visible earlier is still visible later.
        expect(lateSet.has(JSON.stringify(row))).toBe(true)
      }
    })

    it("never returns a fact filed after the asOf", async () => {
      const c = await client()
      const result = await c.fundamentals(opts.coveredSecurityId, opts.lateAsOf)
      const asOfMs = Date.parse(opts.lateAsOf)
      for (const row of result.rows) {
        // Date-only knownAt parses to midnight UTC; still <= a late asOf.
        expect(Date.parse(row.knownAt)).toBeLessThanOrEqual(asOfMs)
      }
    })

    it("tags every earnings event with a surprise quality and a PIT anchor", async () => {
      const c = await client()
      const result = await c.earnings(opts.coveredSecurityId, opts.lateAsOf)
      expect(result.coverage).toBe("covered")
      const asOfMs = Date.parse(opts.lateAsOf)
      for (const row of result.rows) {
        expect(() => earningsEventSchema.parse(row)).not.toThrow()
        expect(["consensus", "proxy"]).toContain(row.surpriseQuality)
        expect(Date.parse(row.knownAt)).toBeLessThanOrEqual(asOfMs)
      }
    })

    it("has an FX rate for every trading day in range", async () => {
      const c = await client()
      for (const day of opts.tradingDays) {
        const result = await c.fxRate(opts.fxPair, `${day}T23:59:00Z`)
        expect(result.coverage).toBe("covered")
        expect(result.rows.length).toBeGreaterThan(0)
        const latest = result.rows[result.rows.length - 1]
        expect(latest).toBeDefined()
        expect(() => fxRateSchema.parse(latest)).not.toThrow()
        expect(latest?.date).toBe(day)
      }
    })
  })
}
