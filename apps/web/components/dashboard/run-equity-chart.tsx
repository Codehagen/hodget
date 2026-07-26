"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useChartAnimation,
  chartAnimationProps,
  type ChartConfig,
} from "@workspace/ui/components/chart"

import type { EquityPoint } from "./demo-data"

/**
 * Portfolio-equity panel for a single run: an indexed equity line (rebased to
 * 100) stacked over a drawdown-from-peak strip, sharing one x-axis. Both series
 * are derived from the run's raw USD equity curve, so the shape stays wired to
 * the passed-in run data while the header/legend figures come from the run's
 * reported metrics.
 *
 * Recharts contract (Design.md §7): every series takes `isAnimationActive` from
 * useChartAnimation AND each chart root is keyed on that same value — both are
 * required or the series can render invisible after a reduced-motion resolve.
 */

const equityConfig = {
  equity: { label: "Equity", color: "var(--chart-5)" },
} satisfies ChartConfig

const drawdownConfig = {
  drawdown: { label: "Drawdown", color: "var(--destructive)" },
} satisfies ChartConfig

type EquityRow = { date: string; index: number; drawdown: number }

/** Rebase to 100 and compute running drawdown-from-peak (always ≤ 0). */
function buildSeries(data: EquityPoint[]): EquityRow[] {
  const first = data[0]?.equity ?? 1
  let peak = first
  return data.map((p) => {
    if (p.equity > peak) peak = p.equity
    return {
      date: p.date,
      index: (p.equity / first) * 100,
      drawdown: (p.equity / peak - 1) * 100,
    }
  })
}

export function RunEquityChart({
  data,
  totalReturnLabel,
  maxDrawdownLabel,
  window = "YTD",
}: {
  data: EquityPoint[]
  /** Preformatted, e.g. "+6.52%". */
  totalReturnLabel: string
  /** Preformatted, e.g. "-4.20%". */
  maxDrawdownLabel: string
  window?: string
}) {
  const isAnimationActive = useChartAnimation()
  const rows = buildSeries(data)
  const animKey = isAnimationActive ? "animated" : "static"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 bg-[var(--chart-5)]" aria-hidden />
            <span className="text-muted-foreground">Equity (USD)</span>
            <span className="font-mono font-medium text-success tabular-nums">
              {totalReturnLabel}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 bg-destructive" aria-hidden />
            <span className="text-muted-foreground">Drawdown</span>
            <span className="font-mono font-medium text-destructive tabular-nums">
              {maxDrawdownLabel}
            </span>
          </span>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {window}
        </span>
      </div>

      <ChartContainer
        key={`equity-${animKey}`}
        config={equityConfig}
        className="aspect-auto h-44 w-full"
      >
        <LineChart data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={40}
            domain={["dataMin - 1", "dataMax + 1"]}
            tickFormatter={(value: number) => value.toFixed(0)}
          />
          <ReferenceLine
            y={100}
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="dot"
                labelKey="date"
                formatter={(value) => (
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {Number(value).toFixed(2)}
                  </span>
                )}
              />
            }
          />
          <Line
            dataKey="index"
            name="Equity"
            type="monotone"
            stroke="var(--color-equity)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={isAnimationActive}
            {...chartAnimationProps}
          />
        </LineChart>
      </ChartContainer>

      <ChartContainer
        key={`drawdown-${animKey}`}
        config={drawdownConfig}
        className="aspect-auto h-24 w-full"
      >
        <AreaChart data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillRunDrawdown" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-drawdown)"
                stopOpacity={0.05}
              />
              <stop
                offset="95%"
                stopColor="var(--color-drawdown)"
                stopOpacity={0.35}
              />
            </linearGradient>
          </defs>
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
            width={40}
            domain={["dataMin", 0]}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="dot"
                labelKey="date"
                formatter={(value) => (
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {Number(value).toFixed(2)}%
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="drawdown"
            name="Drawdown"
            type="monotone"
            stroke="var(--color-drawdown)"
            fill="url(#fillRunDrawdown)"
            strokeWidth={1}
            isAnimationActive={isAnimationActive}
            {...chartAnimationProps}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
