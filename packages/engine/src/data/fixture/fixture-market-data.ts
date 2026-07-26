import { DataUnavailableError } from "../errors.js"
import {
  notCovered,
  PitMarketData,
  type DateRange,
  type MarketData,
  type RawMarketDataSource,
  type RawResult,
} from "../market-data.js"
import { createSecurityResolver, type SecurityRegistration } from "../symbols.js"
import { loadFixtureDataset, type FixtureDataset } from "./dataset.js"

/**
 * A {@link RawMarketDataSource} backed by the committed synthetic dataset. It
 * returns every row it has (PIT filtering happens in {@link PitMarketData}),
 * signals `not-covered` for unregistered symbols, and throws
 * `DataUnavailableError` for the poisoned securityId — the fixture's way of
 * simulating a transport failure so the fail-loud contract is testable.
 */
class FixtureRawSource implements RawMarketDataSource {
  private readonly poison: ReadonlySet<string>

  constructor(private readonly dataset: FixtureDataset) {
    this.poison = new Set(dataset.poison)
  }

  private table(
    map: Record<string, readonly unknown[] | undefined>,
    securityId: string,
  ): RawResult {
    if (this.poison.has(securityId)) {
      throw new DataUnavailableError(`simulated transport failure for ${securityId}`)
    }
    const rows = map[securityId]
    if (rows === undefined) return notCovered()
    return { coverage: "covered", rows }
  }

  prices(securityId: string, _range: DateRange): RawResult {
    return this.table(this.dataset.prices, securityId)
  }

  fundamentals(securityId: string): RawResult {
    return this.table(this.dataset.fundamentals, securityId)
  }

  earnings(securityId: string): RawResult {
    return this.table(this.dataset.earnings, securityId)
  }

  news(securityId: string): RawResult {
    return this.table(this.dataset.news, securityId)
  }

  insiderTrades(securityId: string): RawResult {
    return this.table(this.dataset.insiderTrades, securityId)
  }

  corporateActions(securityId: string): RawResult {
    return this.table(this.dataset.corporateActions, securityId)
  }

  fxRate(pair: string): RawResult {
    const rows = this.dataset.fx[pair]
    if (rows === undefined) return notCovered()
    return { coverage: "covered", rows }
  }
}

/** Build a PIT-enforced {@link MarketData} over a fixture dataset. */
export function createFixtureMarketData(dataset: FixtureDataset): MarketData {
  const registrations: SecurityRegistration[] = dataset.securities.map((s) => ({
    securityId: s.securityId,
    symbol: s.symbol,
    mic: s.mic,
  }))
  const resolver = createSecurityResolver(registrations)
  return new PitMarketData(new FixtureRawSource(dataset), resolver)
}

/** Load the default committed dataset and build a {@link MarketData} over it. */
export async function loadFixtureMarketData(): Promise<MarketData> {
  return createFixtureMarketData(await loadFixtureDataset())
}
