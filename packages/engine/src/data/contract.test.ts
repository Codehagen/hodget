import { describeMarketDataContract } from "./contract.js"
import { FIXTURE_FX_PAIR, FIXTURE_IDS, loadFixtureDataset } from "./fixture/dataset.js"
import { createFixtureMarketData } from "./fixture/fixture-market-data.js"

// Top-level await (ESM): the committed dataset is on disk, no network.
const dataset = await loadFixtureDataset()

// Union of the two exchange calendars — FX must cover every one of these days.
const tradingDays = [
  ...new Set([...(dataset.calendars.XNAS ?? []), ...(dataset.calendars.XOSL ?? [])]),
].sort()

// The same suite runs here against FixtureMarketData; behind LIVE_DATA_TESTS it
// runs against each real provider (plan 003).
describeMarketDataContract(() => createFixtureMarketData(dataset), {
  coveredSecurityId: FIXTURE_IDS.usEquity,
  range: { from: "2020-01-01", to: "2020-12-31" },
  uncoveredSecurityId: FIXTURE_IDS.unknown,
  failingSecurityId: FIXTURE_IDS.poison,
  fxPair: FIXTURE_FX_PAIR,
  tradingDays,
  lateAsOf: "2021-01-01T00:00:00Z",
  earlyAsOf: "2020-01-15T00:00:00Z",
})
