import type { TradingCalendar } from "../backtest/calendar.js"
import type { Mic } from "../data/symbols.js"
import type { CycleClock } from "../cycle/run-cycle.js"

/**
 * The paper clock (plan 002, phase 6) — a {@link CycleClock} for live-style
 * operation.
 *
 * The kernel cannot tell the paper clock from the historical (backtest) one;
 * they differ only in how they derive the cutoff and fill sessions. This clock
 * runs "today": it forms a decision after today's close (a PIT cutoff at
 * {@link PaperClockConfig.cutoffTime}, after every exchange close) and settles
 * each order at the symbol's **next** session — never same-bar.
 *
 * Time is injected, never read from the wall clock: the caller supplies `now`,
 * and a clock instance is pinned to the instant it was constructed at, so every
 * method returns a stable value for the duration of one decision cycle. A fresh
 * clock is built per session (per `now`).
 */
export interface PaperClockConfig {
  /** Injected time source — the current instant as an ISO string. */
  readonly now: () => string
  /** Exchange-aware calendar: which mic trades when, and each mic's next session. */
  readonly calendar: TradingCalendar
  /** Securities in scope this session, with the exchange each trades on. */
  readonly securities: readonly { readonly securityId: string; readonly mic: Mic }[]
  /** UTC time-of-day for the decision cutoff, after every exchange close. Default "23:00:00Z". */
  readonly cutoffTime?: string
  /**
   * Derive the session date (YYYY-MM-DD) from the current instant. Default: the
   * UTC date of `now`. Injectable so a caller with a specific exchange timezone
   * convention can override it.
   */
  readonly sessionDate?: (now: string) => string
}

function defaultSessionDate(now: string): string {
  return now.slice(0, 10)
}

/**
 * Build a paper {@link CycleClock} pinned to the instant `now()` returns at
 * construction. `activeSecurities` are those whose exchange trades on the session
 * date; `fillDate` is each symbol's next session (which may be a session that has
 * not happened yet — the paper broker rests the order until it prices).
 */
export function createPaperClock(config: PaperClockConfig): CycleClock {
  const instant = config.now()
  const today = (config.sessionDate ?? defaultSessionDate)(instant)
  const cutoff = config.cutoffTime ?? "23:00:00Z"
  const asOf = `${today}T${cutoff}`

  const micById = new Map<string, Mic>()
  for (const s of config.securities) micById.set(s.securityId, s.mic)

  const active = config.securities
    .filter((s) => config.calendar.isTradingDay(s.mic, today))
    .map((s) => s.securityId)

  return {
    asOf: () => asOf,
    activeSecurities: () => active,
    fillDate: (securityId) => {
      const mic = micById.get(securityId)
      if (mic === undefined) return null
      return config.calendar.nextSession(mic, today)
    },
  }
}
