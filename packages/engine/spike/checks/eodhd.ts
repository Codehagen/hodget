/**
 * EODHD (eodhd.com) check suite — Oslo Børs + international + FX.
 *
 * Base `https://eodhd.com/api`, `?api_token=&fmt=json` (applied by the harness).
 *
 * Two requirement tiers:
 *  - `eodhd-demo` (checks 8-11) run TODAY with the public `demo` token, which
 *    only covers AAPL.US, TSLA.US, VTI.US, AMZN.US, BTC-USD.CC, EURUSD.FOREX.
 *  - `eodhd-key` (checks 12-17) need a real key and are skipped without one;
 *    they cover Oslo Børs, NOK FX, and fundamentals — including THE LINCHPIN,
 *    whether Oslo quarterly fundamentals carry a usable filing_date.
 */

import {
  firstArray,
  httpFailDetail,
  prop,
  type Check,
  type CheckContext,
  type CheckResult,
  type HttpResult,
} from "../harness.ts"

const PROVIDER = "eodhd" as const

interface EodRow {
  readonly date: string
  readonly close: number | null
  readonly adjusted_close: number | null
}

function toEodRows(body: unknown): EodRow[] {
  const rows = firstArray(body) ?? []
  const out: EodRow[] = []
  for (const row of rows) {
    const date = prop(row, "date")
    if (typeof date !== "string") continue
    const close = prop(row, "close")
    const adj = prop(row, "adjusted_close")
    out.push({
      date,
      close: typeof close === "number" ? close : null,
      adjusted_close: typeof adj === "number" ? adj : null,
    })
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return out
}

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

const eodhdAdjustedClose: Check = {
  id: "eodhd-adjusted-close",
  title: "Does adjusted_close behave as documented across a split? (AAPL.US)",
  provider: PROVIDER,
  requires: "eodhd-demo",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/eod/AAPL.US", { from: "2020-08-20", to: "2020-09-10" })
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = toEodRows(res.json)
    if (rows.length === 0) return { status: "warn", detail: "no EOD rows returned for AAPL.US" }

    // AAPL 4:1 split ex-date 2020-08-31.
    const before = [...rows].reverse().find((r) => r.date < "2020-08-31")
    const after = rows.find((r) => r.date >= "2020-08-31")
    const window = rows.filter((r) => r.date >= "2020-08-27" && r.date <= "2020-09-02")

    const rawRatio =
      before?.close && after?.close && after.close !== 0 ? before.close / after.close : null
    const adjRatio =
      before?.adjusted_close && after?.adjusted_close && after.adjusted_close !== 0
        ? before.adjusted_close / after.adjusted_close
        : null

    const evidence = {
      window,
      raw_close_ratio_across_split: rawRatio,
      adjusted_close_ratio_across_split: adjRatio,
    }

    const rawJumps = rawRatio !== null && rawRatio > 2.5
    const adjContinuous = adjRatio !== null && adjRatio < 1.5
    if (rawJumps && adjContinuous) {
      return {
        status: "pass",
        detail:
          "As documented: `close` shows the ~4x split discontinuity (raw/as-traded) while `adjusted_close` is continuous. Mappers feed adjClose from `adjusted_close`, close from `close`.",
        evidence,
      }
    }
    return {
      status: "warn",
      detail: `Unexpected: raw close ratio=${rawRatio?.toFixed(2)} (expected ~4), adjusted_close ratio=${adjRatio?.toFixed(2)} (expected ~1). Inspect cassette before trusting the adjustment convention.`,
      evidence,
    }
  },
}

