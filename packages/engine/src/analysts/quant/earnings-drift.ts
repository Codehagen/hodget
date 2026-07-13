import type { EarningsEvent } from "../../data/types.js"
import type { Analyst, AnalystContext, Signal } from "../../types.js"

/**
 * Earnings-drift quant analyst (plan 002 phase 2).
 *
 * Post-earnings drift: a beat pushes conviction positive, a miss negative, for
 * a bounded window after the announcement. Discipline the plan requires:
 *
 * - **PIT-honest.** Consumes only `AnalystContext.data.earnings`, which is
 *   already scoped to `knownAt <= asOf`. A `DataUnavailableError` from the data
 *   layer PROPAGATES (fail loud) — it is never swallowed into "no view".
 * - **Dedupe by report period, earliest source wins.** Two filings of the same
 *   fiscal period keep the earlier announcement (the flash the market reacted
 *   to), dropping the later restatement.
 * - **Retrospective filings dropped.** A filing that reports a period older than
 *   one already announced (an out-of-order restatement) is discarded.
 * - **Freshness window.** The drift is only traded for a bounded number of
 *   trading days after the announcement (default 4); trading days are counted
 *   from the PIT-scoped price series.
 * - **Honest magnitude (the earnings-momentum rule, plan 003).** When the
 *   surprise is measured against a real pre-announcement consensus
 *   (`surpriseQuality: "consensus"`) the magnitude scales with the surprise
 *   size. When it is only a same-period-prior proxy (`"proxy"` — earnings
 *   momentum, not PEAD) a flat, reduced magnitude is used, and `components`
 *   records which regime produced the view so the distinction is never lost.
 */

export const EARNINGS_DRIFT_ANALYST_ID = "quant.earnings-drift"

export interface EarningsDriftConfig {
  readonly id?: string
  /** Trading days after the announcement the drift is still traded. Default 4. */
  readonly freshnessWindowTradingDays?: number
  /** Expected holding horizon of the view. Default 20. */
  readonly horizonDays?: number
  /** Multiplier turning a relative consensus surprise into a magnitude. Default 2. */
  readonly surpriseScale?: number
  /** Magnitude cap for consensus-scaled views. Default 1. */
  readonly maxConsensusMagnitude?: number
  /** Flat magnitude for proxy (momentum) views. Default 0.3. */
  readonly proxyMagnitude?: number
  /** Floor on |estimate| when computing the relative surprise. Default 0.01. */
  readonly minEstimateDenominator?: number
}

type ResolvedConfig = Required<EarningsDriftConfig>

function resolveConfig(config: EarningsDriftConfig): ResolvedConfig {
  return {
    id: config.id ?? EARNINGS_DRIFT_ANALYST_ID,
    freshnessWindowTradingDays: config.freshnessWindowTradingDays ?? 4,
    horizonDays: config.horizonDays ?? 20,
    surpriseScale: config.surpriseScale ?? 2,
    maxConsensusMagnitude: config.maxConsensusMagnitude ?? 1,
    proxyMagnitude: config.proxyMagnitude ?? 0.3,
    minEstimateDenominator: config.minEstimateDenominator ?? 0.01,
  }
}

/**
 * Fiscal-period ordinal for ordering. Supports `YYYY-Qn` and plain `YYYY`
 * (annual, ranked just after that year's Q4). Unparseable periods return
 * `null` — callers keep them (never drop on a format they can't order).
 */
export function fiscalOrdinal(period: string): number | null {
  // Five slots per year (Q1–Q4 = 1–4, annual = 5) so a full-year report ranks
  // strictly after that year's Q4 and strictly before the next year's Q1.
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period)
  if (quarter) return Number(quarter[1]) * 5 + Number(quarter[2])
  const annual = /^(\d{4})$/.exec(period)
  if (annual) return Number(annual[1]) * 5 + 5
  return null
}

/**
 * The same fiscal quarter one year earlier: `2020-Q2` → `2019-Q2`, annual
 * `2020` → `2019`. Unparseable periods return `null`.
 */
