import type { FeedEntry } from "./simulated-run"

/**
 * The normalized contract the New-run dialog renders, and the seam that lets one
 * dialog carry two data sources (plan 005): a scripted replay for the public
 * `/demo` surface, and the real engine pipeline for signed-in `/dashboard` users.
 *
 * Each source (`useSimulatedRun`, `useRealRun`) produces a {@link RunDialogState};
 * the dialog is source-agnostic and reads only this shape. Keeping the contract
 * here — not inside either hook — is what keeps the demo untouched while the real
 * source is added.
 */

/** The headline metrics the completed-run StatBar shows. Both sources map their
 * own metrics onto these five fields (the real engine's `annualizedReturn` →
 * `cagr`, `winRate` → `hitRate`) so the dialog never branches on source. */
export interface RunDialogMetrics {
  readonly sharpe: number
  readonly cagr: number
  readonly maxDrawdown: number
  /** Whole-number percentage, e.g. 62 for 62%. */
  readonly hitRate: number
  readonly turnover: number
}

export type RunDialogStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  // The live stream dropped and the run's persisted status could not confirm a
  // terminal outcome — it may still be executing. A distinct state so the dialog
  // stops the running visuals and keeps the run linkable, rather than spinning
  // "running" forever next to an error.
  | "disconnected"

/** A failure surfaced to the user. `auth` renders a sign-in prompt (the session
 * expired mid-run); `run` is an engine failure; `connection` is a dropped stream
 * whose persisted status could not be recovered. */
export interface RunDialogError {
  readonly kind: "auth" | "run" | "connection"
  readonly message: string
}

export interface RunDialogState {
  readonly status: RunDialogStatus
  /** Identifier shown in the status strip (fixture id or the real run id). */
  readonly runIdLabel: string | null
  /** Real run id for the "View full run" link, or null to hide the link (the
   * simulated source points at its fixture run; a failed real run has no
   * detail worth linking). */
  readonly detailRunId: string | null
  /** 1-based day counter; 0 before the first day. */
  readonly day: number
  /** Total days if known upfront (simulated), else 0 → the strip shows "—". */
  readonly totalDays: number
  /** Book equity at the current day if the source carries it, else null. */
  readonly equity: number | null
  readonly feed: FeedEntry[]
  readonly metrics: RunDialogMetrics | null
  readonly error: RunDialogError | null
}

/** What every source hook returns to the dialog. */
export interface RunSource {
  readonly state: RunDialogState
  /** Strategy label for the idle panel's copy. */
  readonly strategyName: string
  readonly start: () => void
  readonly reset: () => void
}

/**
 * Map the engine's persisted `BacktestMetrics` (jsonb, arrives as `unknown` over
 * the wire) onto the five fields the dialog and the real-run detail surface show.
 * The scale is chosen to match the fixture surfaces exactly:
 *   cagr        engine `annualizedReturn` (fraction) → percent
 *   maxDrawdown engine `maxDrawdown` (positive fraction) → negative percent
 *   hitRate     engine `winRate` (fraction) → whole-number percent
 *   sharpe / turnover pass through as raw multiples
 * Defensive because the source is untrusted jsonb: a non-object or a missing /
 * non-finite field yields `null` (no metrics) rather than `NaN` in the UI.
 */
export function metricsFromEngine(raw: unknown): RunDialogMetrics | null {
  if (!raw || typeof raw !== "object") return null
  const m = raw as Record<string, unknown>
  const num = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) ? v : 0
  if (typeof m.sharpe !== "number" && typeof m.annualizedReturn !== "number") {
    return null
  }
  return {
    sharpe: num(m.sharpe),
    cagr: num(m.annualizedReturn) * 100,
    maxDrawdown: -(num(m.maxDrawdown) * 100),
    hitRate: num(m.winRate) * 100,
    turnover: num(m.turnover),
  }
}
