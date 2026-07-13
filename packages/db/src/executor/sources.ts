import {
  ANALYSTS,
  createFixtureMarketData,
  loadFixtureDataset,
  type Analyst,
  type AnalystContext,
  type FixtureDataset,
  type MarketData,
} from "@workspace/engine"

/**
 * The two seams the executor is built around, so real providers and richer
 * analyst rosters plug in later without touching the run loop.
 */

/**
 * Resolves an analyst id to a ready {@link Analyst}. The default resolves the
 * engine's quant registry (no runtime dependencies). LLM personas need a per-run
 * model client and prompt cache, so an app that wants them provides a richer
 * source that constructs them per run — a module-global model client would break
 * multi-tenant runs (plan 002).
 */
export interface AnalystSource {
  resolve(id: string): Analyst
}

export function defaultAnalystSource(): AnalystSource {
  return {
    resolve(id) {
      const analyst = ANALYSTS[id]
      if (!analyst) {
        throw new Error(
          `unknown analyst id "${id}" — register it in the analyst source (LLM personas must be constructed per run)`,
        )
      }
      return analyst
    },
  }
}

/**
 * Where the run's market data comes from. The default is the committed synthetic
 * fixture; a real provider implements the same two methods. `load` returns the
 * dataset (calendar, raw prices, FX, corporate actions the sim broker needs) and
 * `createMarketData` builds the PIT-scoped, analyst-facing view over it — kept
 * separate so a test can inject a throwing `MarketData` while keeping real prices.
 */
export interface RunDataSource {
  load(): Promise<FixtureDataset>
  createMarketData(dataset: FixtureDataset): MarketData
}

export const fixtureDataSource: RunDataSource = {
  load: () => loadFixtureDataset(),
  createMarketData: (dataset) => createFixtureMarketData(dataset),
}

/**
 * Wrap an analyst so each `predict` call reports activity. The engine has no
 * per-cycle callback, so instrumenting `predict` is how the executor observes
 * per-analyst / per-day progress without modifying `packages/engine`.
 */
export function instrumentAnalyst(
  analyst: Analyst,
  onPredict: (ctx: AnalystContext) => void,
): Analyst {
  return {
    id: analyst.id,
    kind: analyst.kind,
    predict(ctx) {
      onPredict(ctx)
      return analyst.predict(ctx)
    },
  }
}