export function priorYearPeriod(period: string): string | null {
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period)
  if (quarter) return `${Number(quarter[1]) - 1}-Q${quarter[2]}`
  const annual = /^(\d{4})$/.exec(period)
  if (annual) return `${Number(annual[1]) - 1}`
  return null
}

/**
 * The reported actual for the same fiscal quarter one year earlier, from the
 * PIT-visible (already reconciled) history — the proxy/earnings-momentum
 * baseline (plan 003). `null` when that period is not present.
 */
function priorYearActual(events: readonly EarningsEvent[], period: string): number | null {
  const target = priorYearPeriod(period)
  if (target === null) return null
  for (const event of events) if (event.fiscalPeriod === target) return event.epsActual
  return null
}

function byKnownAtAsc(a: EarningsEvent, b: EarningsEvent): number {
  if (a.knownAt < b.knownAt) return -1
  if (a.knownAt > b.knownAt) return 1
  return a.fiscalPeriod < b.fiscalPeriod ? -1 : a.fiscalPeriod > b.fiscalPeriod ? 1 : 0
}

/**
 * Reduce an earnings history to one qualifying event per report period,
 * dropping retrospective filings:
 *
 * 1. **Dedupe by period, earliest source wins** — group by `fiscalPeriod`,
 *    keep the earliest `knownAt`.
 * 2. **Drop retrospective filings** — walking in announcement order, discard an
 *    event whose fiscal ordinal is below one already announced (an old period
 *    filed after a newer one). Events with unparseable periods are kept.
 */
export function reconcileEarnings(events: readonly EarningsEvent[]): EarningsEvent[] {
  // Pass 1: earliest filing per fiscal period.
  const earliest = new Map<string, EarningsEvent>()
  for (const event of [...events].sort(byKnownAtAsc)) {
    if (!earliest.has(event.fiscalPeriod)) earliest.set(event.fiscalPeriod, event)
  }
  // Pass 2: drop retrospective filings (ordinal below the announced frontier).
  const inOrder = [...earliest.values()].sort(byKnownAtAsc)
  const kept: EarningsEvent[] = []
  let frontier = Number.NEGATIVE_INFINITY
  for (const event of inOrder) {
    const ordinal = fiscalOrdinal(event.fiscalPeriod)
    if (ordinal === null) {
      kept.push(event)
      continue
    }
    if (ordinal < frontier) continue // retrospective
    frontier = ordinal
    kept.push(event)
  }
  return kept
}

/** Pick the most recent qualifying event (newest reporting period). */
function latestByPeriod(events: readonly EarningsEvent[]): EarningsEvent | null {
  let best: EarningsEvent | null = null
  let bestOrdinal = Number.NEGATIVE_INFINITY
  for (const event of events) {
    const ordinal = fiscalOrdinal(event.fiscalPeriod) ?? Number.NEGATIVE_INFINITY
    if (best === null || ordinal > bestOrdinal || (ordinal === bestOrdinal && event.knownAt > best.knownAt)) {
      best = event
      bestOrdinal = ordinal
    }
  }
  return best
}

/**
 * Trading days strictly after `announcementDate` up to `asOf`, counted from the
 * PIT-scoped price bars. `null` when prices are not covered (freshness cannot be
 * assessed). A `DataUnavailableError` propagates.
 */
