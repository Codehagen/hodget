import { DataQualityError } from "../data/errors.js"
import { coerceKnownAt } from "../data/time.js"
import type { Signal } from "../types.js"

/**
 * The outcome port and signal resolution (plan 023, step 2).
 *
 * Attribution is the one thing in the engine that genuinely needs prices from
 * **after** a decision cutoff — you cannot score a forecast without its
 * outcome. There are two ways to get them and only one is safe.
 *
 * The rejected way is a forward-return method on `MarketData`, or calling it
 * with `asOf: <now>`. Either makes a single port capable of returning future
 * data, and `AnalystContext` holds a `MarketData` — so one refactor, one
 * autocomplete accident or one helpful `asOf` default is all that stands
 * between that and an analyst reading its own future. The PIT invariant would
 * become a convention rather than a structural guarantee, which is exactly what
 * `PitMarketData` exists to prevent.
 *
 * The chosen way is {@link OutcomeData}: a distinct port with its own
 * interface, its own implementations, and **no presence on `AnalystContext`**.
 * Analysts cannot reach it because they are never handed it — the type system,
 * not discipline, is the enforcement. `boundary.test.ts` fails the build if an
 * analyst so much as imports this module.
 *
 * Every resolved {@link Observation} carries a non-optional `resolvedAt`: the
 * instant the outcome became knowable. That stamp is what lets downstream
 * consumers (scorecards, and any future prompt-injected reflection) re-apply
 * the ordinary `knownAt <= asOf` filter. **An attribution record without a
 * `resolvedAt` is a look-ahead channel**, so the type makes it impossible to
 * omit.
 */

/** A realized price observation used only for attribution. */
export interface OutcomeBar {
  readonly date: string
  readonly adjClose: number
}

/**
 * The forward-looking data port. Deliberately NOT `MarketData`: this is the
 * only interface in the engine permitted to return facts from after a decision
 * cutoff, and it is never placed on `AnalystContext`.
 *
 * Sessions are *trading* sessions, not calendar days — a horizon of 5 means
 * five sessions on that security's exchange calendar. Closes must be
 * **adjusted**, or every split masquerades as alpha.
 */
export interface OutcomeData {
  /** Sessions strictly after `after`, ascending, at most `limit` of them. */
  sessionsAfter(securityId: string, after: string, limit: number): Promise<readonly OutcomeBar[]>
}

/** One signal resolved into the alpha it actually realized. */
export interface Observation {
  readonly analystId: string
  readonly securityId: string
  readonly asOf: string
  readonly conviction: number
  readonly horizonDays: number
  readonly forwardReturn: number
  readonly benchmarkReturn: number
  readonly forwardAlpha: number
  /** End of the exit session — when this outcome became knowable. NEVER optional. */
  readonly resolvedAt: string
}

export interface ResolutionSummary {
  readonly observations: readonly Observation[]
  /**
   * Signals excluded because their outcome is not resolvable: the horizon
   * window has not completed, or a benchmark leg is missing for one of the two
   * dates. Never zero-filled — a missing outcome is missing information, not a
   * zero return, and folding it in as 0 would flatter every analyst whose views
   * are still open.
   */
  readonly unresolved: number
  /** Signals excluded because the analyst abstained. */
  readonly abstained: number
}

export interface ResolveObservationsOptions {
  /**
   * The benchmark to measure excess return against. A function selects one per
   * security, which is how a multi-exchange panel gets a benchmark per MIC
   * (plan 003's outcome amendment) without a second port.
   */
  readonly benchmark: string | ((securityId: string) => string)
  /**
   * Exchange timezone used to stamp `resolvedAt` at end of the exit session.
   * Default "UTC". A function selects one per security, which matters for a
   * multi-exchange panel: one shared timezone would stamp XNAS outcomes at
   * Oslo's end of day — an hour *before* the US session actually closed — and
   * `resolvedAt` is the field the downstream PIT re-filtering rests on.
   */
  readonly timeZone?: string | ((securityId: string) => string)
}

