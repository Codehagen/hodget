import type { Analyst } from "../types.js"
import { createEarningsDriftAnalyst, EARNINGS_DRIFT_ANALYST_ID } from "./quant/earnings-drift.js"

export * from "./quant/earnings-drift.js"
export * from "./personas/snapshot.js"
export * from "./personas/value.js"

/**
 * Analyst registry, keyed by id (plan 002 phase 2).
 *
 * Quant analysts need no runtime dependencies and are registered as ready
 * instances. LLM personas (e.g. the value analyst) require a per-run
 * {@link LlmClient} and {@link PromptCache}, so they are constructed by the
 * caller via their `create*` factory and registered per run — a module-global
 * model client would break multi-tenant runs.
 */
export const ANALYSTS: Record<string, Analyst> = {
  [EARNINGS_DRIFT_ANALYST_ID]: createEarningsDriftAnalyst(),
}
