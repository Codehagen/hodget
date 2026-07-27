import { loadFixtureDataset, type FixtureDataset } from "../data/fixture/dataset.js"
import type { OutcomeBar, OutcomeData } from "./outcomes.js"

/**
 * {@link OutcomeData} over the committed synthetic fixture dataset (plan 024,
 * step 1) — the sibling that plan 003's outcome amendment says `FixtureMarketData`
 * gains: no new data, one more accessor.
 *
 * It reads the same `fixtures/dataset.json` through the same loader
 * ({@link loadFixtureDataset}), so the repo has exactly one reader of that file
 * and one schema validating it. What it deliberately does *not* reuse is
 * `createFixtureMarketData`: a `MarketData` is PIT-wrapped and structurally
 * cannot serve a bar from after a decision cutoff, which is the whole reason
 * attribution has its own port (plan 023, design decision 1). The two providers
 * share a dataset; they must never share an interface.
 *
 * Closes are **adjusted** (`adjClose`), never raw. The fixture's US equity
 * carries a split, so measuring on `close` would hand every analyst who held it
 * a 100% "return" that is nothing but the split.
 *
 * A security the dataset does not price yields an empty array rather than a
 * throw — including the fixture's poisoned id, whose simulated transport
 * failure is a `MarketData` affordance and has no counterpart in this port's
 * contract. `resolveObservations` already treats a short result as unresolved,
 * so an absent series costs exactly the observations it covers and nothing
 * else. That is the fail-closed direction: no outcome rather than a wrong one.
 */
export class FixtureOutcomeData implements OutcomeData {
  /** securityId → ascending, frozen bars. Built once; `sessionsAfter` only slices. */
  private readonly bars: ReadonlyMap<string, readonly OutcomeBar[]>

  constructor(dataset: FixtureDataset) {
    const bars = new Map<string, readonly OutcomeBar[]>()
    for (const [securityId, rows] of Object.entries(dataset.prices)) {
      const series = rows
        .map((row) => Object.freeze({ date: row.date, adjClose: row.adjClose }))
        // The generator emits ascending rows already; sorting anyway means the
        // strictly-after search below rests on an invariant this class owns
        // rather than one it inherits from a JSON file.
        .sort((a, b) => compare(a.date, b.date))
      bars.set(securityId, Object.freeze(series))
    }
    this.bars = bars
  }

  /**
   * Sessions **strictly after** `after`, ascending, at most `limit` of them.
   *
   * "Strictly" is the load-bearing word and the reason this method has a test
   * of its own. Implemented with `>=` it would return the `after` session
   * itself, `resolveObservations` would take that close as the entry price, and
   * every analyst on the panel would collect alpha from a same-day fill the sim
   * broker could never have produced (plan 024, design decision 4). The
   * comparison is date-only, so a cutoff that arrives as a full instant
   * (`2020-01-02T21:00:00Z`) excludes that day's bar exactly as the bare date
   * does — a provider returning timestamps and one returning dates must agree.
   */
  async sessionsAfter(
    securityId: string,
    after: string,
    limit: number,
  ): Promise<readonly OutcomeBar[]> {
    const series = this.bars.get(securityId)
    if (!series || limit <= 0) return []
    const afterDay = after.slice(0, 10)
    const start = series.findIndex((bar) => bar.date > afterDay)
    if (start === -1) return []
    // A short slice near the end of the dataset is the correct answer, not an
    // error: the caller counts it as an unresolved window.
    return series.slice(start, start + limit)
  }
}

/** Load the default committed dataset and build a {@link FixtureOutcomeData} over it. */
export async function loadFixtureOutcomeData(url?: URL): Promise<FixtureOutcomeData> {
  return new FixtureOutcomeData(await loadFixtureDataset(url))
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
