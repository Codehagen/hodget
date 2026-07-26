"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@workspace/ui/lib/utils"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useChartAnimation,
  chartAnimationProps,
  type ChartConfig,
} from "@workspace/ui/components/chart"

import type { EquityPoint } from "./demo-data"
import { PERFORMANCE_LEGEND } from "./demo-data"

/**
 * Performance chart — book equity vs a 60/40 reference, with a range toggle and
 * a drawdown strip underneath. Card-less: it slots into the "What changed today"
 * card beside the top-contribution bars. The benchmark and drawdown series are
 * derived deterministically from the (already deterministic) equity curve, so
 * the whole block prerenders byte-identically on server and client. Both charts
 * follow the house chart rule: `isAnimationActive` from `useChartAnimation()`
 * with the container keyed on the same value (see Design.md §7).
 */

const RANGES = ["1D", "1M", "3M", "YTD", "1Y"] as const
type Range = (typeof RANGES)[number]

// Trailing-point counts per range over the ~90-day fixture curve.
const RANGE_POINTS: Record<Range, number | null> = {
  "1D": 2,
  "1M": 22,
  "3M": 66,
  YTD: null, // full curve
  "1Y": null,
}

type PerfPoint = {
  date: string
  portfolio: number
  benchmark: number
  drawdown: number
}

// Build portfolio + a dampened 60/40 benchmark + running-peak drawdown from the
// equity curve. Pure arithmetic on deterministic input.
function buildSeries(curve: EquityPoint[]): PerfPoint[] {
  if (curve.length === 0) return []
  const first = curve[0]!.equity
  let benchmark = first
  let peak = first
  const out: PerfPoint[] = []

  for (let i = 0; i < curve.length; i++) {
    const equity = curve[i]!.equity
    if (i > 0) {
      const r = equity / curve[i - 1]!.equity - 1
      // Dampen the portfolio's daily move and add a small steady drift — a
      // flatter reference that trails the book over the window.
      benchmark = benchmark * (1 + r * 0.45 + 0.0002)
    }
    if (equity > peak) peak = equity
    out.push({
      date: curve[i]!.date,
      portfolio: equity,
      benchmark: Math.round(benchmark),
      drawdown: Number((((equity - peak) / peak) * 100).toFixed(2)),
    })
  }
  return out
}

const perfConfig = {
  portfolio: {
    label: PERFORMANCE_LEGEND.portfolio.label,
    color: "var(--foreground)",
  },
  benchmark: {
    label: PERFORMANCE_LEGEND.benchmark.label,
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig

const usdCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
  currency: "USD",
  style: "currency",
})
const usdFull = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  currency: "USD",
  style: "currency",
})

export function PerformanceChart({ data }: { data: EquityPoint[] }) {
  const isAnimationActive = useChartAnimation()
  const [range, setRange] = React.useState<Range>("YTD")
  // Recharts replays its 400ms update tween on every data change. The mount
  // draw is welcome once; re-running it across series with different point
  // counts on every range click is an incoherent morph on a frequent
  // interaction. Keep the first draw, then go static after the first click.
  const [hasInteracted, setHasInteracted] = React.useState(false)

  const full = React.useMemo(() => buildSeries(data), [data])
  const series = React.useMemo(() => {
    const n = RANGE_POINTS[range]
    return n == null ? full : full.slice(-n)
  }, [full, range])

  // Effective animation flag drives BOTH the series `isAnimationActive` and the
  // container remount `key` together (chart contract, Design.md §7): when the
  // flag flips on first interaction the container remounts static so the range
  // change snaps instead of stranding a half-drawn tween.
  const animate = isAnimationActive && !hasInteracted
  const animKey = animate ? "animated" : "static"

  return (
    <div className="flex flex-col gap-2">
      {/* Range toggle */}
      <div className="flex items-center gap-0.5 self-start border border-border bg-card p-0.5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRange(r)
              setHasInteracted(true)
            }}
            aria-pressed={range === r}
            className={cn(
              "px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums transition-colors duration-[var(--duration-instant)] outline-none focus-visible:bg-muted/60",
              range === r
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Legend with period return */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-foreground" aria-hidden />
          {PERFORMANCE_LEGEND.portfolio.label}
          <span className="font-mono font-medium text-success tabular-nums">
            {PERFORMANCE_LEGEND.portfolio.return}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0 w-4 border-t border-dashed border-muted-foreground"
            aria-hidden
          />
          {PERFORMANCE_LEGEND.benchmark.label}
          <span className="font-mono font-medium text-success tabular-nums">
            {PERFORMANCE_LEGEND.benchmark.return}
          </span>
        </span>
      </div>

      <ChartContainer
        key={`line-${animKey}`}
        config={perfConfig}
        className="aspect-auto h-40 w-full"
      >
        <LineChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={52}
            domain={["dataMin - 150000", "dataMax + 150000"]}
            tickFormatter={(value: number) => usdCompact.format(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {perfConfig[name as keyof typeof perfConfig]?.label ??
                        name}
                    </span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {usdFull.format(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Line
            dataKey="benchmark"
            type="monotone"
            stroke="var(--color-benchmark)"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={animate}
            {...chartAnimationProps}
          />
          <Line
            dataKey="portfolio"
            type="monotone"
            stroke="var(--color-portfolio)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={animate}
            {...chartAnimationProps}
          />
        </LineChart>
      </ChartContainer>

      <div className="text-[11px] text-muted-foreground">Drawdown</div>
      <ChartContainer
        key={`dd-${animKey}`}
        config={{
          drawdown: { label: "Drawdown", color: "var(--destructive)" },
        }}
        className="aspect-auto h-14 w-full"
      >
        <AreaChart data={series} margin={{ left: 0, right: 8 }}>
          <defs>
            <linearGradient id="fillDrawdown" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--destructive)"
                stopOpacity={0.05}
              />
              <stop
                offset="100%"
                stopColor="var(--destructive)"
                stopOpacity={0.28}
              />
            </linearGradient>
          </defs>
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={52}
            domain={["dataMin", 0]}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
            ticks={[0]}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                formatter={(value) => (
                  <span className="font-mono font-medium text-destructive tabular-nums">
                    {Number(value).toFixed(2)}%
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="drawdown"
            type="monotone"
            stroke="var(--destructive)"
            strokeWidth={1}
            fill="url(#fillDrawdown)"
            isAnimationActive={animate}
            {...chartAnimationProps}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