/**
 * Resolve recorded signals into realized forward alpha.
 *
 * Measurement rules, each of which exists to stop a specific way of lying to
 * yourself:
 *
 * - **Entry is the first session strictly after `asOf`**, not the `asOf` close.
 *   The sim broker settles next-session; measuring from the same-day close
 *   would credit analysts with a fill the fund could never have gotten. This is
 *   *checked*, not assumed: a port that returns a bar dated `asOf` (a
 *   `sessionsAfter` implemented with `>=`) yields an unresolved signal rather
 *   than a free next-session fill.
 * - **`resolvedAt` must land at or after `asOf`.** The symmetric guard: an
 *   outcome that became knowable before the decision it scores is not an
 *   outcome.
 * - **Exit is `horizonDays` sessions further on**, the analyst's own stated
 *   horizon — so a slow thesis is not judged on a fast clock.
 * - **Alpha is excess over the benchmark across the identical two dates.** If
 *   the benchmark lacks either date the observation is unresolved; falling back
 *   to the raw return would quietly re-label beta as skill.
 * - **A window that has not completed is unresolved**, counted and excluded.
 *
 * Output is sorted by `(asOf, securityId, analystId)`, so the result is
 * deterministic regardless of input order.
 */
export async function resolveObservations(
  signals: readonly Signal[],
  outcomes: OutcomeData,
  options: ResolveObservationsOptions,
): Promise<ResolutionSummary> {
  const benchmark = options.benchmark
  const benchmarkFor = typeof benchmark === "function" ? benchmark : () => benchmark
  const timeZone = options.timeZone ?? "UTC"
  const timeZoneFor = typeof timeZone === "function" ? timeZone : () => timeZone

  // A panel of N analysts covering the same security at the same cutoff asks
  // the port the same question N times; memoize so a provider sees it once.
  const cache = new Map<string, readonly OutcomeBar[]>()
  const sessions = async (
    securityId: string,
    after: string,
    limit: number,
  ): Promise<readonly OutcomeBar[]> => {
    const key = `${securityId}\u0000${after}\u0000${limit}`
    const cached = cache.get(key)
    if (cached) return cached
    const bars = await outcomes.sessionsAfter(securityId, after, limit)
    cache.set(key, bars)
    return bars
  }

  const observations: Observation[] = []
  let unresolved = 0
  let abstained = 0

  for (const signal of signals) {
    if (signal.abstained) {
      abstained++
      continue
    }

    // Entry plus `horizonDays` further sessions: exactly horizonDays + 1 bars.
    // Fewer means the window runs past the data we have.
    const needed = signal.horizonDays + 1
    const bars = await sessions(signal.securityId, signal.asOf, needed)
    const entry = bars[0]
    const exit = bars[needed - 1]
    if (bars.length !== needed || !entry || !exit) {
      unresolved++
      continue
    }

    // "Entry is the first session STRICTLY after asOf" is the whole of design
    // decision 4, and until here it was a contract the port was merely asked to
    // honour. A provider that implements `sessionsAfter` with `>=` — an easy,
    // silent, entirely plausible off-by-one — hands back a bar dated `asOf`
    // itself, and every analyst on the panel gets a same-day fill the sim broker
    // could never have produced. Nothing downstream could tell: the alpha is
    // arithmetically fine, just measured from a price the fund could not trade
    // at. So verify it here rather than trust it, and treat a violation as
    // unresolved — measuring from a bar we cannot stand behind is worse than
    // measuring nothing.
    const asOfDay = day(signal.asOf)
    if (!(day(entry.date) > asOfDay)) {
      unresolved++
      continue
    }

    const exitDay = day(exit.date)
    const benchBars = await benchmarkSpanning(
      sessions,
      benchmarkFor(signal.securityId),
      signal.asOf,
      needed,
      exitDay,
    )
    // Keyed on the date part: a provider may serve a full timestamp on one leg
    // and a bare date on the other, and matching those as raw strings would read
    // as a missing benchmark date and discard a resolvable observation.
    const benchClose = new Map(benchBars.map((bar) => [day(bar.date), bar.adjClose]))
    const benchEntry = benchClose.get(day(entry.date))
    const benchExit = benchClose.get(exitDay)
    if (benchEntry === undefined || benchExit === undefined) {
      unresolved++
      continue
    }

    // A non-positive entry price cannot produce a return; treat it as an
    // unresolvable observation rather than emitting Infinity or NaN downstream.
    if (!(entry.adjClose > 0) || !(benchEntry > 0)) {
      unresolved++
      continue
    }

    // `OutcomeBar.date` is an unvalidated provider string. Coercing it as-is
    // would let a full timestamp (`2024-01-11T00:00:00Z`) through untouched, and
    // `resolvedAt` would then claim the outcome was knowable at midnight — a
    // full session before it actually was. That is precisely the channel the
    // stamp exists to close, so normalize to the date part first and let
    // `coerceKnownAt` do its end-of-session coercion.
    const timeZone = timeZoneFor(signal.securityId)
    const resolvedAtMs = knownAtOrNull(exitDay, timeZone)
    const asOfMs = knownAtOrNull(signal.asOf, timeZone)
    // The symmetric guard to the entry check: an outcome that became knowable
    // before the decision it scores is not an outcome, it is a look-ahead record
    // with the sign flipped. Unresolved, never measured.
    if (resolvedAtMs === null || asOfMs === null || resolvedAtMs < asOfMs) {
      unresolved++
      continue
    }

    const forwardReturn = exit.adjClose / entry.adjClose - 1
    const benchmarkReturn = benchExit / benchEntry - 1
    observations.push({
      analystId: signal.analystId,
      securityId: signal.securityId,
      asOf: signal.asOf,
      conviction: signal.conviction,
      horizonDays: signal.horizonDays,
      forwardReturn,
      benchmarkReturn,
      forwardAlpha: forwardReturn - benchmarkReturn,
      resolvedAt: new Date(resolvedAtMs).toISOString(),
    })
  }

  observations.sort(
    (a, b) =>
      compare(a.asOf, b.asOf) ||
      compare(a.securityId, b.securityId) ||
      compare(a.analystId, b.analystId),
  )

  return { observations, unresolved, abstained }
}

