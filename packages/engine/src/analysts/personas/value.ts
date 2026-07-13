import { promises as fs } from "node:fs"
import { fileURLToPath } from "node:url"

import { z } from "zod"

import type { DateRange } from "../../data/market-data.js"
import { resolveModel } from "../../llm/anthropic.js"
import type { LlmClient, LlmToolSchema } from "../../llm/client.js"
import { PromptCache, type PromptAuditRecord } from "../../llm/prompt-cache.js"
import type { IntrinsicValueOptions } from "../../primitives/fundamentals.js"
import type { Analyst, AnalystContext, Signal } from "../../types.js"
import { renderFundamentalsContext } from "./snapshot.js"

/**
 * Value-investing LLM persona (plan 002 phase 2). Thin by construction: a
 * versioned system prompt file, a deterministic fundamentals context, and a
 * native structured-output tool. All financial math lives in `primitives/`.
 *
 * Abstention (conviction 0, `abstained: true`) — never a crash, never a traded
 * neutral — on: insufficient data (no fundamentals or no price), an LLM
 * transport error, or a malformed/failed structured output (the raw response is
 * still persisted). A data-layer `DataUnavailableError` PROPAGATES (fail loud);
 * it is not caught here. A genuine `neutral` from the model is a real,
 * non-abstained view.
 */

export const VALUE_ANALYST_ID = "llm.value"
export const VALUE_PROMPT_VERSION = "value.v1"
const VALUE_HORIZON_DAYS = 250

const PROMPT_URL = new URL("./prompts/value.v1.md", import.meta.url)

/** Load the versioned system prompt from disk (memoised per analyst instance). */
export async function loadValuePrompt(): Promise<string> {
  return fs.readFile(fileURLToPath(PROMPT_URL), "utf8")
}

/** Structured-output schema the model must fill in. */
export const valueOutputSchema = z.object({
  signal: z.enum(["bullish", "neutral", "bearish"]),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string(),
})
export type ValueOutput = z.infer<typeof valueOutputSchema>

export const VALUE_TOOL: LlmToolSchema = {
  name: "record_value_view",
  description: "Record the value-investing verdict for this security.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      signal: { type: "string", enum: ["bullish", "neutral", "bearish"] },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
      reasoning: { type: "string" },
    },
    required: ["signal", "confidence", "reasoning"],
  },
}

const SIGN: Record<ValueOutput["signal"], number> = { bullish: 1, neutral: 0, bearish: -1 }

export interface ValueAnalystConfig {
  readonly id?: string
  readonly llm: LlmClient
  readonly cache: PromptCache
  /** Model id used for the request and the cache key. Default {@link resolveModel}. */
  readonly model?: string
  readonly horizonDays?: number
  /** Trailing window (calendar days) to fetch the latest price over. Default 400. */
  readonly priceLookbackDays?: number
  readonly periodsPerYear?: number
  readonly intrinsic?: IntrinsicValueOptions
  /** Audit timestamp source (injectable for deterministic tests). */
  readonly now?: () => string
}

function byFiscalPeriod(a: { fiscalPeriod: string }, b: { fiscalPeriod: string }): number {
  return a.fiscalPeriod < b.fiscalPeriod ? -1 : a.fiscalPeriod > b.fiscalPeriod ? 1 : 0
}

function priceRange(asOf: string, lookbackDays: number): DateRange {
  const asOfDate = asOf.slice(0, 10)
  const from = new Date(Date.parse(`${asOfDate}T00:00:00Z`) - lookbackDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
  return { from, to: asOfDate }
}

async function latestClose(ctx: AnalystContext, lookbackDays: number): Promise<number | null> {
  // DataUnavailableError propagates from here (fail loud).
  const result = await ctx.data.prices(ctx.securityId, priceRange(ctx.asOf, lookbackDays), ctx.asOf)
  if (result.coverage !== "covered" || result.rows.length === 0) return null
  return result.rows[result.rows.length - 1]?.close ?? null
}

function abstain(ctx: AnalystContext, id: string, horizonDays: number, reason: string): Signal {
  return {
    analystId: id,
    securityId: ctx.securityId,
    asOf: ctx.asOf,
    conviction: 0,
    horizonDays,
    thesis: reason,
    abstained: true,
  }
}

export function createValueAnalyst(config: ValueAnalystConfig): Analyst {
  const id = config.id ?? VALUE_ANALYST_ID
  const model = resolveModel(config.model)
  const horizonDays = config.horizonDays ?? VALUE_HORIZON_DAYS
  const lookbackDays = config.priceLookbackDays ?? 400
  const now = config.now ?? (() => new Date().toISOString())

  // Per-instance prompt memo (no module-global mutable state): the versioned
  // prompt file is read once per analyst, lazily on first predict.
  let promptPromise: Promise<string> | undefined
  const systemPrompt = () => (promptPromise ??= loadValuePrompt())

  return {
    id,
    kind: "llm",
    async predict(ctx: AnalystContext): Promise<Signal> {
      // DataUnavailableError from the data layer propagates (never an abstain).
      const fundamentals = await ctx.data.fundamentals(ctx.securityId, ctx.asOf)
      if (fundamentals.coverage !== "covered" || fundamentals.rows.length === 0) {
        return abstain(ctx, id, horizonDays, "insufficient data: no fundamentals")
      }
      const price = await latestClose(ctx, lookbackDays)
      if (price === null) {
        return abstain(ctx, id, horizonDays, "insufficient data: no price")
      }

      const snapshots = [...fundamentals.rows].sort(byFiscalPeriod)
      const rendered = renderFundamentalsContext({
        securityId: ctx.securityId,
        currency: snapshots[snapshots.length - 1]?.currency ?? "USD",
        price,
        snapshots,
        ...(config.periodsPerYear !== undefined ? { periodsPerYear: config.periodsPerYear } : {}),
        ...(config.intrinsic !== undefined ? { intrinsic: config.intrinsic } : {}),
      })

      const system = await systemPrompt()
      const key = config.cache.key({
        analystId: id,
        model,
        promptVersion: VALUE_PROMPT_VERSION,
        renderedContext: rendered.text,
      })

      const cached = await config.cache.get(key)
      let response = cached?.response
      if (!response) {
        try {
          response = await config.llm.complete({
            system,
            prompt: rendered.text,
            tool: VALUE_TOOL,
            model,
          })
        } catch {
          // Any transport failure ⇒ abstain (never a crash, never a traded neutral).
          return abstain(ctx, id, horizonDays, "llm transport error")
        }
      }

      const parsed = valueOutputSchema.safeParse(response.toolInput)

      if (!cached) {
        const record: PromptAuditRecord = {
          analystId: id,
          model,
          promptVersion: VALUE_PROMPT_VERSION,
          systemPrompt: system,
          renderedContext: rendered.text,
          contextHash: rendered.contentHash,
          response,
          parseStatus: parsed.success ? "ok" : "failed",
          createdAt: now(),
        }
        await config.cache.put(record)
      }

      if (!parsed.success) {
        return abstain(ctx, id, horizonDays, "malformed structured output")
      }

      const { signal, confidence, reasoning } = parsed.data
      const sign = SIGN[signal]
      return {
        analystId: id,
        securityId: ctx.securityId,
        asOf: ctx.asOf,
        conviction: (sign * confidence) / 100,
        horizonDays,
        thesis: reasoning,
        components: { confidence, signalSign: sign },
        abstained: false,
      }
    },
  }
}
