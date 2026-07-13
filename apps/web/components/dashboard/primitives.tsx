import type * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"

import type { AnalystKind, CoverageState } from "./demo-data"

/**
 * Shared, purely-presentational building blocks for the engine pages. No
 * "use client" — every piece here is static markup, so it renders on the server
 * and keeps the /demo routes prerenderable.
 */

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

/** Kind badge for an analyst — Quant vs LLM, token-consistent. */
export function AnalystKindBadge({ kind }: { kind: AnalystKind }) {
  return kind === "quant" ? (
    <Badge variant="sky">Quant</Badge>
  ) : (
    <Badge variant="violet">LLM</Badge>
  )
}

/**
 * Signed conviction meter, [-1, 1]. A centered baseline with the magnitude
 * filling left (bearish) or right (bullish); the signed value trails in mono.
 */
export function ConvictionBar({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const clamped = Math.max(-1, Math.min(1, value))
  const pct = Math.abs(clamped) * 50
  const positive = clamped >= 0
  const signed = `${clamped > 0 ? "+" : ""}${clamped.toFixed(2)}`

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-1.5 w-24 shrink-0 bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <span
          className={cn(
            "absolute inset-y-0",
            positive ? "left-1/2 bg-chart-2" : "right-1/2 bg-chart-5"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "w-11 shrink-0 text-right font-mono text-xs font-medium tabular-nums",
          positive ? "text-chart-2" : "text-chart-5"
        )}
      >
        {signed}
      </span>
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
        <span
          className="block h-full bg-chart-1"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </div>
  )
}

const COVERAGE_META: Record<
  CoverageState,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  covered: { label: "Covered", variant: "green" },
  "covered-empty": { label: "Empty", variant: "amber" },
  "not-covered": { label: "Not covered", variant: "neutral" },
}

/** Coverage-state chip — covered / covered-empty / not-covered. */
export function CoverageBadge({ state }: { state: CoverageState }) {
  const meta = COVERAGE_META[state]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}