const eodhdSplitsDividends: Check = {
  id: "eodhd-splits-dividends",
  title: "Split + dividend endpoints: fields and extended dividend metadata",
  provider: PROVIDER,
  requires: "eodhd-demo",
  async run(ctx): Promise<CheckResult> {
    const splits = await ctx.get("/splits/AAPL.US")
    const divs = await ctx.get("/div/AAPL.US", { from: "2020-01-01" })
    if (!splits.ok || splits.json === undefined) return { status: "fail", detail: `splits: ${httpFailDetail(splits)}` }
    if (!divs.ok || divs.json === undefined) return { status: "fail", detail: `dividends: ${httpFailDetail(divs)}` }

    const splitRows = firstArray(splits.json) ?? []
    const divRows = firstArray(divs.json) ?? []
    const splitSample = splitRows[0]
    const divSample = divRows[0]
    const divKeys = divSample ? Object.keys(divSample as Record<string, unknown>) : []
    const extendedFields = ["declarationDate", "recordDate", "paymentDate", "currency", "unadjustedValue"]
    const presentExtended = extendedFields.filter((f) => divKeys.includes(f))

    const splitHasDateAndRatio =
      splitSample != null && prop(splitSample, "date") != null && prop(splitSample, "split") != null
    const divHasDateAndValue =
      divSample != null && prop(divSample, "date") != null && prop(divSample, "value") != null

    const evidence = {
      split_rows: splitRows.length,
      split_sample: splitSample,
      dividend_rows: divRows.length,
      dividend_sample: divSample,
      extended_dividend_fields_present: presentExtended,
    }
    return {
      status: splitHasDateAndRatio && divHasDateAndValue ? "pass" : "warn",
      detail: `Splits carry date+split ratio (${splitHasDateAndRatio ? "yes" : "MISSING"}); dividends carry date+value (${divHasDateAndValue ? "yes" : "MISSING"}). Extended dividend fields present: ${presentExtended.length ? presentExtended.join(", ") : "none"}.`,
      evidence,
    }
  },
}

const eodhdFx: Check = {
  id: "eodhd-fx",
  title: "FX daily series with weekend gaps (EURUSD.FOREX)",
  provider: PROVIDER,
  requires: "eodhd-demo",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/eod/EURUSD.FOREX", { from: "2024-01-01", to: "2024-01-31" })
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = toEodRows(res.json)
    if (rows.length === 0) return { status: "warn", detail: "no FX rows returned for EURUSD.FOREX" }

    const weekendRows = rows.filter((r) => dayOfWeek(r.date) === 0 || dayOfWeek(r.date) === 6)
    const evidence = {
      rows: rows.length,
      first: rows[0]?.date,
      last: rows.at(-1)?.date,
      weekend_rows: weekendRows.map((r) => r.date),
      sample_close: rows[0]?.close,
    }
    return {
      status: "pass",
      detail: `EURUSD.FOREX served ${rows.length} daily rows over Jan 2024 with ${weekendRows.length === 0 ? "no weekend rows (weekday-only, as expected)" : `${weekendRows.length} weekend row(s) present`}. FX coverage confirmed for the fxRate() method.`,
      evidence,
    }
  },
}

const eodhdRateLimitHeaders: Check = {
  id: "eodhd-rate-limit-headers",
  title: "Capture X-RateLimit-* headers",
  provider: PROVIDER,
  requires: "eodhd-demo",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/eod/AAPL.US", { from: "2020-08-20", to: "2020-08-25" })
    const found = Object.entries(res.headers).filter(([key]) => /(ratelimit|rate-limit|retry)/i.test(key))
    const evidence = {
      status: res.status,
      rate_limit_headers: Object.fromEntries(found),
    }
    return {
      status: found.length > 0 ? "pass" : "warn",
      detail:
        found.length > 0
          ? `Rate-limit headers present: ${found.map(([k, v]) => `${k}=${v}`).join(", ")} — the client can self-throttle and read remaining quota.`
          : "No X-RateLimit-* headers seen on this response (demo tier may omit them). The client should still cap at 1000 req/min defensively.",
      evidence,
    }
  },
}

// --- paid-key checks (Oslo Børs) ---------------------------------------------

const eodhdOsloPrices: Check = {
  id: "eodhd-oslo-prices",
  title: "Oslo Børs price depth, NOK sanity, adjusted_close (EQNR.OL)",
  provider: PROVIDER,
  requires: "eodhd-key",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/eod/EQNR.OL")
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = toEodRows(res.json)
    if (rows.length === 0) return { status: "warn", detail: "no EOD rows returned for EQNR.OL" }

    const last = rows.at(-1)
    const nokRange = last?.close != null && last.close > 50 && last.close < 1000
    const hasAdj = rows.every((r) => r.adjusted_close != null)
    const evidence = {
      earliest_date: rows[0]?.date,
      latest_date: last?.date,
      rows: rows.length,
      latest_close_nok: last?.close,
      adjusted_close_on_all_rows: hasAdj,
    }
    return {
      status: nokRange && hasAdj ? "pass" : "warn",
      detail: `EQNR.OL history back to ${rows[0]?.date} (${rows.length} rows); latest close ${last?.close} ${nokRange ? "in plausible NOK range" : "OUTSIDE expected NOK range — check currency"}; adjusted_close present on all rows: ${hasAdj}.`,
      evidence,
    }
  },
}

