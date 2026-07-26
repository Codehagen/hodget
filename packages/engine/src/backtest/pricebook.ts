import type { Currency, FxRate, Price } from "../data/types.js"
import type { Mic } from "../data/symbols.js"

/**
 * Raw-price + FX access for the simulator (plan 002, "Corporate actions" +
 * "FX / base currency"). The book **trades and accounts on raw prices**, so this
 * surfaces `close` (never `adjClose`); adjusted series belong only to analytics.
 *
 * Two price lookups are deliberately distinct:
 * - `closeOn` — the exact session close, used to price a fill (a fill only ever
 *   settles on a real trading session for that symbol's exchange).
 * - `markOn` — the last close on or before a date, so mark-to-market carries the
 *   last available price on a symbol's non-trading days.
 *
 * `rateToBase` converts an amount in some currency to the base currency at the
 * PIT rate as of a date (carried forward from the last available quote).
 */
export interface MarketPrices {
  micOf(securityId: string): Mic
  currencyOf(securityId: string): Currency
  /** Exact raw close on a session, or null if the symbol did not trade that day. */
  closeOn(securityId: string, date: string): number | null
  /** Last raw close on or before `date` (carry-forward), or null if none. */
  markOn(securityId: string, date: string): number | null
  /** Multiplier from `currency` to the base currency as of `date`. */
  rateToBase(currency: Currency, date: string): number
}

interface SecurityMeta {
  readonly mic: Mic
  readonly currency: Currency
}

interface Series {
  readonly dates: readonly string[]
  readonly closeByDate: ReadonlyMap<string, number>
}

/** Last index in ascending `dates` whose value is ≤ `date`, or -1. */
function lastAtOrBefore(dates: readonly string[], date: string): number {
  let lo = 0
  let hi = dates.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((dates[mid] as string) <= date) lo = mid + 1
    else hi = mid
  }
  return lo - 1
}

function buildSeries(rows: readonly { date: string; value: number }[]): Series {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const closeByDate = new Map<string, number>()
  const dates: string[] = []
  for (const row of sorted) {
    closeByDate.set(row.date, row.value)
    dates.push(row.date)
  }
  return { dates, closeByDate }
}

export interface PriceBookInput {
  readonly securities: readonly { securityId: string; mic: Mic; currency: Currency }[]
  readonly prices: Readonly<Record<string, readonly Price[]>>
  readonly fx: Readonly<Record<string, readonly FxRate[]>>
  readonly baseCurrency: Currency
}

/** Build a {@link MarketPrices} over raw price + FX series (e.g. a fixture dataset). */
export function createPriceBook(input: PriceBookInput): MarketPrices {
  const meta = new Map<string, SecurityMeta>()
  for (const s of input.securities) meta.set(s.securityId, { mic: s.mic, currency: s.currency })

  const priceSeries = new Map<string, Series>()
  for (const [securityId, rows] of Object.entries(input.prices)) {
    priceSeries.set(
      securityId,
      buildSeries(rows.map((p) => ({ date: p.date, value: p.close }))),
    )
  }

  const fxSeries = new Map<string, Series>()
  for (const [pair, rows] of Object.entries(input.fx)) {
    fxSeries.set(pair, buildSeries(rows.map((r) => ({ date: r.date, value: r.rate }))))
  }

  const requireMeta = (securityId: string): SecurityMeta => {
    const m = meta.get(securityId)
    if (!m) throw new Error(`unknown security: ${securityId}`)
    return m
  }

  const fxAsOf = (pair: string, date: string): number | null => {
    const series = fxSeries.get(pair)
    if (!series) return null
    const idx = lastAtOrBefore(series.dates, date)
    if (idx < 0) return null
    return series.closeByDate.get(series.dates[idx] as string) ?? null
  }

  return {
    micOf(securityId) {
      return requireMeta(securityId).mic
    },
    currencyOf(securityId) {
      return requireMeta(securityId).currency
    },
    closeOn(securityId, date) {
      return priceSeries.get(securityId)?.closeByDate.get(date) ?? null
    },
    markOn(securityId, date) {
      const series = priceSeries.get(securityId)
      if (!series) return null
      const idx = lastAtOrBefore(series.dates, date)
      if (idx < 0) return null
      return series.closeByDate.get(series.dates[idx] as string) ?? null
    },
    rateToBase(currency, date) {
      if (currency === input.baseCurrency) return 1
      const direct = fxAsOf(`${currency}${input.baseCurrency}`, date)
      if (direct !== null) return direct
      const inverse = fxAsOf(`${input.baseCurrency}${currency}`, date)
      if (inverse !== null && inverse !== 0) return 1 / inverse
      throw new Error(`no FX rate for ${currency}→${input.baseCurrency} as of ${date}`)
    },
  }
}