/** How far past the security's own session count the benchmark request may grow. */
const MAX_BENCHMARK_WIDENINGS = 4

/**
 * Fetch enough benchmark sessions to span the security's exit date.
 *
 * The security's exit is its `horizonDays`-th *own* session. If it missed a
 * session the benchmark did not trade through — a halt, a suspension, or simply
 * a different exchange calendar — that date sits further out on the benchmark's
 * calendar than the same session count reaches. Asking for the security's count
 * and stopping there would read as "the benchmark is missing this date" and
 * discard a perfectly resolvable observation, biasing the sample toward
 * securities whose calendar happens to match their benchmark's.
 *
 * So the request widens until it spans the exit date, the provider runs out of
 * sessions (a short page means there are no more), or the cap is hit.
 */
async function benchmarkSpanning(
  sessions: (securityId: string, after: string, limit: number) => Promise<readonly OutcomeBar[]>,
  benchmarkId: string,
  after: string,
  initialLimit: number,
  throughDate: string,
): Promise<readonly OutcomeBar[]> {
  let limit = initialLimit
  let bars = await sessions(benchmarkId, after, limit)
  for (let widening = 0; widening < MAX_BENCHMARK_WIDENINGS; widening++) {
    const last = bars[bars.length - 1]
    if (!last || day(last.date) >= throughDate || bars.length < limit) break
    limit *= 2
    bars = await sessions(benchmarkId, after, limit)
  }
  return bars
}

/**
 * The date part of a bar date or decision cutoff. Sessions are compared by
 * calendar date, never by raw string: a provider that serves timestamps must
 * still line up with one that serves bare dates.
 */
function day(value: string): string {
  return value.slice(0, 10)
}

/**
 * `coerceKnownAt`, but a malformed value yields `null` instead of throwing.
 *
 * Provider dates are unvalidated strings. One unparseable bar should cost that
 * one observation — counted as unresolved, the same as any other outcome we
 * cannot stand behind — not the whole attribution run.
 */
function knownAtOrNull(value: string, timeZone: string): number | null {
  try {
    return coerceKnownAt(value, timeZone)
  } catch (error) {
    if (error instanceof DataQualityError) return null
    throw error
  }
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
