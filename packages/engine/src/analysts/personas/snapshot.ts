import type { Currency, FundamentalsSnapshot } from "../../data/types.js"
import {
  bookValuePerShare,
  cagr,
  debtToEquity,
  intrinsicValuePerShare,
  marginOfSafety,
  marginTrend,
  netMargin,
  ownerEarnings,
  type IntrinsicValueOptions,
} from "../../primitives/fundamentals.js"
import { hashContext } from "../../llm/prompt-cache.js"

/**
 * Deterministic rendering of a fundamentals snapshot into a compact text table
 * for an LLM persona (plan 002 phase 2). The output is byte-stable for the same
 * inputs (fixed decimal formatting, no locale, no timestamps), so it is safe as
 * a prompt-cache key input and is pinned by a golden-file test.
 */

export interface RenderFundamentalsInput {
  readonly securityId: string
  readonly currency: Currency
  /** Latest known close (base of the margin-of-safety check). */
  readonly price: number
  /** Snapshots oldest → newest. */
  readonly snapshots: readonly FundamentalsSnapshot[]
  /** Reporting periods per year (quarterly = 4). Default 4. */
  readonly periodsPerYear?: number
  readonly intrinsic?: IntrinsicValueOptions
}

export interface RenderedFundamentals {
  readonly text: string
  readonly contentHash: string
}

function money(value: number): string {
  return value.toFixed(2)
}

function ratio(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(4)
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`
}

function points(value: number): string {
  return `${(value * 100).toFixed(2)}pp`
}

/** Render the deterministic context table and its content hash. */
export function renderFundamentalsContext(input: RenderFundamentalsInput): RenderedFundamentals {
  const periodsPerYear = input.periodsPerYear ?? 4
  const snapshots = input.snapshots
  const oldest = snapshots[0]
  const newest = snapshots[snapshots.length - 1]

  const lines: string[] = []
  lines.push("FUNDAMENTALS SNAPSHOT")
  lines.push(`security: ${input.securityId}`)
  lines.push(`currency: ${input.currency}`)
  lines.push(`price: ${money(input.price)}`)
  lines.push(
    `periods: ${snapshots.length}` +
      (oldest && newest ? ` (${oldest.fiscalPeriod} -> ${newest.fiscalPeriod})` : ""),
  )
  lines.push("")
  lines.push("PER-PERIOD METRICS")
  lines.push("period | revenue | netIncome | netMargin | ownerEarnings | bookValuePerShare | debtToEquity")
  for (const s of snapshots) {
    lines.push(
      [
        s.fiscalPeriod,
        money(s.metrics.revenue),
        money(s.metrics.netIncome),
        pct(netMargin(s)),
        money(ownerEarnings(s)),
        ratio(bookValuePerShare(s)),
        ratio(debtToEquity(s)),
      ].join(" | "),
    )
  }
  lines.push("")
  lines.push("DERIVED")

  const years = snapshots.length > 1 ? (snapshots.length - 1) / periodsPerYear : 0
  const revenueCagr =
    oldest && newest && years > 0
      ? cagr(oldest.metrics.revenue, newest.metrics.revenue, years)
      : null
  lines.push(`revenueCagr(annualized): ${pct(revenueCagr)}`)

  const trend = marginTrend(snapshots)
  lines.push(
    `netMarginTrend: ${trend ? `${trend.direction} (slope ${points(trend.slope)}/period)` : "n/a"}`,
  )

  const bvpsOld = oldest ? bookValuePerShare(oldest) : null
  const bvpsNew = newest ? bookValuePerShare(newest) : null
  const bvGrowth = bvpsOld !== null && bvpsNew !== null && years > 0 ? cagr(bvpsOld, bvpsNew, years) : null
  lines.push(`bookValueGrowth(perShare, annualized): ${pct(bvGrowth)}`)

  const oeLatest = newest ? ownerEarnings(newest) : null
  lines.push(`ownerEarnings(latest): ${oeLatest === null ? "n/a" : money(oeLatest)}`)

  const iv = newest ? intrinsicValuePerShare(newest, input.intrinsic) : null
  lines.push(`intrinsicValuePerShare: ${iv === null ? "n/a" : money(iv)}`)

  const mos = iv === null ? null : marginOfSafety(iv, input.price)
  lines.push(`marginOfSafety: ${pct(mos)}`)

  const text = lines.join("\n")
  return { text, contentHash: hashContext(text) }
}
