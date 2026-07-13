"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useChartAnimation,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import type { EquityPoint } from "./demo-data"

// One series in a single chart uses the mid-ramp token — neither the lightest
// nor the darkest of the sequential cyan scale.
const equityConfig = {
  equity: { label: "Equity", color: "var(--chart-3)" },
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

export function EquityChart({ data }: { data: EquityPoint[] }) {
  const isAnimationActive = useChartAnimation()

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Equity curve</CardTitle>
        <CardDescription>Book equity, last 90 days (USD)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={equityConfig} className="aspect-auto h-64 w-full">
          <AreaChart data={data} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="fillEquity" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-equity)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-equity)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={13}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              domain={["dataMin - 200000", "dataMax + 200000"]}
              tickFormatter={(value: number) => usdCompact.format(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value) => (
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {usdFull.format(Number(value))}
                    </span>
                  )}
                />
              }
            />
            <Area
              dataKey="equity"
              type="monotone"
              stroke="var(--color-equity)"
              fill="url(#fillEquity)"
              strokeWidth={1.5}
              isAnimationActive={isAnimationActive}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
