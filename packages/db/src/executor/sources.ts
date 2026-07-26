import {
  ANALYSTS,
  AnthropicLlmClient,
  createFixtureMarketData,
  createValueAnalyst,
  loadFixtureDataset,
  MemoryResponseStore,
  PromptCache,
  VALUE_ANALYST_ID,
  type Analyst,
  type AnalystContext,
  type FixtureDataset,
  type LlmClient,
  type MarketData,
} from "@workspace/engine"

/**
 * The two seams the executor is built around, so real providers and richer
 * analyst rosters plug in later without touching the run loop.
 */

/**
 * Resolves an analyst id to a ready {@link Analyst}. {@link defaultAnalystSource}
 * resolves the engine's quant registry only (no runtime dependencies). LLM
 * personas need a per-run model client and prompt cache — a module-global client
 * would break multi-tenant runs — so {@link createRunAnalystSource} (plan 004)
 * constructs them per run and is what the app wires into a real run.
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
 * Configuration for a run's analyst source (plan 004, checkpoint item 3). The LLM
 * client and prompt cache are **per run** — never module-global — so multi-tenant
 * runs never share credentials or a cache. Defaults construct a per-run
 * {@link AnthropicLlmClient} (API key resolved from `apiKey` → `ANTHROPIC_API_KEY`
 * at construction) over a fresh in-memory {@link PromptCache}. Tests inject a
 * `FakeLlmClient` via `llm`.
 */
export interface RunAnalystSourceConfig {
  /** Model client for LLM personas. Default: a per-run {@link AnthropicLlmClient}. */
  readonly llm?: LlmClient
  /** Prompt cache for LLM personas. Default: a fresh in-memory cache. */
  readonly cache?: PromptCache
  /** Per-run API key, forwarded to the default client. Falls back to env. */
  readonly apiKey?: string
  /** Model id, forwarded to the default client and each LLM persona. */
  readonly model?: string
}

/**
 * An {@link AnalystSource} that resolves both quant analysts (via the engine
 * registry) and LLM personas constructed per run. Quant ids resolve to ready
 * registry instances; `llm.value` is built lazily via
 * {@link createValueAnalyst} with this run's model client + prompt cache and
 * memoized for the run. Unknown ids fail loud — same contract as
 * {@link defaultAnalystSource}, extended with the LLM seam.
 */
export function createRunAnalystSource(config: RunAnalystSourceConfig = {}): AnalystSource {
  const model = config.model
  const personas = new Map<string, Analyst>()
  // Built lazily on the first LLM persona: a quant-only panel must never
  // construct a model client (which would require an API key it does not need).
  let llm = config.llm
  let cache = config.cache

  return {
    resolve(id) {
      const quant = ANALYSTS[id]
      if (quant) return quant

      if (id === VALUE_ANALYST_ID) {
        let persona = personas.get(id)
        if (!persona) {
          llm ??= new AnthropicLlmClient({ apiKey: config.apiKey, model })
          cache ??= new PromptCache(new MemoryResponseStore())
          persona = createValueAnalyst({ llm, cache, ...(model !== undefined ? { model } : {}) })
          personas.set(id, persona)
        }
        return persona
      }

      throw new Error(
        `unknown analyst id "${id}" — register it in the analyst source (LLM personas must be constructed per run)`,
      )
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