const eodhdNokFx: Check = {
  id: "eodhd-nok-fx",
  title: "NOKUSD FX daily coverage",
  provider: PROVIDER,
  requires: "eodhd-key",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/eod/NOKUSD.FOREX", { from: "2024-01-01", to: "2024-03-31" })
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = toEodRows(res.json)
    const weekdayRows = rows.filter((r) => dayOfWeek(r.date) !== 0 && dayOfWeek(r.date) !== 6)
    const evidence = {
      rows: rows.length,
      first: rows[0]?.date,
      last: rows.at(-1)?.date,
      sample_rate: rows[0]?.close,
    }
    return {
      status: rows.length > 40 ? "pass" : "warn",
      detail: `NOKUSD.FOREX served ${rows.length} rows over Q1 2024 (${weekdayRows.length} weekdays) — ${rows.length > 40 ? "daily coverage confirmed" : "sparse, verify before relying on it"}. Needed to value the NOK book in USD.`,
      evidence,
    }
  },
}

interface FundamentalsProbe {
  readonly path: string
  readonly res: HttpResult
}

/** Try v1.1 fundamentals first; fall back to the legacy path on 404. */
async function probeFundamentals(
  ctx: CheckContext,
  ticker: string,
  filter: string,
): Promise<FundamentalsProbe> {
  const v11 = await ctx.get(`/v1.1/fundamentals/${ticker}`, { filter })
  if (v11.status !== 404) return { path: "/v1.1/fundamentals", res: v11 }
  const legacy = await ctx.get(`/fundamentals/${ticker}`, { filter })
  return { path: "/fundamentals", res: legacy }
}

/** Quarterly income-statement filter returns an object keyed by period date. */
function objectRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
  if (body && typeof body === "object") {
    return Object.values(body).filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
  }
  return []
}

const eodhdOsloFilingDate: Check = {
  id: "eodhd-oslo-filing-date",
  title: "THE LINCHPIN: do Oslo quarterly fundamentals carry filing_date?",
  provider: PROVIDER,
  requires: "eodhd-key",
  async run(ctx): Promise<CheckResult> {
    const tickers = ["EQNR.OL", "DNB.OL", "KOG.OL"]
    const perTicker: Record<string, unknown> = {}
    let worstFraction = 1
    let anyFailure = false

    for (const ticker of tickers) {
      const probe = await probeFundamentals(ctx, ticker, "Financials::Income_Statement::quarterly")
      if (!probe.res.ok || probe.res.json === undefined) {
        anyFailure = true
        perTicker[ticker] = { error: httpFailDetail(probe.res), path: probe.path }
        continue
      }
      const rows = objectRows(probe.res.json)
      const withFilingDate = rows.filter((r) => prop(r, "filing_date") != null)
      const fraction = rows.length === 0 ? 0 : withFilingDate.length / rows.length
      worstFraction = Math.min(worstFraction, fraction)
      const dates = rows
        .map((r) => prop(r, "date"))
        .filter((d): d is string => typeof d === "string")
        .sort()
      perTicker[ticker] = {
        path: probe.path,
        quarters: rows.length,
        filing_date_fraction: `${(fraction * 100).toFixed(0)}%`,
        earliest_quarter: dates[0],
        latest_quarter: dates.at(-1),
        example_filing_date: prop(withFilingDate[0], "filing_date"),
      }
    }

    if (anyFailure && worstFraction === 1) {
      return { status: "fail", detail: "fundamentals request failed for at least one Oslo ticker", evidence: perTicker }
    }
    const pass = worstFraction >= 0.9
    return {
      status: pass ? "pass" : "fail",
      detail: pass
        ? `filing_date is populated on >=90% of recent quarterly rows for all probed Oslo tickers — PIT knownAt is derivable directly. Oslo fundamentals clear the bar.`
        : `filing_date is populated on only ${(worstFraction * 100).toFixed(0)}% of quarterly rows for the weakest Oslo ticker — PIT knownAt is NOT reliably derivable. This is a strategy-shaping gap (fall back to period-date + EOD coercion, tagged lower-confidence).`,
      evidence: perTicker,
    }
  },
}

