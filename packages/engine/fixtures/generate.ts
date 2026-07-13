/**
 * Deterministic synthetic fixture generator (plan 003, public tier).
 *
 * Run with:  pnpm --filter @workspace/engine generate-fixtures
 * (executes under Node's `--experimental-strip-types`, so this file uses only
 * type-only imports and has zero runtime dependencies).
 *
 * Everything is driven by a seeded PRNG — NEVER `Math.random` unseeded — so the
 * committed `fixtures/dataset.json` is reproducible and reviewable like code.
 * The scripted edge cases: a US (XNAS/USD) and an Oslo (XOSL/NOK) exchange with
 * DIFFERING holiday calendars, a NOKUSD FX series over the union calendar, a
 * 2:1 split, a dividend, a micro-cap with missing estimates and no insider
 * trades (covered-empty), a late after-close filing, date-only filings (visible
 * next trading day), and a poisoned securityId that simulates transport failure.
 */

import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type {
  CorporateActionEvent,
  Currency,
  EarningsEvent,
  FundamentalsSnapshot,
  FxRate,
  InsiderTrade,
  Mic,
  NewsItem,
  Price,
} from "../src/index.js"
import type { FixtureDataset, FixtureSecurity } from "../src/data/fixture/dataset.js"

const SEED = 20200104
const FROM = "2020-01-01"
const TO = "2020-12-31"
const FX_PAIR = "NOKUSD"

const IDS = {
  usEquity: "US-XNAS-SYNA",
  osloEquity: "NO-XOSL-OSYN",
  osloMicroCap: "NO-XOSL-MICR",
  poison: "US-XNAS-POIS",
} as const

// --- seeded PRNG (mulberry32) -------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)

/** Zero-mean-ish jitter in [-scale, +scale). */
function jitter(scale: number): number {
  return (rand() * 2 - 1) * scale
}

