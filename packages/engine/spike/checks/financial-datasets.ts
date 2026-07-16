/**
 * Financial Datasets (financialdatasets.ai) check suite — US equities.
 *
 * Base `https://api.financialdatasets.ai`, auth header `X-API-KEY` (applied by
 * the harness). Every check here requires `fd-key`; with no key they all report
 * skipped. Primary probe tickers are AAPL and NVDA because a free key has
 * historically only covered AAPL/NVDA/MSFT/TSLA.
 *
 * The whole point of these checks is to pin down things the upstream docs do
 * NOT state: whether the price series is split-adjusted, whether filing
 * timestamps (not just dates) are populated, whether server-side PIT filters
 * are honored, and whether any estimate carries an as-of/vintage field.
 */

import {
  firstArray,
  httpFailDetail,
  nonNullFraction,
  prop,
  type Check,
  type CheckContext,
  type CheckResult,
} from "../harness.ts"

const PROVIDER = "financial-datasets" as const

interface PricePoint {
  readonly date: string
  readonly close: number
}

/** Pull `{ prices: [...] }` (or any array body) into sorted {date, close}. */
async function fetchDailyCloses(
  ctx: CheckContext,
  ticker: string,
  startDate: string,
  endDate: string,
): Promise<{ points: PricePoint[]; error?: string }> {
  const res = await ctx.get("/prices/", {
    ticker,
    interval: "day",
    start_date: startDate,
    end_date: endDate,
  })
  if (!res.ok || res.json === undefined) return { points: [], error: httpFailDetail(res) }
  const rows = firstArray(res.json) ?? []
  const points: PricePoint[] = []
  for (const row of rows) {
    const rawDate = prop(row, "time") ?? prop(row, "date")
    const close = prop(row, "close")
    if (typeof rawDate === "string" && typeof close === "number") {
      points.push({ date: rawDate.slice(0, 10), close })
    }
  }
  points.sort((a, b) => a.date.localeCompare(b.date))
  return { points }
}

/** Classify a split window as adjusted / raw / ambiguous by the close ratio. */
function classifySplit(
  points: readonly PricePoint[],
  exDate: string,
  ratio: number,
): { verdict: "adjusted" | "raw" | "ambiguous"; before?: PricePoint; after?: PricePoint; observed?: number } {
  const before = [...points].reverse().find((p) => p.date < exDate)
  const after = points.find((p) => p.date >= exDate)
  if (!before || !after || after.close === 0) return { verdict: "ambiguous" }
  const observed = before.close / after.close
  // Adjusted series are continuous (ratio ~1); raw series jump by ~`ratio`.
  if (observed < 1.5) return { verdict: "adjusted", before, after, observed }
  if (observed > ratio * 0.6) return { verdict: "raw", before, after, observed }
  return { verdict: "ambiguous", before, after, observed }
}

const fdPricesAdjustment: Check = {
  id: "fd-prices-adjustment",
  title: "Are daily prices split-adjusted or raw? (undocumented upstream)",
  provider: PROVIDER,
  requires: "fd-key",
  async run(ctx): Promise<CheckResult> {
    const aapl = await fetchDailyCloses(ctx, "AAPL", "2020-08-20", "2020-09-10")
    const nvda = await fetchDailyCloses(ctx, "NVDA", "2024-05-31", "2024-06-20")
    if (aapl.error) return { status: "fail", detail: `AAPL prices: ${aapl.error}` }
    if (nvda.error) return { status: "fail", detail: `NVDA prices: ${nvda.error}` }

    const aaplSplit = classifySplit(aapl.points, "2020-08-31", 4)
    const nvdaSplit = classifySplit(nvda.points, "2024-06-10", 10)
    const verdicts = [aaplSplit.verdict, nvdaSplit.verdict]

    const evidence = {
      aapl_4to1_2020_08_31: {
        before: aaplSplit.before,
        after: aaplSplit.after,
        ratio: aaplSplit.observed,
        verdict: aaplSplit.verdict,
      },
      nvda_10to1_2024_06_10: {
        before: nvdaSplit.before,
        after: nvdaSplit.after,
        ratio: nvdaSplit.observed,
        verdict: nvdaSplit.verdict,
      },
    }

    if (verdicts.includes("ambiguous")) {
      return {
        status: "warn",
        detail:
          "Split adjustment is AMBIGUOUS from the close ratio — inspect the cassettes manually; the series may be partially covered or missing rows around the split.",
        evidence,
      }
    }
    if (verdicts.every((v) => v === "adjusted")) {
      return {
        status: "pass",
        detail:
          "Series is SPLIT-ADJUSTED: no ~4x (AAPL) / ~10x (NVDA) discontinuity across the split ex-date. `close` already back-adjusts; mappers must NOT re-adjust.",
        evidence,
      }
    }
    if (verdicts.every((v) => v === "raw")) {
      return {
        status: "pass",
        detail:
          "Series is RAW (as-traded): a ~4x (AAPL) / ~10x (NVDA) discontinuity IS present at the split ex-date. Mappers must derive adjClose from a split factor themselves.",
        evidence,
      }
    }
    return {
      status: "warn",
      detail: `Mixed signal across the two splits (AAPL=${aaplSplit.verdict}, NVDA=${nvdaSplit.verdict}) — adjustment semantics inconsistent, inspect cassettes.`,
      evidence,
    }
  },
}

