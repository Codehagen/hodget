import { z } from "zod"

import type { DecisionRecord } from "@workspace/engine"

/**
 * Row schemas and domain types for the engine tables.
 *
 * The `pg` and pglite drivers both parse `jsonb` into JS values and return
 * `timestamptz` as a `Date`, so these schemas accept `Date | string` for
 * timestamps and normalize to ISO strings — the domain layer speaks ISO, never
 * driver-specific `Date` objects. Rows are validated on the way out so a schema
 * drift surfaces at the boundary, not three layers deep.
 */

export type RunMode = "backtest" | "paper"
export type RunStatus = "queued" | "running" | "completed" | "failed"

/** One analyst seat on the panel: which analyst, and its committee weight.
 * The .max() bounds here and below are abuse caps far above real usage
 * (plan 009): these shapes persist verbatim into jsonb, so without them an
 * authenticated user could store arbitrarily large payloads. */
export const panelSeatSchema = z.object({
  id: z.string().min(1).max(100),
  weight: z.number().min(0),
})
export type PanelSeat = z.infer<typeof panelSeatSchema>

export const panelSchema = z.object({
  analysts: z.array(panelSeatSchema).min(1).max(16),
})
export type Panel = z.infer<typeof panelSchema>

/** The validated body for creating a panel config (name + panel). */
export const panelConfigInputSchema = z.object({
  name: z.string().min(1).max(120),
  panel: panelSchema,
})
export type PanelConfigInput = z.infer<typeof panelConfigInputSchema>

/** Normalize a `timestamptz` column (Date or string) to an ISO string. */
const isoTimestamp = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)).toISOString())

/** jsonb comes back already parsed from both drivers. */
const json = z.unknown()

export interface EngineRun {
  readonly id: string
  readonly ownerUserId: string
  readonly mode: RunMode
  readonly status: RunStatus
  readonly config: unknown
  readonly error: string | null
  readonly createdAt: string
  readonly completedAt: string | null
  /** The durable workflow run id (plan 004), or null for inline/legacy runs. */
  readonly workflowRunId: string | null
}

export const runRowSchema = z
  .object({
    id: z.string(),
    owner_user_id: z.string(),
    mode: z.enum(["backtest", "paper"]),
    status: z.enum(["queued", "running", "completed", "failed"]),
    config: json,
    error: z.string().nullable(),
    created_at: isoTimestamp,
    completed_at: isoTimestamp.nullable(),
    // Nullish: the column is absent from selects predating migration 0002 in the
    // same way a null value means "ran inline / no durable stream".
    workflow_run_id: z.string().nullable().optional(),
  })
  .transform(
    (row): EngineRun => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      mode: row.mode,
      status: row.status,
      config: row.config,
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      workflowRunId: row.workflow_run_id ?? null,
    }),
  )

export interface EngineDecisionRow {
  readonly id: string
  readonly runId: string
  readonly asOf: string
  readonly payload: unknown
  readonly thesis: string | null
}

export const decisionRowSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    as_of: isoTimestamp,
    payload: json,
    thesis: z.string().nullable(),
  })
  .transform(
    (row): EngineDecisionRow => ({
      id: row.id,
      runId: row.run_id,
      asOf: row.as_of,
      payload: row.payload,
      thesis: row.thesis,
    }),
  )

export interface EngineFillRow {
  readonly id: string
  readonly runId: string
  readonly decisionId: string
  readonly fill: unknown
}

export const fillRowSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    decision_id: z.string(),
    fill: json,
  })
  .transform(
    (row): EngineFillRow => ({
      id: row.id,
      runId: row.run_id,
      decisionId: row.decision_id,
      fill: row.fill,
    }),
  )

export interface EngineResult {
  readonly runId: string
  readonly equityCurve: unknown
  readonly metrics: unknown
  readonly diagnostics: unknown
  readonly caveats: unknown
}

export const resultRowSchema = z
  .object({
    run_id: z.string(),
    equity_curve: json,
    metrics: json,
    diagnostics: json,
    caveats: json,
  })
  .transform(
    (row): EngineResult => ({
      runId: row.run_id,
      equityCurve: row.equity_curve,
      metrics: row.metrics,
      diagnostics: row.diagnostics,
      caveats: row.caveats,
    }),
  )

export interface PanelConfig {
  readonly id: string
  readonly ownerUserId: string
  readonly name: string
  readonly panel: Panel
  readonly createdAt: string
  readonly updatedAt: string
}

export const panelConfigRowSchema = z
  .object({
    id: z.string(),
    owner_user_id: z.string(),
    name: z.string(),
    panel: panelSchema,
    created_at: isoTimestamp,
    updated_at: isoTimestamp,
  })
  .transform(
    (row): PanelConfig => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      name: row.name,
      panel: row.panel,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  )

/**
 * The persisted, fully reconstructed decision: the engine's {@link DecisionRecord}
 * plus the database ids of the decision and its fills, so callers can trace a
 * position back to the exact decision that produced it.
 */
export interface PersistedDecision extends DecisionRecord {
  readonly decisionId: string
  readonly thesis: string | null
}