function round(value: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

// --- calendars ----------------------------------------------------------------

function eachDay(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  const start = new Date(`${fromIso}T00:00:00Z`).getTime()
  const end = new Date(`${toIso}T00:00:00Z`).getTime()
  for (let t = start; t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

// NYSE/Nasdaq 2020 holidays.
const US_HOLIDAYS = new Set([
  "2020-01-01",
  "2020-01-20",
  "2020-02-17",
  "2020-04-10",
  "2020-05-25",
  "2020-07-03",
  "2020-09-07",
  "2020-11-26",
  "2020-12-25",
])

// Oslo Børs 2020 holidays (deliberately different from the US set).
const OSLO_HOLIDAYS = new Set([
  "2020-01-01",
  "2020-04-09",
  "2020-04-10",
  "2020-04-13",
  "2020-05-01",
  "2020-05-21",
  "2020-06-01",
  "2020-12-24",
  "2020-12-25",
  "2020-12-31",
])

function buildCalendar(holidays: ReadonlySet<string>): string[] {
  return eachDay(FROM, TO).filter((d) => {
    const dow = dayOfWeek(d)
    return dow !== 0 && dow !== 6 && !holidays.has(d)
  })
}

const CALENDARS: Record<Mic, string[]> = {
  XNAS: buildCalendar(US_HOLIDAYS),
  XNYS: buildCalendar(US_HOLIDAYS),
  XOSL: buildCalendar(OSLO_HOLIDAYS),
}

function unionCalendar(): string[] {
  const set = new Set<string>([...CALENDARS.XNAS, ...CALENDARS.XOSL])
  return [...set].sort()
}

/** First trading day on/after `target` on `cal`. */
function snapToTradingDay(cal: readonly string[], target: string): string {
  for (const d of cal) {
    if (d >= target) return d
  }
  const last = cal[cal.length - 1]
  if (!last) throw new Error("empty calendar")
  return last
}

// --- price series -------------------------------------------------------------

interface EquitySpec {
  readonly securityId: string
  readonly symbol: string
  readonly mic: Mic
  readonly currency: Currency
  readonly startPrice: number
  readonly drift: number
  readonly vol: number
  /** Ex-date of a 2:1 split, if any. */
  readonly splitExDate?: string
}

function buildPrices(spec: EquitySpec): Price[] {
  const cal = CALENDARS[spec.mic]
  const rows: Price[] = []
  let price = spec.startPrice
  for (const date of cal) {
    // On the split ex-date the RAW price drops by the split ratio (a 2:1 halves
    // the tape price); the random walk then continues from the reduced level.
    // This consumes no PRNG draws, so other series stay byte-identical.
    if (spec.splitExDate !== undefined && date === spec.splitExDate) {
      price = price / 2
    }
    price = Math.max(1, price * (1 + spec.drift + jitter(spec.vol)))
    const preSplit = spec.splitExDate !== undefined && date < spec.splitExDate
    const adjustmentFactor = preSplit ? 0.5 : 1
    rows.push({
      securityId: spec.securityId,
      date,
      knownAt: `${date}T21:00:00Z`,
      close: round(price, 4),
      adjClose: round(price * adjustmentFactor, 4),
      adjustmentFactor,
      currency: spec.currency,
      volume: Math.round(500_000 + rand() * 2_000_000),
    })
  }
  return rows
}

// --- fundamentals -------------------------------------------------------------

interface FilingSpec {
  readonly fiscalPeriod: string
  readonly target: string
  /** Date-only knownAt (visible next trading day) vs a full after-close instant. */
  readonly dateOnly: boolean
}

const FILINGS: FilingSpec[] = [
  { fiscalPeriod: "2019-Q4", target: "2020-02-12", dateOnly: true },
  // The scripted "late after-close filing": a full instant after the US close.
  { fiscalPeriod: "2020-Q1", target: "2020-05-12", dateOnly: false },
  { fiscalPeriod: "2020-Q2", target: "2020-08-11", dateOnly: true },
]

function buildFundamentals(spec: EquitySpec): FundamentalsSnapshot[] {
  const cal = CALENDARS[spec.mic]
  return FILINGS.map((filing, i) => {
    const day = snapToTradingDay(cal, filing.target)
    const scale = spec.startPrice * 1_000_000
    return {
      securityId: spec.securityId,
      fiscalPeriod: filing.fiscalPeriod,
      knownAt: filing.dateOnly ? day : `${day}T21:30:00Z`,
      currency: spec.currency,
      metrics: {
        revenue: round(scale * (1 + 0.05 * i + jitter(0.03)), 2),
        netIncome: round(scale * (0.12 + 0.01 * i + jitter(0.02)), 2),
        totalEquity: round(scale * (2 + jitter(0.1)), 2),
        totalDebt: round(scale * (0.8 + jitter(0.1)), 2),
        sharesOutstanding: Math.round(50_000_000 + rand() * 10_000_000),
        operatingCashFlow: round(scale * (0.18 + jitter(0.02)), 2),
        capitalExpenditure: round(scale * (0.06 + jitter(0.01)), 2),
      },
    }
  })
}

// --- earnings -----------------------------------------------------------------

function buildEarnings(spec: EquitySpec, hasConsensus: boolean): EarningsEvent[] {
  const cal = CALENDARS[spec.mic]
  return FILINGS.map((filing) => {
    const day = snapToTradingDay(cal, filing.target)
    const actual = round(1 + jitter(0.4), 2)
    return {
      securityId: spec.securityId,
      fiscalPeriod: filing.fiscalPeriod,
      knownAt: `${day}T20:00:00Z`,
      currency: spec.currency,
      epsActual: actual,
      epsEstimate: hasConsensus ? round(actual - jitter(0.15), 2) : null,
      surpriseQuality: hasConsensus ? "consensus" : "proxy",
    }
  })
}

// --- corporate actions --------------------------------------------------------

function buildNews(spec: EquitySpec): NewsItem[] {
  const cal = CALENDARS[spec.mic]
  const d1 = snapToTradingDay(cal, "2020-03-02")
  const d2 = snapToTradingDay(cal, "2020-09-15")
  return [
    {
      securityId: spec.securityId,
      knownAt: `${d1}T13:00:00Z`,
      headline: `${spec.symbol} announces product update`,
      source: "synthetic-wire",
      url: null,
    },
    {
      securityId: spec.securityId,
      knownAt: `${d2}T15:30:00Z`,
      headline: `${spec.symbol} names new CFO`,
      source: "synthetic-wire",
      url: null,
    },
  ]
}

// --- assembly -----------------------------------------------------------------

const US: EquitySpec = {
  securityId: IDS.usEquity,
  symbol: "SYNA",
  mic: "XNAS",
  currency: "USD",
  startPrice: 100,
  drift: 0.0004,
  vol: 0.015,
  splitExDate: snapToTradingDay(CALENDARS.XNAS, "2020-06-15"),
}

const OSLO: EquitySpec = {
  securityId: IDS.osloEquity,
  symbol: "OSYN",
  mic: "XOSL",
  currency: "NOK",
  startPrice: 180,
  drift: 0.0003,
  vol: 0.018,
}

const MICRO: EquitySpec = {
  securityId: IDS.osloMicroCap,
  symbol: "MICR",
  mic: "XOSL",
  currency: "NOK",
  startPrice: 12,
  drift: -0.0002,
  vol: 0.03,
}

const securities: FixtureSecurity[] = [
  { securityId: US.securityId, symbol: US.symbol, mic: US.mic, currency: US.currency },
  { securityId: OSLO.securityId, symbol: OSLO.symbol, mic: OSLO.mic, currency: OSLO.currency },
  { securityId: MICRO.securityId, symbol: MICRO.symbol, mic: MICRO.mic, currency: MICRO.currency },
]

const corporateActions: Record<string, CorporateActionEvent[]> = {
  [US.securityId]: [
    {
      securityId: US.securityId,
      knownAt: "2020-05-20T12:00:00Z",
      exDate: snapToTradingDay(CALENDARS.XNAS, "2020-06-15"),
      type: "split",
      splitRatio: 2,
      dividendAmount: null,
      currency: "USD",
    },
  ],
  [OSLO.securityId]: [
    {
      securityId: OSLO.securityId,
      knownAt: "2020-04-20T12:00:00Z",
      exDate: snapToTradingDay(CALENDARS.XOSL, "2020-05-06"),
      type: "dividend",
      splitRatio: null,
      dividendAmount: 5.5,
      currency: "NOK",
    },
  ],
  [MICRO.securityId]: [],
}

const insiderTrades: Record<string, InsiderTrade[]> = {
  [US.securityId]: [
    {
      securityId: US.securityId,
      knownAt: "2020-03-11T22:00:00Z",
      insiderName: "A. Director",
      side: "buy",
      shares: 2000,
      price: round(95 + jitter(5), 2),
      currency: "USD",
    },
    {
      securityId: US.securityId,
      knownAt: "2020-10-06T22:00:00Z",
      insiderName: "B. Officer",
      side: "sell",
      shares: 1500,
      price: round(110 + jitter(6), 2),
      currency: "USD",
    },
  ],
  [OSLO.securityId]: [
    {
      securityId: OSLO.securityId,
      knownAt: "2020-07-02T16:00:00Z",
      insiderName: "C. Styremedlem",
      side: "buy",
      shares: 5000,
      price: round(185 + jitter(8), 2),
      currency: "NOK",
    },
  ],
  // Micro-cap genuinely has no insider trades: covered-empty, not not-covered.
  [MICRO.securityId]: [],
}

function buildFx(): FxRate[] {
  let rate = 0.106
  return unionCalendar().map((date) => {
    rate = Math.max(0.08, rate * (1 + jitter(0.004)))
    return {
      pair: FX_PAIR,
      date,
      knownAt: `${date}T12:00:00Z`,
      rate: round(rate, 6),
    }
  })
}

const dataset: FixtureDataset = {
  meta: { seed: SEED, from: FROM, to: TO },
  securities,
  poison: [IDS.poison],
  calendars: {
    XNAS: CALENDARS.XNAS,
    XOSL: CALENDARS.XOSL,
  },
  prices: {
    [US.securityId]: buildPrices(US),
    [OSLO.securityId]: buildPrices(OSLO),
    [MICRO.securityId]: buildPrices(MICRO),
  },
  fundamentals: {
    [US.securityId]: buildFundamentals(US),
    [OSLO.securityId]: buildFundamentals(OSLO),
    [MICRO.securityId]: buildFundamentals(MICRO),
  },
  earnings: {
    [US.securityId]: buildEarnings(US, true),
    [OSLO.securityId]: buildEarnings(OSLO, true),
    [MICRO.securityId]: buildEarnings(MICRO, false),
  },
  news: {
    [US.securityId]: buildNews(US),
    [OSLO.securityId]: buildNews(OSLO),
    [MICRO.securityId]: buildNews(MICRO),
  },
  insiderTrades,
  corporateActions,
  fx: { [FX_PAIR]: buildFx() },
}

const outUrl = new URL("./dataset.json", import.meta.url)
writeFileSync(fileURLToPath(outUrl), `${JSON.stringify(dataset, null, 2)}\n`, "utf8")
console.log(
  `Wrote ${fileURLToPath(outUrl)} — ${securities.length} securities, ` +
    `${dataset.fx[FX_PAIR]?.length ?? 0} FX days.`,
)
