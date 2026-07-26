import type { FixtureDataset } from "../data/fixture/dataset.js"
import { createFixtureMarketData } from "../data/fixture/fixture-market-data.js"
import type { DateRange } from "../data/market-data.js"
import type { Mic } from "../data/symbols.js"
import type { Currency } from "../data/types.js"
import type { ConstructionConfig } from "../portfolio/construct.js"
import type { RiskConfig } from "../risk/gates.js"
import type { Analyst, Committee } from "../types.js"
import type { Ledger } from "../ledger/ledger.js"
import { createTradingCalendar } from "./calendar.js"
import { runBacktest, type BacktestConfig, type BacktestResult } from "./engine.js"
import { createPriceBook } from "./pricebook.js"
import type { SimBrokerCosts } from "./sim-broker.js"

/**
 * Convenience wiring for a {@link FixtureDataset}: builds the calendar, raw
 * price/FX book, and PIT market data, then runs {@link runBacktest}. Keeps the
 * engine itself decoupled from the fixture loader while giving tests a one-liner.
 */
export interface FixtureBacktestOptions {
  /** A single-analyst run. Provide this or `panel`. */
  readonly analyst?: Analyst
  /** A multi-analyst panel (combined by `committee`). */
  readonly panel?: readonly Analyst[]
  readonly committee?: Committee
  /** Defaults to every security in the dataset. */
  readonly securityIds?: readonly string[]
  /** Defaults to USD. */
  readonly baseCurrency?: Currency
  readonly initialCash: Partial<Record<Currency, number>>
  /** Defaults to the dataset's full span. */
  readonly range?: DateRange
  readonly construction?: ConstructionConfig
  readonly risk?: RiskConfig
  readonly costs?: SimBrokerCosts
  readonly periodsPerYear?: number
  readonly lookbackTradingDays?: number
  readonly decisionCutoffTime?: string
  readonly ledger?: Ledger
}

export function runFixtureBacktest(
  dataset: FixtureDataset,
  options: FixtureBacktestOptions,
): Promise<BacktestResult> {
  const baseCurrency = options.baseCurrency ?? "USD"
  const prices = createPriceBook({
    securities: dataset.securities.map((s) => ({
      securityId: s.securityId,
      mic: s.mic,
      currency: s.currency,
    })),
    prices: dataset.prices,
    fx: dataset.fx,
    baseCurrency,
  })

  const config: BacktestConfig = {
    ...(options.analyst !== undefined ? { analyst: options.analyst } : {}),
    ...(options.panel !== undefined ? { panel: options.panel } : {}),
    ...(options.committee !== undefined ? { committee: options.committee } : {}),
    securityIds: options.securityIds ?? dataset.securities.map((s) => s.securityId),
    data: createFixtureMarketData(dataset),
    prices,
    calendar: createTradingCalendar(dataset.calendars as Partial<Record<Mic, readonly string[]>>),
    corporateActions: dataset.corporateActions,
    baseCurrency,
    initialCash: options.initialCash,
    range: options.range ?? { from: dataset.meta.from, to: dataset.meta.to },
    ...(options.construction !== undefined ? { construction: options.construction } : {}),
    ...(options.risk !== undefined ? { risk: options.risk } : {}),
    ...(options.costs !== undefined ? { costs: options.costs } : {}),
    ...(options.periodsPerYear !== undefined ? { periodsPerYear: options.periodsPerYear } : {}),
    ...(options.lookbackTradingDays !== undefined ? { lookbackTradingDays: options.lookbackTradingDays } : {}),
    ...(options.decisionCutoffTime !== undefined ? { decisionCutoffTime: options.decisionCutoffTime } : {}),
    ...(options.ledger !== undefined ? { ledger: options.ledger } : {}),
  }
  return runBacktest(config)
}
