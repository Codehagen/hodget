"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"

type ScoreBand = "high" | "medium" | "low"

const BAND_META: Record<
  ScoreBand,
  {
    label: string
    badgeVariant: React.ComponentProps<typeof Badge>["variant"]
    textClass: string
    barClass: string
    ringClass: string
  }
> = {
  high: {
    label: "High",
    badgeVariant: "green",
    textClass: "text-chart-2",
    barClass: "[&_[data-slot=progress-indicator]]:bg-chart-2",
    ringClass: "stroke-chart-2",
  },
  medium: {
    label: "Medium",
    badgeVariant: "amber",
    textClass: "text-chart-4",
    barClass: "[&_[data-slot=progress-indicator]]:bg-chart-4",
    ringClass: "stroke-chart-4",
  },
  low: {
    label: "Low",
    badgeVariant: "red",
    textClass: "text-chart-5",
    barClass: "[&_[data-slot=progress-indicator]]:bg-chart-5",
    ringClass: "stroke-chart-5",
  },
}

function scoreBand(score: number): ScoreBand {
  if (score > 70) return "high"
  if (score >= 30) return "medium"
  return "low"
}

function clampScore(value: number, max = 100) {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), max)
}

function ScoreBadge({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  const value = clampScore(score)
  const meta = BAND_META[scoreBand(value)]

  return (
    <Badge variant={meta.badgeVariant} className={className}>
      {meta.label}
      <span className="font-mono tabular-nums">{value}</span>
    </Badge>
  )
}

function ScoreMeter({
  score,
  label = "Score",
  className,
}: {
  score: number
  label?: string
  className?: string
}) {
  const value = clampScore(score)
  const meta = BAND_META[scoreBand(value)]

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-3xl font-semibold tracking-normal tabular-nums",
                meta.textClass
              )}
            >
              {value}
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              /100
            </span>
          </div>
        </div>
        <ScoreBadge score={value} />
      </div>
      <Progress
        value={value}
        aria-label={`${label}: ${value} av 100`}
        className={cn("gap-0", meta.barClass)}
      />
    </div>
  )
}

/**
 * Circular score gauge, drawn with the `--chart-*` band tokens (so it flips in
 * dark mode and matches <ScoreMeter />). Pass `children` to render content in
 * the centre (e.g. the number); omit it for a compact decorative gauge.
 */
function ScoreRing({
  score,
  size = 120,
  stroke = 10,
  className,
  children,
}: {
  score: number
  size?: number
  stroke?: number
  className?: string
  children?: React.ReactNode
}) {
  const value = clampScore(score)
  const meta = BAND_META[scoreBand(value)]
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (value / 100) * circumference

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={meta.ringClass}
        />
      </svg>
      {children !== undefined ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function SignalBar({
  label,
  points,
  max,
  state,
  icon,
  inline = false,
  className,
}: {
  label: string
  points: number
  max: number
  state?: string | null
  /** Optional leading icon chip (token-tinted). */
  icon?: IconSvgElement
  /** Single-row meter (icon · label · bar · value) instead of stacked. */
  inline?: boolean
  className?: string
}) {
  const safeMax = Math.max(max, 0)
  const safePoints = clampScore(points, safeMax)
  const value = safeMax > 0 ? (safePoints / safeMax) * 100 : 0

  const chip = icon ? (
    <span className="flex size-7 shrink-0 items-center justify-center bg-muted text-chart-2">
      <HugeiconsIcon icon={icon} size={15} />
    </span>
  ) : null

  if (inline) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {chip}
        <span className="w-28 shrink-0 truncate text-sm text-foreground">
          {label}
        </span>
        <Progress
          value={value}
          aria-label={`${label}: ${safePoints} av ${safeMax}`}
          className="flex-1 gap-0 [&_[data-slot=progress-indicator]]:bg-chart-1"
        />
        <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {safePoints} / {safeMax}
        </span>
      </div>
    )
  }

  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      {chip}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {label}
            </div>
            {state ? (
              <div className="truncate text-xs text-muted-foreground">
                {state}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {safePoints}/{safeMax}
          </div>
        </div>
        <Progress
          value={value}
          aria-label={`${label}: ${safePoints} av ${safeMax}`}
          className="gap-0 [&_[data-slot=progress-indicator]]:bg-chart-1"
        />
      </div>
    </div>
  )
}

export { ScoreMeter, ScoreRing, SignalBar, ScoreBadge, scoreBand }
export type { ScoreBand }