const eodhdOsloEarnings: Check = {
  id: "eodhd-oslo-earnings",
  title: "Oslo earnings history: epsActual coverage and analyst estimates",
  provider: PROVIDER,
  requires: "eodhd-key",
  async run(ctx): Promise<CheckResult> {
    const probe = await probeFundamentals(ctx, "EQNR.OL", "Earnings::History")
    if (!probe.res.ok || probe.res.json === undefined) {
      return { status: "fail", detail: httpFailDetail(probe.res) }
    }
    const rows = objectRows(probe.res.json)
    if (rows.length === 0) return { status: "warn", detail: "no Earnings::History rows for EQNR.OL", evidence: { path: probe.path } }

    const withActual = rows.filter((r) => prop(r, "epsActual") != null)
    const withEstimate = rows.filter((r) => prop(r, "epsEstimate") != null)
    const actualFrac = withActual.length / rows.length
    const estimateFrac = withEstimate.length / rows.length
    const evidence = {
      path: probe.path,
      rows: rows.length,
      epsActual_fraction: `${(actualFrac * 100).toFixed(0)}%`,
      epsEstimate_fraction: `${(estimateFrac * 100).toFixed(0)}%`,
      sample_row: rows[0],
    }
    return {
      status: actualFrac >= 0.8 ? "pass" : "warn",
      detail: `EQNR.OL Earnings::History: ${(actualFrac * 100).toFixed(0)}% of rows have epsActual, ${(estimateFrac * 100).toFixed(0)}% have epsEstimate. Analyst-estimate coverage for OSE is ${estimateFrac >= 0.5 ? "broad" : "thin — reinforces the momentum-not-surprise fallback for Oslo"}.`,
      evidence,
    }
  },
}

const eodhdOsloSymbolList: Check = {
  id: "eodhd-oslo-symbol-list",
  title: "Oslo Børs symbol list completeness",
  provider: PROVIDER,
  requires: "eodhd-key",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/exchange-symbol-list/OL")
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = firstArray(res.json) ?? []
    const codes = new Set(
      rows.map((r) => prop(r, "Code")).filter((c): c is string => typeof c === "string"),
    )
    const expected = ["EQNR", "DNB", "NHY", "KOG"]
    const missing = expected.filter((c) => !codes.has(c))
    const evidence = { rows: rows.length, expected_present: expected.filter((c) => codes.has(c)), missing }
    return {
      status: missing.length === 0 && rows.length > 100 ? "pass" : "warn",
      detail: `exchange-symbol-list/OL returned ${rows.length} symbols; ${missing.length === 0 ? "all bellwethers (EQNR/DNB/NHY/KOG) present" : `MISSING: ${missing.join(", ")}`}. Enough to build the Oslo universe.`,
      evidence,
    }
  },
}

const eodhdOsloNews: Check = {
  id: "eodhd-oslo-news",
  title: "News coverage depth for Oslo tickers (EQNR.OL)",
  provider: PROVIDER,
  requires: "eodhd-key",
  async run(ctx): Promise<CheckResult> {
    const res = await ctx.get("/news", { s: "EQNR.OL", from: "2025-01-01", limit: 20 })
    if (!res.ok || res.json === undefined) return { status: "fail", detail: httpFailDetail(res) }
    const rows = firstArray(res.json) ?? []
    const sample = rows[0]
    const evidence = {
      articles: rows.length,
      first_title: sample ? prop(sample, "title") : undefined,
      first_date: sample ? prop(sample, "date") : undefined,
    }
    return {
      status: rows.length > 0 ? "pass" : "warn",
      detail: `News returned ${rows.length} article(s) for EQNR.OL since 2025-01-01. OSE news coverage is ${rows.length >= 10 ? "usable" : "thin — a signal-quality caveat for Oslo tickers"}.`,
      evidence,
    }
  },
}

export const eodhdChecks: readonly Check[] = [
  eodhdAdjustedClose,
  eodhdSplitsDividends,
  eodhdFx,
  eodhdRateLimitHeaders,
  eodhdOsloPrices,
  eodhdNokFx,
  eodhdOsloFilingDate,
  eodhdOsloEarnings,
  eodhdOsloSymbolList,
  eodhdOsloNews,
]