const fdFilingDatetime: Check = {
  id: "fd-filing-datetime",
  title: "Do income-statement rows carry filing_date AND filing_datetime?",
  provider: PROVIDER,
  requires: "fd-key",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/financials/income-statements", {
      ticker: "AAPL",
      period: "quarterly",
      limit: 8,
    })
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = firstArray(res.json) ?? []
    if (rows.length === 0) return { status: "warn", detail: "no income-statement rows returned" }

    const dateFrac = nonNullFraction(rows, "filing_date")
    const datetimeFrac = nonNullFraction(rows, "filing_datetime")
    const example = rows.find((r) => prop(r, "filing_date") != null) ?? rows[0]
    const evidence = {
      rows: rows.length,
      filing_date_non_null: `${(dateFrac * 100).toFixed(0)}%`,
      filing_datetime_non_null: `${(datetimeFrac * 100).toFixed(0)}%`,
      example_filing_date: prop(example, "filing_date"),
      example_filing_datetime: prop(example, "filing_datetime"),
    }

    if (dateFrac < 1) {
      return {
        status: "fail",
        detail: `Only ${(dateFrac * 100).toFixed(0)}% of rows have a filing_date — knownAt would be underivable for the rest (fail-loud territory).`,
        evidence,
      }
    }
    if (datetimeFrac < 1) {
      return {
        status: "warn",
        detail: `All rows have filing_date, but filing_datetime is populated on only ${(datetimeFrac * 100).toFixed(0)}% — knownAt falls back to end-of-day coercion where the timestamp is missing.`,
        evidence,
      }
    }
    return {
      status: "pass",
      detail: "Every row carries both filing_date and filing_datetime — timestamp-grade knownAt is available.",
      evidence,
    }
  },
}

const fdPitFilter: Check = {
  id: "fd-pit-filter",
  title: "Is the server-side filing_date_lte PIT filter honored?",
  provider: PROVIDER,
  requires: "fd-key",
  async run(ctx): Promise<CheckResult> {
    const cutoff = "2023-01-01"
    const res = await ctx.get("/financials/income-statements", {
      ticker: "AAPL",
      period: "quarterly",
      limit: 20,
      filing_date_lte: cutoff,
    })
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = firstArray(res.json) ?? []
    const violations = rows
      .map((r) => prop(r, "filing_date"))
      .filter((d): d is string => typeof d === "string" && d > cutoff)
    const maxFilingDate = rows
      .map((r) => prop(r, "filing_date"))
      .filter((d): d is string => typeof d === "string")
      .sort()
      .at(-1)
    const evidence = { cutoff, rows: rows.length, violations: violations.length, max_filing_date: maxFilingDate }

    if (violations.length > 0) {
      return {
        status: "fail",
        detail: `${violations.length} row(s) have filing_date > ${cutoff} — server-side PIT filter is NOT reliable; client-side filtering would be mandatory.`,
        evidence,
      }
    }
    return {
      status: "pass",
      detail: `All ${rows.length} rows respect filing_date <= ${cutoff}; the server-side PIT filter is honored (max filing_date ${maxFilingDate}).`,
      evidence,
    }
  },
}

const fdEarningsEstimates: Check = {
  id: "fd-earnings-estimates",
  title: "Do earnings rows carry estimates, and any estimate-vintage field?",
  provider: PROVIDER,
  requires: "fd-key",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/earnings", { ticker: "AAPL", limit: 40 })
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = firstArray(res.json) ?? []
    if (rows.length === 0) return { status: "warn", detail: "no earnings rows returned" }

    const estFrac = nonNullFraction(rows, "estimated_earnings_per_share")
    const filingDates = rows
      .map((r) => prop(r, "filing_date"))
      .filter((d): d is string => typeof d === "string")
      .sort()
    const sampleKeys = Object.keys((rows[0] as Record<string, unknown>) ?? {})
    // A vintage/as-of field would let us treat the estimate as PIT consensus.
    const vintageHints = sampleKeys.filter((k) =>
      /(as_of|asof|vintage|estimate_date|consensus_date|snapshot|revision)/i.test(k),
    )
    const evidence = {
      rows: rows.length,
      estimated_eps_non_null: `${(estFrac * 100).toFixed(0)}%`,
      earliest_filing_date: filingDates[0],
      latest_filing_date: filingDates.at(-1),
      row_keys: sampleKeys,
      estimate_vintage_fields: vintageHints,
    }
    return {
      status: vintageHints.length > 0 ? "pass" : "warn",
      detail:
        vintageHints.length > 0
          ? `Estimate present on ${(estFrac * 100).toFixed(0)}% of rows AND a candidate vintage field exists (${vintageHints.join(", ")}) — genuine pre-announcement consensus MAY be reconstructable.`
          : `Estimate present on ${(estFrac * 100).toFixed(0)}% of rows but NO estimate as-of/vintage field is exposed — the estimate is "as it stands today", so surprise built from it is lookahead. Use the earnings-momentum fallback, tagged as such.`,
      evidence,
    }
  },
}

