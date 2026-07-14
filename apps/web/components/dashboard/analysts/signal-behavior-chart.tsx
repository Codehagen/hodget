"use client"

import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  useChartAnimation,
  chartAnimationProps,
  type ChartConfig,
} from "@workspace/ui/components/chart"

/**
 * "Signal behavior (90d)" — avg realized outcome by conviction decile. Low
 * deciles sit below the zero baseline (red), high deciles above it (green): a
 * monotone climb is the shape of a signal whose conviction actually predicts
 * outcome. Follows the Design.md chart rule — every series carries
 * `isAnimationActive={useChartAnimation()}` and the container is keyed on the
 * same value so a reduced-motion flip remounts instead of stranding geometry.
 */

const chartConfig = {
  outcome: { label: "Avg outcome" },
  positive: { label: "Strong positive relationship", color: "var(--success)" },
  negative: { label: "Weak / negative", color: "var(--destructive)" },
} satisfies ChartConfig

const Y_TICKS = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]

/** Turn the raw decile array into charted rows with 1 (Low) .. 10 (High) ticks. */
function toRows(deciles: readonly number[]) {
  const last = deciles.length - 1
  return deciles.map((value, i) => ({
    tick: i === 0 ? "1 (Low)" : i === last ? "10 (High)" : String(i + 1),
    value,
  }))
}

export function SignalBehaviorChart({
  deciles,
}: {
  deciles: readonly number[]
}) {
  const isAnimationActive = useChartAnimation()
  const rows = toRows(deciles)

  return (
    <ChartContainer
      key={isAnimationActive ? "animated" : "static"}
      config={chartConfig}
      className="aspect-auto h-[220px] w-full [&_.recharts-cartesian-axis-tick_text]:font-mono [&_.recharts-cartesian-axis-tick_text]:tabular-nums"
    >
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 20, left: 8 }}>
        <YAxis
          domain={[-1.5, 1.5]}
          ticks={Y_TICKS}
          tickLine={false}
          axisLine={false}
          width={44}
          tickMargin={4}
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          label={{
            value: "Avg outcome (realized return)",
            angle: -90,
            position: "insideLeft",
            style: {
              fontSize: 10,
              textAnchor: "middle",
              fill: "var(--muted-foreground)",
            },
          }}
        />
        <XAxis
          dataKey="tick"
          tickLine={false}
          axisLine={false}
          interval={0}
          tickMargin={8}
          label={{
            value: "Conviction decile",
            position: "insideBottom",
            offset: -12,
            style: { fontSize: 11, fill: "var(--muted-foreground)" },
          }}
        />
        <ReferenceLine
          y={0}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <Bar dataKey="value" radius={0} isAnimationActive={isAnimationActive} {...chartAnimationProps}>
          {rows.map((row) => (
            <Cell
              key={row.tick}
              fill={
                row.value >= 0
                  ? "var(--color-positive)"
                  : "var(--color-negative)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
