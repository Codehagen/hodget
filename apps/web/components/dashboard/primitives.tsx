import type * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

import type { AnalystKind, CoverageState } from "./demo-data"
import { formatSignedNumber, pnlToneClass } from "./format"

/**
 * Shared, purely-presentational building blocks for the engine pages. No
 * "use client" — every piece here is static markup, so it renders on the server
 * and keeps the /demo routes prerenderable.
 *
 * Generic layout primitives (StatBar, StageStepper, MasterDetail) live in
 * `packages/ui`; this file holds the hodget-specific compositions — the finance
 * status vocabulary, conviction/agreement meters, and figure formatting.
 */

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */

/** Page title + one-line description, matching the dashboard header rhythm. */
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  )
}

/** Muted, low-key advisory banner — the fixed-universe caveat and friends. */
export function CaveatBanner({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border border-border bg-muted/40 px-3.5 py-2.5 text-xs/relaxed text-muted-foreground",
        className
      )}
    >
      <HugeiconsIcon
        icon={InformationCircleIcon}
        size={15}
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
      <p className="min-w-0">{children}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* StatusPill — the single semantic status/kind badge                  */
/* ------------------------------------------------------------------ */

/**
 * The full hodget status + kind vocabulary in one component with one variant
 * map — never a scatter of one-off badges. Two appearances share the same
 * color per status:
 *   • "pill" (default) — soft filled badge (gates, readiness, mode)
 *   • "dot"            — colored dot + text (table status, health rows)
 *
 * Colors resolve through the semantic tokens (`success`/`warning`/`info`/
 * `destructive`) plus `violet` for LLM/event kinds, so everything flips with the
 * theme. Pass `label` to override the default display text.
 */
export type StatusName =
  // run / pipeline lifecycle
  | "running"
  | "completed"
  | "queued"
  | "failed"
  // gates & decision results
  | "passed"
  | "clipped"
  | "vetoed"
  // readiness & mode
  | "draft"
  | "live"
  | "paper-ready"
  | "archived"
  | "backtest"
  | "paper"
  // health / checks
  | "healthy"
  | "degraded"
  | "attention"
  | "blocked"
  | "watch"
  | "verified"
  | "approved"
  | "executed"
  | "drift"
  // data coverage
  | "covered"
  | "partial"
  | "not-covered"
  | "covered-empty"
  // analyst & strategy kinds
  | "quant"
  | "llm"
  | "fundamental"
  | "macro"
  | "event"

type StatusStyle = {
  label: string
  /** Soft-pill classes (border + bg + text). */
  pill: string
  /** Text color for the "dot" appearance label. */
  text: string
  /** Dot fill color. */
  dot: string
}

const SUCCESS = {
  pill: "border-success/25 bg-success/10 text-success",
  text: "text-success",
  dot: "bg-success",
}
const DANGER = {
  pill: "border-destructive/25 bg-destructive/10 text-destructive",
  text: "text-destructive",
  dot: "bg-destructive",
}
const WARNING = {
  pill: "border-warning/30 bg-warning/10 text-warning",
  text: "text-warning",
  dot: "bg-warning",
}
const INFO = {
  pill: "border-info/25 bg-info/10 text-info",
  text: "text-info",
  dot: "bg-info",
}
const NEUTRAL = {
  pill: "border-border bg-muted text-muted-foreground",
  text: "text-muted-foreground",
  dot: "bg-muted-foreground",
}
const VIOLET = {
  pill: "border-accent-violet/25 bg-accent-violet/10 text-accent-violet",
  text: "text-accent-violet",
  dot: "bg-accent-violet",
}

const STATUS_META: Record<StatusName, StatusStyle> = {
  running: { label: "Running", ...INFO },
  completed: { label: "Completed", ...SUCCESS },
  queued: { label: "Queued", ...NEUTRAL },
  failed: { label: "Failed", ...DANGER },

  passed: { label: "Passed", ...SUCCESS },
  clipped: { label: "Clipped", ...WARNING },
  vetoed: { label: "Vetoed", ...DANGER },

  draft: { label: "Draft", ...NEUTRAL },
  live: { label: "Live", ...SUCCESS },
  "paper-ready": { label: "Paper ready", ...SUCCESS },
  archived: { label: "Archived", ...NEUTRAL },
  backtest: { label: "Backtest", ...INFO },
  paper: { label: "Paper", ...VIOLET },

  healthy: { label: "Healthy", ...SUCCESS },
  degraded: { label: "Degraded", ...WARNING },
  attention: { label: "Attention", ...WARNING },
  blocked: { label: "Blocked", ...WARNING },
  watch: { label: "Watch", ...WARNING },
  verified: { label: "Verified", ...SUCCESS },
  approved: { label: "Approved", ...SUCCESS },
  executed: { label: "Executed", ...SUCCESS },
  drift: { label: "Drift review", ...WARNING },

  covered: { label: "Covered", ...SUCCESS },
  partial: { label: "Partial", ...WARNING },
  "not-covered": { label: "Not covered", ...NEUTRAL },
  "covered-empty": { label: "Empty", ...WARNING },

  quant: { label: "Quant", ...SUCCESS },
  llm: { label: "LLM", ...INFO },
  fundamental: { label: "Fundamental", ...INFO },
  macro: { label: "Macro", ...WARNING },
  event: { label: "Event", ...VIOLET },
}

