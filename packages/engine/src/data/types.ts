import { z } from "zod"

/**
 * Normalized market-data row schemas (zod). Nothing outside `data/providers/`
 * knows which vendor served a row; every row lands in one of these shapes.
 *
 * Every row carries a `knownAt` — the filing/announcement/publication time that
 * the point-in-time contract filters on. `knownAt` is intentionally a loose
 * string here: the PIT wrapper decides whether it is a usable timestamp (a
 * full instant, or a date coerced to exchange end-of-day) and throws a
 * DataQualityError otherwise, rather than a raw schema rejection.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
const knownAt = z.string().min(1)
const finite = z.number().refine(Number.isFinite, "must be a finite number")
const positive = finite.refine((n) => n > 0, "must be positive")
const wholeShares = z.number().int().nonnegative()

export const currencySchema = z.enum(["USD", "NOK"])
export type Currency = z.infer<typeof currencySchema>

export const priceSchema = z.object({
  securityId: z.string().min(1),
  date: isoDate,
  knownAt,
  close: finite,
  /** Split/dividend-adjusted close — used ONLY in return analytics, never accounting. */
  adjClose: finite,
  /** Cumulative adjustment factor mapping raw close → adjClose. */
  adjustmentFactor: positive,
  currency: currencySchema,
  volume: finite.nonnegative().optional(),
})
export type Price = z.infer<typeof priceSchema>

export const fundamentalsSnapshotSchema = z.object({
  securityId: z.string().min(1),
  /** e.g. "2020-Q1" — the reporting period, not the filing time. */
  fiscalPeriod: z.string().min(1),
  knownAt,
  currency: currencySchema,
  metrics: z.object({
    revenue: finite,
    netIncome: finite,
    totalEquity: finite,
    totalDebt: finite,
    sharesOutstanding: positive,
    operatingCashFlow: finite,
    capitalExpenditure: finite,
  }),
})
export type FundamentalsSnapshot = z.infer<typeof fundamentalsSnapshotSchema>

/**
 * `surpriseQuality` tags whether the surprise was computed against a real
 * pre-announcement consensus vintage (`consensus`) or a same-quarter-last-year
 * proxy (`proxy` — earnings momentum, not PEAD). Never conflate the two.
 */
export const earningsEventSchema = z.object({
  securityId: z.string().min(1),
  fiscalPeriod: z.string().min(1),
  /** The announcement instant — the PIT anchor. */
  knownAt,
  currency: currencySchema,
  epsActual: finite,
  epsEstimate: finite.nullable(),
  surpriseQuality: z.enum(["consensus", "proxy"]),
})
export type EarningsEvent = z.infer<typeof earningsEventSchema>

export const insiderTradeSchema = z.object({
  securityId: z.string().min(1),
  knownAt,
  insiderName: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  shares: wholeShares,
  price: positive,
  currency: currencySchema,
})
export type InsiderTrade = z.infer<typeof insiderTradeSchema>

export const newsItemSchema = z.object({
  securityId: z.string().min(1),
  knownAt,
  headline: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url().nullable(),
})
export type NewsItem = z.infer<typeof newsItemSchema>

/**
 * Corporate actions are applied to the book on raw prices (split mutates share
 * count, dividend credits cash on ex-date); adjusted series are only for
 * analytics (plan 002).
 */
export const corporateActionEventSchema = z.object({
  securityId: z.string().min(1),
  /** Announcement instant — when the action became known. */
  knownAt,
  exDate: isoDate,
  type: z.enum(["split", "dividend"]),
  /** For splits: new shares per old share (2 = 2:1). Null otherwise. */
  splitRatio: positive.nullable(),
  /** For dividends: cash per share in `currency`. Null otherwise. */
  dividendAmount: positive.nullable(),
  currency: currencySchema,
})
export type CorporateActionEvent = z.infer<typeof corporateActionEventSchema>

export const fxRateSchema = z.object({
  /** e.g. "NOKUSD" — units of quote per one unit of base. */
  pair: z.string().min(1),
  date: isoDate,
  knownAt,
  rate: positive,
})
export type FxRate = z.infer<typeof fxRateSchema>
