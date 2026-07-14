import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import {
  CONTRIBUTION_AXIS,
  TOP_CONTRIBUTION,
  WHAT_CHANGED_HEADLINE,
  type ContributionRow,
  type EquityPoint,
} from "../demo-data"
import { formatBps, pnlToneClass } from "../format"
import { PerformanceChart } from "../equity-chart"

/* Top-contribution bars — signed bp, drawn from a shared zero line over a fixed
 * −20bp … +60bp axis so the whole panel reads on one scale. Static (no motion):
 * a dense, at-a-glance readout, per the Design.md frequency rule. */

const { min: AXIS_MIN, max: AXIS_MAX } = CONTRIBUTION_AXIS
const AXIS_RANGE = AXIS_MAX - AXIS_MIN
const ZERO_PCT = ((0 - AXIS_MIN) / AXIS_RANGE) * 100
const AXIS_TICKS = [-20, 0, 20, 40, 60]

function ContributionBar({ row }: { row: ContributionRow }) {
  const width = (Math.abs(row.bp) / AXIS_RANGE) * 100
  const positive = row.bp >= 0
  const left = positive ? ZERO_PCT : ZERO_PCT - width

  return (
    <div className="grid grid-cols-[3.25rem_1fr_3rem] items-center gap-2">
      <span className="font-mono text-xs font-medium text-foreground">
        {row.security}
      </span>
      <div className="relative h-4">
        <span
          className="absolute inset-y-0 w-px bg-border"
          style={{ left: `${ZERO_PCT}%` }}
          aria-hidden
        />
        <span
          className={cn(
            "absolute top-1/2 h-2.5 -translate-y-1/2",
            positive ? "bg-success" : "bg-destructive"
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
          aria-hidden
        />
      </div>
      <span
        className={cn(
          "text-right font-mono text-xs font-medium tabular-nums",
          pnlToneClass(row.bp)
        )}
      >
        {formatBps(row.bp)}
      </span>
    </div>
  )
}

function TopContribution() {
  return (
    <div className="flex flex-col gap-3 lg:border-l lg:border-border lg:pl-5">
      <span className="text-xs font-medium text-muted-foreground">
        Top contribution (today)
      </span>
      <div className="flex flex-col gap-2.5">
        {TOP_CONTRIBUTION.map((row) => (
          <ContributionBar key={row.security} row={row} />
        ))}
      </div>
      {/* Axis */}
      <div className="grid grid-cols-[3.25rem_1fr_3rem] items-center gap-2">
        <span />
        <div className="relative h-4 text-[10px] text-muted-foreground tabular-nums">
          {AXIS_TICKS.map((t) => (
            <span
              key={t}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((t - AXIS_MIN) / AXIS_RANGE) * 100}%` }}
            >
              {t === 0 ? "0" : formatBps(t)}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  )
}

/**
 * "What changed today" — the lead card of the Fund overview. A plain-language
 * headline over the performance chart (book vs 60/40 benchmark, with a drawdown
 * strip), and the day's top contributors as signed bp bars alongside. `data` is
 * the deterministic equity curve; every other figure comes from fixtures.
 */
export function WhatChangedCard({ data }: { data: EquityPoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>What changed today</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg font-semibold tracking-tight text-balance text-foreground">
          {WHAT_CHANGED_HEADLINE}
        </p>
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <PerformanceChart data={data} />
          <TopContribution />
        </div>
      </CardContent>
    </Card>
  )
}
