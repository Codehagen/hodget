import type { DateRange } from "../data/market-data.js"
import type { Mic } from "../data/symbols.js"

/**
 * Exchange-aware trading calendar (plan 002, "Market realities").
 *
 * The backtest clock is the **union** of every exchange's trading days, but each
 * symbol is only tradable/markable on its own exchange's days (XOSL ≠ XNAS).
 * The union drives the day-by-day loop; per-exchange membership decides whether
 * a given symbol may trade or must carry its last close (mark-to-market).
 *
 * `nextSession` is the spine of next-session fill semantics: a decision formed
 * after a session's close fills at the exchange's *next* trading day, never the
 * same bar.
 */
export interface TradingCalendar {
  /** The union of every exchange's trading days, ascending and de-duplicated. */
  readonly union: readonly string[]
  /** Whether `mic` trades on `date` (YYYY-MM-DD). */
  isTradingDay(mic: Mic, date: string): boolean
  /** `mic`'s trading days within `[range.from, range.to]`, ascending. */
  tradingDays(mic: Mic, range: DateRange): string[]
  /** The first `mic` trading day strictly after `date`, or null if none remains. */
  nextSession(mic: Mic, date: string): string | null
}

function sortedUnique(days: readonly string[]): string[] {
  return [...new Set(days)].sort()
}

/** First index in ascending `days` whose value is strictly greater than `date`. */
function firstAfter(days: readonly string[], date: string): number {
  let lo = 0
  let hi = days.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((days[mid] as string) <= date) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Build a {@link TradingCalendar} from per-exchange trading-day lists (e.g. the
 * committed fixture's `calendars` map). Exchanges absent from the map have no
 * trading days — a symbol on such an exchange is never tradable.
 */
export function createTradingCalendar(
  calendars: Partial<Record<Mic, readonly string[]>>,
): TradingCalendar {
  const perMic = new Map<Mic, string[]>()
  const perMicSet = new Map<Mic, Set<string>>()
  const all: string[] = []
  for (const [mic, days] of Object.entries(calendars) as [Mic, readonly string[]][]) {
    const sorted = sortedUnique(days)
    perMic.set(mic, sorted)
    perMicSet.set(mic, new Set(sorted))
    all.push(...sorted)
  }
  const union = sortedUnique(all)

  return {
    union,
    isTradingDay(mic, date) {
      return perMicSet.get(mic)?.has(date) ?? false
    },
    tradingDays(mic, range) {
      const days = perMic.get(mic)
      if (!days) return []
      return days.filter((d) => d >= range.from && d <= range.to)
    },
    nextSession(mic, date) {
      const days = perMic.get(mic)
      if (!days) return null
      const idx = firstAfter(days, date)
      return idx < days.length ? (days[idx] as string) : null
    },
  }
}
