import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * StatBar — the KPI strip that tops every engine page: a single hairline-ringed
 * card whose cells are divided by thin vertical rules. Purely presentational and
 * composable — feed it any number of <StatItem>s (or arbitrary children).
 *
 * The dividers live on the items (`border-l`, cleared on the first of each row)
 * so the strip wraps gracefully on narrow screens without a trailing rule.
 */
function StatBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat-bar"
      role="group"
      className={cn(
        "flex flex-wrap items-stretch overflow-hidden rounded-none bg-card ring-1 ring-foreground/10",
        className
      )}
      {...props}
    />
  )
}

const STAT_VALUE_SIZE = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
} as const

const DELTA_TONE = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
} as const

type StatDelta = {
  /** Preformatted, e.g. "+0.81%". */
  label: string
  direction: keyof typeof DELTA_TONE
}

/**
 * One KPI cell: a small label, a large tabular value, an optional inline delta
 * and sub-hint, plus an optional right-aligned `status` slot (the check marks in
 * the Data page's health strip). `value` renders verbatim in mono figures, so
 * format it upstream.
 */
function StatItem({
  label,
  value,
  delta,
  hint,
  status,
  size = "md",
  valueClassName,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode
  value?: React.ReactNode
  delta?: StatDelta
  hint?: React.ReactNode
  /** Right-aligned adornment on the label row (e.g. a status icon). */
  status?: React.ReactNode
  size?: keyof typeof STAT_VALUE_SIZE
  valueClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="stat-item"
      className={cn(
        "flex min-w-[9rem] flex-1 flex-col gap-1 border-l border-border px-4 py-3 first:border-l-0",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {status ? <span className="shrink-0">{status}</span> : null}
      </div>
      {value != null ? (
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono font-semibold text-foreground tabular-nums",
              STAT_VALUE_SIZE[size],
              valueClassName
            )}
          >
            {value}
          </span>
          {delta ? (
            <span
              className={cn(
                "font-mono text-xs font-medium tabular-nums",
                DELTA_TONE[delta.direction]
              )}
            >
              {delta.label}
            </span>
          ) : null}
        </div>
      ) : null}
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
      {children}
    </div>
  )
}

export { StatBar, StatItem }
export type { StatDelta }
