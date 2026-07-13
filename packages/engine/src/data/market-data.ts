import type { z } from "zod"

import { DataQualityError } from "./errors.js"
import { coerceKnownAt, parseInstant } from "./time.js"
import {
  corporateActionEventSchema,
  earningsEventSchema,
  fundamentalsSnapshotSchema,
  fxRateSchema,
  insiderTradeSchema,
  newsItemSchema,
  priceSchema,
  type CorporateActionEvent,
  type EarningsEvent,
  type FundamentalsSnapshot,
  type FxRate,
  type InsiderTrade,
  type NewsItem,
  type Price,
} from "./types.js"
import { micTimeZone, type SecurityResolver } from "./symbols.js"

export interface DateRange {
  readonly from: string
  readonly to: string
}

/**
 * Coverage-status envelope. "No rows" is ambiguous, so results distinguish:
 *
 * - `covered` — the provider covers this symbol/range; `rows` may legitimately
 *   be empty (a genuine "no such facts"). Analysts may treat this as information.
 * - `not-covered` — symbol unknown, exchange unsupported, or history not
 *   covered. This must never masquerade as `covered`-empty.
 */
export type MarketDataResult<T> =
  | { readonly coverage: "covered"; readonly rows: readonly T[] }
  | { readonly coverage: "not-covered"; readonly rows: readonly [] }

export function covered<T>(rows: readonly T[]): MarketDataResult<T> {
  return { coverage: "covered", rows }
}

export function notCovered<T>(): MarketDataResult<T> {
  return { coverage: "not-covered", rows: [] }
}

/**
 * The engine's data port. Every method takes an `asOf` decision cutoff and may
 * only return facts with `knownAt <= asOf`. PIT filtering is enforced centrally
 * (see {@link PitMarketData}) so no caller or provider can forget it.
 *
 * Contract: a genuine absence returns a `covered`-empty result; a source
 * failure throws `DataUnavailableError`; an unusable row throws
 * `DataQualityError`.
 */
export interface MarketData {
  prices(securityId: string, range: DateRange, asOf: string): Promise<MarketDataResult<Price>>
  fundamentals(securityId: string, asOf: string): Promise<MarketDataResult<FundamentalsSnapshot>>
  earnings(securityId: string, asOf: string): Promise<MarketDataResult<EarningsEvent>>
  news(securityId: string, asOf: string): Promise<MarketDataResult<NewsItem>>
  insiderTrades(securityId: string, asOf: string): Promise<MarketDataResult<InsiderTrade>>
  corporateActions(
    securityId: string,
    asOf: string,
  ): Promise<MarketDataResult<CorporateActionEvent>>
  fxRate(pair: string, asOf: string): Promise<MarketDataResult<FxRate>>
}

/** A raw (un-filtered) result from a provider source, before PIT enforcement. */
export interface RawResult {
  readonly coverage: "covered" | "not-covered"
  readonly rows: readonly unknown[]
}

/**
 * The lower-level port a provider implements. It returns ALL rows it has for a
 * symbol (unfiltered by `asOf`), or signals a transport failure by throwing
 * `DataUnavailableError`. It never applies PIT — {@link PitMarketData} does.
 */
export interface RawMarketDataSource {
  prices(securityId: string, range: DateRange): Promise<RawResult> | RawResult
  fundamentals(securityId: string): Promise<RawResult> | RawResult
  earnings(securityId: string): Promise<RawResult> | RawResult
  news(securityId: string): Promise<RawResult> | RawResult
  insiderTrades(securityId: string): Promise<RawResult> | RawResult
  corporateActions(securityId: string): Promise<RawResult> | RawResult
  fxRate(pair: string): Promise<RawResult> | RawResult
}

interface KnownRow {
  readonly knownAt: string
}

function validateRow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new DataQualityError("malformed data row", { cause: parsed.error })
  }
  return parsed.data
}

/**
 * The central PIT-enforcement wrapper: validates each row, resolves its
 * `knownAt` to an instant (date-only coerced to exchange end-of-day), and keeps
 * only rows with `knownAt <= asOf`. Coverage status is passed through untouched.
 */
export class PitMarketData implements MarketData {
  constructor(
    private readonly source: RawMarketDataSource,
    private readonly resolver: SecurityResolver,
  ) {}

  private timeZoneFor(securityId: string): string {
    const ref = this.resolver.resolve(securityId)
    return ref ? micTimeZone(ref.mic) : "UTC"
  }

  private applyPit<T extends KnownRow>(
    raw: RawResult,
    schema: z.ZodType<T>,
    asOf: string,
    timeZone: string,
  ): MarketDataResult<T> {
    if (raw.coverage === "not-covered") return notCovered<T>()
    const asOfMs = parseInstant(asOf)
    const out: T[] = []
    for (const candidate of raw.rows) {
      const row = validateRow(schema, candidate)
      if (coerceKnownAt(row.knownAt, timeZone) <= asOfMs) out.push(row)
    }
    return covered(out)
  }

  async prices(
    securityId: string,
    range: DateRange,
    asOf: string,
  ): Promise<MarketDataResult<Price>> {
    const raw = await this.source.prices(securityId, range)
    const result = this.applyPit(raw, priceSchema, asOf, this.timeZoneFor(securityId))
    if (result.coverage === "not-covered") return result
    const inRange = result.rows
      .filter((p) => p.date >= range.from && p.date <= range.to)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    return covered(inRange)
  }

  async fundamentals(
    securityId: string,
    asOf: string,
  ): Promise<MarketDataResult<FundamentalsSnapshot>> {
    const raw = await this.source.fundamentals(securityId)
    return this.applyPit(raw, fundamentalsSnapshotSchema, asOf, this.timeZoneFor(securityId))
  }

  async earnings(securityId: string, asOf: string): Promise<MarketDataResult<EarningsEvent>> {
    const raw = await this.source.earnings(securityId)
    return this.applyPit(raw, earningsEventSchema, asOf, this.timeZoneFor(securityId))
  }

  async news(securityId: string, asOf: string): Promise<MarketDataResult<NewsItem>> {
    const raw = await this.source.news(securityId)
    return this.applyPit(raw, newsItemSchema, asOf, this.timeZoneFor(securityId))
  }

  async insiderTrades(securityId: string, asOf: string): Promise<MarketDataResult<InsiderTrade>> {
    const raw = await this.source.insiderTrades(securityId)
    return this.applyPit(raw, insiderTradeSchema, asOf, this.timeZoneFor(securityId))
  }

  async corporateActions(
    securityId: string,
    asOf: string,
  ): Promise<MarketDataResult<CorporateActionEvent>> {
    const raw = await this.source.corporateActions(securityId)
    return this.applyPit(raw, corporateActionEventSchema, asOf, this.timeZoneFor(securityId))
  }

  async fxRate(pair: string, asOf: string): Promise<MarketDataResult<FxRate>> {
    const raw = await this.source.fxRate(pair)
    // FX has no exchange; its knownAt values are full instants (UTC is fine).
    const result = this.applyPit(raw, fxRateSchema, asOf, "UTC")
    if (result.coverage === "not-covered") return result
    const sorted = [...result.rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    return covered(sorted)
  }
}