const fdDelisted: Check = {
  id: "fd-delisted",
  title: "Are delisted tickers (BBBY) resolvable and price-covered?",
  provider: PROVIDER,
  requires: "fd-key",
  async run(ctx): Promise<CheckResult> {
    const facts = await ctx.get("/company/facts", { ticker: "BBBY" })
    const factsBody = facts.json
    const factsObj =
      factsBody && typeof factsBody === "object"
        ? ((prop(factsBody, "company_facts") ?? factsBody) as Record<string, unknown>)
        : undefined
    const isActive = factsObj ? prop(factsObj, "is_active") : undefined

    const prices = await fetchDailyCloses(ctx, "BBBY", "2022-01-01", "2022-12-31")
    const evidence = {
      facts_status: facts.status,
      is_active: isActive,
      price_rows_2022: prices.points.length,
      price_error: prices.error,
    }

    if (!facts.ok) {
      return {
        status: "warn",
        detail: `company/facts for BBBY returned ${httpFailDetail(facts)} — delisted-symbol metadata may not be served.`,
        evidence,
      }
    }
    const covered = prices.points.length > 0
    return {
      status: "pass",
      detail: `BBBY resolves (is_active=${String(isActive)}); 2022 daily prices are ${covered ? `COVERED (${prices.points.length} rows)` : "NOT covered (0 rows)"}. Delisted handling: ${covered ? "history retained after delisting" : "prices drop out — treat as not-covered, not covered-empty"}.`,
      evidence,
    }
  },
}

const fdHistoryDepth: Check = {
  id: "fd-history-depth",
  title: "How deep is history on this tier (1990s prices, 2000s filings)?",
  provider: PROVIDER,
  requires: "fd-key",
  async run(ctx): Promise<CheckResult> {
    const prices = await fetchDailyCloses(ctx, "AAPL", "1995-01-01", "1995-12-31")
    const filings = await ctx.get("/financials/income-statements", {
      ticker: "AAPL",
      period: "quarterly",
      limit: 40,
      filing_date_lte: "2005-01-01",
    })
    const filingRows = filings.json !== undefined ? (firstArray(filings.json) ?? []) : []
    const oldestFiling = filingRows
      .map((r) => prop(r, "filing_date"))
      .filter((d): d is string => typeof d === "string")
      .sort()[0]
    const evidence = {
      aapl_1995_price_rows: prices.points.length,
      earliest_1995_price: prices.points[0]?.date,
      pre_2005_filing_rows: filingRows.length,
      earliest_pre_2005_filing: oldestFiling,
    }
    const deep = prices.points.length > 0 && filingRows.length > 0
    return {
      status: "pass",
      detail: deep
        ? `Deep history served: ${prices.points.length} AAPL price rows in 1995 and ${filingRows.length} pre-2005 filings (earliest ${oldestFiling}).`
        : `Shallow history: 1995 price rows=${prices.points.length}, pre-2005 filing rows=${filingRows.length}. Tier appears limited to recent years — a backtest-depth constraint.`,
      evidence,
    }
  },
}

const fdRateLimitHeaders: Check = {
  id: "fd-rate-limit-headers",
  title: "Does the API expose any rate-limit / retry headers?",
  provider: PROVIDER,
  requires: "fd-key",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/company/facts", { ticker: "AAPL" })
    const found = Object.entries(res.headers).filter(([key]) =>
      /(ratelimit|rate-limit|retry|x-quota|remaining)/i.test(key),
    )
    const evidence = {
      status: res.status,
      rate_limit_headers: Object.fromEntries(found),
      all_header_names: Object.keys(res.headers),
    }
    return {
      status: "pass",
      detail:
        found.length > 0
          ? `Rate-limit headers ARE present: ${found.map(([k]) => k).join(", ")} — a client can self-throttle from them.`
          : "No rate-limit/retry headers exposed (as expected upstream). The client must throttle blind and treat 429 as fail-loud.",
      evidence,
    }
  },
}

export const financialDatasetsChecks: readonly Check[] = [
  fdPricesAdjustment,
  fdFilingDatetime,
  fdPitFilter,
  fdEarningsEstimates,
  fdDelisted,
  fdHistoryDepth,
  fdRateLimitHeaders,
]
