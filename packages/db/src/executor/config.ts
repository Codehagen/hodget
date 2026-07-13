import { z } from "zod"

import { currencySchema } from "@workspace/engine"

import { panelSchema } from "../schema.js"

/** ISO calendar date, mirroring the engine's fixture date validation. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

/**
 * The validated shape of a run request — persisted verbatim in `engine_runs.config`
 * and re-parsed by the executor. The route handler validates the POST body against
 * this same schema, so the API contract and the executor never drift.
 */
export const runConfigSchema = z.object({
  /** Which analysts sit on the panel, and their committee weights. */
  panel: panelSchema,
  /** Securities to trade. Defaults to every security in the dataset. */
  securityIds: z.array(z.string().min(1)).optional(),
  /** Base currency for valuation/metrics. Defaults to USD. */
  baseCurrency: currencySchema.optional(),
  /** Starting cash per currency; each amount must be positive, at least one entry. */
  initialCash: z
    .partialRecord(currencySchema, z.number().positive())
    .refine((cash) => Object.keys(cash).length > 0, {
      message: "initialCash must fund at least one currency",
    }),
  /** Backtest date range (ISO YYYY-MM-DD, from on or before to). Defaults to the
   * dataset's full span. */
  range: z
    .object({ from: isoDate, to: isoDate })
    .refine((r) => r.from <= r.to, { message: "range.from must be on or before range.to" })
    .optional(),
})

export type RunConfig = z.infer<typeof runConfigSchema>