async function tradingDaysSinceAnnouncement(
  ctx: AnalystContext,
  announcementDate: string,
  asOfDate: string,
): Promise<number | null> {
  const result = await ctx.data.prices(
    ctx.securityId,
    { from: announcementDate, to: asOfDate },
    ctx.asOf,
  )
  if (result.coverage !== "covered") return null
  let count = 0
  for (const bar of result.rows) if (bar.date > announcementDate) count++
  return count
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function abstain(ctx: AnalystContext, id: string, horizonDays: number, reason: string): Signal {
  return {
    analystId: id,
    securityId: ctx.securityId,
    asOf: ctx.asOf,
    conviction: 0,
    horizonDays,
    thesis: reason,
    abstained: true,
  }
}

export function createEarningsDriftAnalyst(config: EarningsDriftConfig = {}): Analyst {
  const cfg = resolveConfig(config)

  return {
    id: cfg.id,
    kind: "quant",
    async predict(ctx: AnalystContext): Promise<Signal> {
      // DataUnavailableError propagates from here — fail loud, never abstain.
      const earnings = await ctx.data.earnings(ctx.securityId, ctx.asOf)
      if (earnings.coverage !== "covered" || earnings.rows.length === 0) {
        return abstain(ctx, cfg.id, cfg.horizonDays, "no earnings coverage")
      }

      const reconciled = reconcileEarnings(earnings.rows)
      const latest = latestByPeriod(reconciled)
      if (!latest) return abstain(ctx, cfg.id, cfg.horizonDays, "no qualifying earnings event")

      // Comparison baseline: a real pre-announcement consensus when we have one;
      // otherwise, for a same-period proxy, the same fiscal quarter's prior-year
      // actual from the PIT-visible history (earnings momentum, not PEAD). Only
      // when neither is available do we abstain.
      let baseline: number | null
      if (latest.epsEstimate !== null) {
        baseline = latest.epsEstimate
      } else if (latest.surpriseQuality === "proxy") {
        baseline = priorYearActual(reconciled, latest.fiscalPeriod)
      } else {
        baseline = null
      }
      if (baseline === null) {
        return abstain(ctx, cfg.id, cfg.horizonDays, "no comparison baseline")
      }
      const denom = Math.max(Math.abs(baseline), cfg.minEstimateDenominator)
      const surprise = (latest.epsActual - baseline) / denom
      if (surprise === 0) {
        return abstain(ctx, cfg.id, cfg.horizonDays, "in-line result (no beat or miss)")
      }

      const announcementDate = latest.knownAt.slice(0, 10)
      const asOfDate = ctx.asOf.slice(0, 10)
      const elapsed = await tradingDaysSinceAnnouncement(ctx, announcementDate, asOfDate)
      if (elapsed === null) {
        return abstain(ctx, cfg.id, cfg.horizonDays, "no prices to assess freshness")
      }
      if (elapsed > cfg.freshnessWindowTradingDays) {
        return abstain(ctx, cfg.id, cfg.horizonDays, "earnings outside freshness window")
      }

      const sign = surprise > 0 ? 1 : -1
      const direction = sign > 0 ? "beat" : "miss"
      let magnitude: number
      let components: Record<string, number>
      if (latest.surpriseQuality === "consensus") {
        magnitude = clamp(Math.abs(surprise) * cfg.surpriseScale, 0, cfg.maxConsensusMagnitude)
        // `consensusSurprise` present ⇒ scaled against a real consensus vintage.
        components = {
          consensusSurprise: surprise,
          magnitude,
          tradingDaysSinceAnnouncement: elapsed,
        }
      } else {
        magnitude = cfg.proxyMagnitude
        // `momentumProxy` present ⇒ same-period proxy: earnings momentum, not PEAD.
        // `baseline` is the value the actual was measured against (a prior-year
        // actual when there was no estimate, else the estimate itself).
        components = {
          momentumProxy: surprise,
          baseline,
          magnitude,
          tradingDaysSinceAnnouncement: elapsed,
        }
      }

      const quality = latest.surpriseQuality === "consensus" ? "consensus surprise" : "momentum proxy"
      return {
        analystId: cfg.id,
        securityId: ctx.securityId,
        asOf: ctx.asOf,
        conviction: sign * magnitude,
        horizonDays: cfg.horizonDays,
        thesis: `${latest.fiscalPeriod} ${direction} (${quality}); drifting ${elapsed} trading day(s) post-announcement`,
        components,
        abstained: false,
      }
    },
  }
}
