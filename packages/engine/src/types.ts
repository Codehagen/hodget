import { z } from "zod"

import { currencySchema } from "./data/types.js"
import type { MarketData } from "./data/market-data.js"

/**
 * Core engine models (plan 002). These are the contracts everything hangs on.
 * Zod-typed so malformed values are rejected structurally, not by convention.
 */

const isoTimestamp = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "expected an ISO timestamp",
})

/**
 * Conviction ∈ [-1, +1]. Sign is direction, magnitude is conviction; sizing
 * consumes the magnitude. NaN and out-of-range are rejected (a broken analyst
 * must abstain, not emit a poisoned number).
 */
export const convictionSchema = z
  .number()
  .refine((n) => !Number.isNaN(n), { message: "conviction must not be NaN" })
  .refine((n) => n >= -1 && n <= 1, { message: "conviction must be within [-1, 1]" })

/**
 * A single analyst's view on a security at a decision cutoff.
 *
 * `abstained` is load-bearing: a broken/failed analyst (`abstained: true`) is
 * NOT the same as a genuine neutral view (`conviction: 0, abstained: false`).
 * The committee excludes abstentions from weighting; a neutral view counts.
 */
export const signalSchema = z
  .object({
    analystId: z.string().min(1),
    securityId: z.string().min(1),
    /** ISO timestamp: the decision cutoff the view was formed at. */
    asOf: isoTimestamp,
    conviction: convictionSchema,
    /** How long the view is expected to pay off; only comparable horizons blend. */
    horizonDays: z.number().int().positive(),
    thesis: z.string().nullable(),
    /** Optional sub-scores for explainability. */
    components: z.record(z.string(), z.number()).optional(),
    /** A broken analyst — distinct from a neutral (conviction 0) view. */
    abstained: z.boolean(),
  })
  .refine((s) => !s.abstained || s.conviction === 0, {
    message: "an abstained signal must have conviction 0",
    path: ["conviction"],
  })
export type Signal = z.infer<typeof signalSchema>

/** True when a signal carries an actionable view (present and non-abstained). */
export function isActionable(signal: Signal): boolean {
  return !signal.abstained
}

/** The committee's blended output for one security. */
export const targetViewSchema = z.object({
  securityId: z.string().min(1),
  asOf: isoTimestamp,
  conviction: convictionSchema,
  horizonDays: z.number().int().positive(),
  /** Analyst ids that contributed a non-abstained view. */
  contributingAnalystIds: z.array(z.string().min(1)),
})
export type TargetView = z.infer<typeof targetViewSchema>

export const orderSchema = z.object({
  securityId: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  /** Whole shares only — accounting never fabricates fractional quantities. */
  quantity: z.number().int().positive(),
  currency: currencySchema,
})
export type Order = z.infer<typeof orderSchema>

export const fillSchema = z.object({
  securityId: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().int().positive(),
  price: z.number().refine(Number.isFinite, "must be a finite number"),
  currency: currencySchema,
  /** ISO timestamp the fill occurred at (next-session semantics live in the shell). */
  filledAt: isoTimestamp,
  commission: z.number().nonnegative(),
})
export type Fill = z.infer<typeof fillSchema>

/**
 * What an analyst receives: a PIT-scoped view of the world at a cutoff. The
 * `data` port only surfaces facts with `knownAt <= asOf`, so an analyst cannot
 * see past its own decision boundary even by accident.
 */
export interface AnalystContext {
  readonly securityId: string
  readonly asOf: string
  readonly data: MarketData
}

export interface Analyst {
  readonly id: string
  readonly kind: "quant" | "llm"
  predict(ctx: AnalystContext): Promise<Signal>
}

/**
 * The execution port shared by all three modes (sim | paper | live). Given a set
 * of order intents and the session they should fill at, it returns the resulting
 * fills. A sim broker fills synchronously against historical closes; a live
 * broker's async order state, idempotency, and partial fills live in the live
 * shell, never in this interface.
 */
export interface Broker {
  execute(orders: readonly Order[], fillDate: string): Promise<Fill[]>
}