export function StatusPill({
  status,
  appearance = "pill",
  label,
  className,
  children,
}: {
  status: StatusName
  appearance?: "pill" | "dot"
  /** Override the default label text. */
  label?: React.ReactNode
  className?: string
  /** Optional leading adornment (e.g. an icon). */
  children?: React.ReactNode
}) {
  const meta = STATUS_META[status]
  const content = label ?? meta.label

  if (appearance === "dot") {
    return (
      <span
        data-slot="status-pill"
        data-appearance="dot"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
          meta.text,
          className
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
        {children}
        {content}
      </span>
    )
  }

  return (
    <span
      data-slot="status-pill"
      data-appearance="pill"
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1 rounded-none border px-2 text-xs font-medium whitespace-nowrap",
        meta.pill,
        className
      )}
    >
      {children}
      {content}
    </span>
  )
}

/** Kind badge for an analyst — Quant vs LLM, on the shared status vocabulary. */
export function AnalystKindBadge({ kind }: { kind: AnalystKind }) {
  return <StatusPill status={kind} />
}

const COVERAGE_STATUS: Record<CoverageState, StatusName> = {
  covered: "covered",
  "covered-empty": "covered-empty",
  "not-covered": "not-covered",
  partial: "partial",
}

/** Coverage-state chip — covered / covered-empty / not-covered / partial. */
export function CoverageBadge({ state }: { state: CoverageState }) {
  return <StatusPill status={COVERAGE_STATUS[state]} />
}

/* ------------------------------------------------------------------ */
/* Figures — mono, tabular financial numbers                           */
/* ------------------------------------------------------------------ */

/** A monospaced, tabular figure. `value` is rendered verbatim — format upstream. */
export function Figure({
  value,
  className,
}: {
  value: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>{value}</span>
  )
}

/**
 * A signed figure colored by its sign (green up, red down, muted at zero).
 * Pass preformatted text as `children`, else it renders `+0.00`-style output.
 */
export function Delta({
  value,
  children,
  className,
}: {
  value: number
  children?: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-mono font-medium tabular-nums",
        pnlToneClass(value),
        className
      )}
    >
      {children ?? formatSignedNumber(value)}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Meters — conviction & analyst agreement                             */
/* ------------------------------------------------------------------ */

/**
 * Signed conviction meter, [-1, 1]. A segmented bar filling outward from a
 * center baseline — red to the left (bearish), green to the right (bullish) —
 * with the signed value trailing in mono. Backward-compatible: `<ConvictionBar
 * value={x} />` still works; `showValue`/`segments` are new opt-ins.
 */
export function ConvictionBar({
  value,
  showValue = true,
  segments = 12,
  className,
}: {
  value: number
  showValue?: boolean
  /** Total segment count (split evenly around the center). */
  segments?: number
  className?: string
}) {
  const clamped = Math.max(-1, Math.min(1, value))
  const positive = clamped >= 0
  const half = Math.max(1, Math.floor(segments / 2))
  const filled = Math.round(Math.abs(clamped) * half)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-px" aria-hidden>
        {/* Left (bearish) segments — fill from center outward. */}
        {Array.from({ length: half }, (_, i) => {
          const active = !positive && i >= half - filled
          return (
            <span
              key={`l-${i}`}
              className={cn(
                "h-2 w-1 rounded-none",
                active ? "bg-destructive" : "bg-muted"
              )}
            />
          )
        })}
        <span className="mx-0.5 h-2.5 w-px bg-border" />
        {/* Right (bullish) segments — fill from center outward. */}
        {Array.from({ length: half }, (_, i) => {
          const active = positive && i < filled
          return (
            <span
              key={`r-${i}`}
              className={cn(
                "h-2 w-1 rounded-none",
                active ? "bg-success" : "bg-muted"
              )}
            />
          )
        })}
      </div>
      {showValue ? (
        <span
          className={cn(
            "w-11 shrink-0 text-right font-mono text-xs font-medium tabular-nums",
            pnlToneClass(clamped)
          )}
        >
          {formatSignedNumber(clamped)}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Analyst-agreement strip — one short bar per analyst signal, colored by its
 * sign (green agree-bullish, red disagree, muted neutral/abstain). Used in the
 * run-detail decision log; defaults to a compact 4-segment look.
 */
export function AgreementBar({
  values,
  size = "md",
  className,
}: {
  values: readonly number[]
  size?: "sm" | "md"
  className?: string
}) {
  const barWidth = size === "sm" ? "w-3" : "w-4"
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-hidden>
      {values.map((v, i) => {
        const tone =
          v > 0.15 ? "bg-success" : v < -0.15 ? "bg-destructive" : "bg-muted"
        return (
          <span
            key={i}
            className={cn("h-1.5 rounded-none", barWidth, tone)}
          />
        )
      })}
    </div>
  )
}

/**
 * A small segmented meter — `filled` of `total` cells lit in `tone`, the rest
 * muted. Static by design: a frequently-scanned inline indicator, so no
 * animation (Design.md frequency rule). Backs the advisor-agreement strip and
 * the "current view" 3-segment bar on the Fund overview.
 */
export function SegmentBar({
  filled,
  total,
  tone = "success",
  className,
}: {
  filled: number
  total: number
  tone?: "success" | "warning" | "muted"
  className?: string
}) {
  const toneClass =
    tone === "warning"
      ? "bg-warning"
      : tone === "muted"
        ? "bg-muted-foreground/50"
        : "bg-success"
  const lit = Math.max(0, Math.min(total, filled))
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-3 rounded-none",
            i < lit ? toneClass : "bg-muted"
          )}
        />
      ))}
    </div>
  )
}

/**
 * Labeled weight bar for a committee lineup entry. `weight` is a 0..1 share; it
 * renders as a percentage with a proportional bar.
 */
export function WeightBar({
  label,
  weight,
  className,
}: {
  label: string
  weight: number
  className?: string
}) {
  const pct = Math.round(Math.max(0, Math.min(1, weight)) * 100)
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-40 shrink-0 truncate font-mono text-xs text-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 bg-muted" aria-hidden>
        <span className="block h-full bg-chart-1" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </div>
  )
}
