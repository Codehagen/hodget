"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  useChartAnimation,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartLineData02Icon } from "@hugeicons/core-free-icons"

import { Code, DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

/* ------------------------------------------------------------------ */
/* Demo data — static, illustrative only                              */
/* ------------------------------------------------------------------ */

// Time series: zero-filled per day, no gaps, two series max.
const activityData = [
  { date: "Jun 22", opened: 2, closed: 0 },
  { date: "Jun 23", opened: 1, closed: 1 },
  { date: "Jun 24", opened: 0, closed: 0 },
  { date: "Jun 25", opened: 3, closed: 2 },
  { date: "Jun 26", opened: 4, closed: 1 },
  { date: "Jun 27", opened: 0, closed: 0 },
  { date: "Jun 28", opened: 0, closed: 0 },
  { date: "Jun 29", opened: 2, closed: 3 },
  { date: "Jun 30", opened: 5, closed: 2 },
  { date: "Jul 1", opened: 3, closed: 4 },
  { date: "Jul 2", opened: 1, closed: 3 },
  { date: "Jul 3", opened: 0, closed: 1 },
  { date: "Jul 4", opened: 2, closed: 2 },
  { date: "Jul 5", opened: 4, closed: 3 },
]

const activityConfig = {
  opened: { label: "Positions opened", color: "var(--chart-2)" },
  closed: { label: "Positions closed", color: "var(--chart-5)" },
} satisfies ChartConfig

// Single series, ranked — horizontal bars.
const holdingsData = [
  { holding: "AAPL", weight: 8.4 },
  { holding: "MSFT", weight: 7.1 },
  { holding: "NVDA", weight: 6.2 },
  { holding: "AMZN", weight: 4.8 },
  { holding: "GOOGL", weight: 3.9 },
]

const holdingsConfig = {
  weight: { label: "Weight (%)", color: "var(--chart-3)" },
} satisfies ChartConfig

// Categorical breakdown, max 4 segments — direct labels + legend.
const statusData = [
  { status: "completed", label: "Completed", count: 18, fill: "var(--chart-5)" },
  {
    status: "running",
    label: "Running",
    count: 7,
    fill: "var(--chart-3)",
  },
  { status: "queued", label: "Queued", count: 5, fill: "var(--chart-1)" },
  {
    status: "failed",
    label: "Failed",
    count: 3,
    fill: "var(--muted-foreground)",
  },
]

// The keys match the `label` field in statusData — ChartLegendContent /
// ChartTooltipContent look up the config with the value from nameKey="label".
const statusConfig = {
  Completed: { label: "Completed", color: "var(--chart-5)" },
  Running: { label: "Running", color: "var(--chart-3)" },
  Queued: { label: "Queued", color: "var(--chart-1)" },
  Failed: { label: "Failed", color: "var(--muted-foreground)" },
} satisfies ChartConfig

export function ChartsSection() {
  const isAnimationActive = useChartAnimation()

  return (
    <Section
      id="charts"
      index="21"
      eyebrow="Components"
      title="Charts"
      intro={
        <>
          Built on <Code>recharts</Code> via <Code>ChartContainer</Code>. The
          color tokens <Code>--chart-1</Code>–<Code>--chart-5</Code> are a
          <Strong> sequential</Strong> cyan ramp (light → dark), not a
          categorical palette — use at most two series per chart (
          <Code>--chart-2</Code> primary, <Code>--chart-5</Code> secondary), or
          <Code>--chart-3</Code> alone for a single series. Never five separate
          categories on five different tokens without direct labels. One y-axis
          per chart, tooltip always on, legend from two series and up.
        </>
      }
    >
      <DemoGrid cols={2}>
        <DemoTile
          label="Area chart · 2 series · chart-2 + chart-5"
          className="items-stretch p-4"
        >
          <div className="flex w-full flex-col gap-3">
            <ChartContainer
              config={activityConfig}
              className="aspect-auto h-56 w-full"
            >
              <AreaChart key={isAnimationActive ? "animated" : "static"} data={activityData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="fillOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-opened)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-opened)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                  <linearGradient id="fillClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-closed)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-closed)"
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
                  interval={2}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={24}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Area
                  dataKey="opened"
                  type="monotone"
                  stroke="var(--color-opened)"
                  fill="url(#fillOpened)"
                  strokeWidth={1.5}
                  isAnimationActive={isAnimationActive}
                />
                <Area
                  dataKey="closed"
                  type="monotone"
                  stroke="var(--color-closed)"
                  fill="url(#fillClosed)"
                  strokeWidth={1.5}
                  isAnimationActive={isAnimationActive}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">
              Two series max — primary <Code>--chart-2</Code>, secondary{" "}
              <Code>--chart-5</Code>. Days are zero-filled, no gaps in the run.
            </p>
          </div>
        </DemoTile>

        <DemoTile
          label="Bar chart · 1 series, horizontal · chart-3"
          className="items-stretch p-4"
        >
          <div className="flex w-full flex-col gap-3">
            <ChartContainer
              config={holdingsConfig}
              className="aspect-auto h-56 w-full"
            >
              <BarChart
                key={isAnimationActive ? "animated" : "static"}
                data={holdingsData}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} hide />
                <YAxis
                  dataKey="holding"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" hideLabel />}
                />
                <Bar
                  dataKey="weight"
                  fill="var(--color-weight)"
                  radius={2}
                  barSize={14}
                  isAnimationActive={isAnimationActive}
                />
              </BarChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">
              A single series in a light context uses <Code>--chart-3</Code> —
              mid-ramp, neither the lightest nor the darkest.
            </p>
          </div>
        </DemoTile>

        <DemoTile
          label="Donut · max 4 segments · direct labels"
          className="items-stretch p-4"
        >
          <div className="flex w-full flex-col gap-3">
            <ChartContainer
              config={statusConfig}
              className="h-64 w-full"
            >
              <PieChart key={isAnimationActive ? "animated" : "static"} margin={{ top: 16, bottom: 8 }}>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="label" hideLabel />}
                />
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={46}
                  outerRadius={72}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${Math.round((percent ?? 0) * 100)}%`
                  }
                  labelLine={false}
                  isAnimationActive={isAnimationActive}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="label" />} />
              </PieChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">
              Four categories with a direct name on each segment (
              <Code>chart-1</Code>/<Code>chart-3</Code>/<Code>chart-5</Code> +{" "}
              <Code>muted-foreground</Code> for &quot;other&quot;) — never
              five+ tokens without labels.
            </p>
          </div>
        </DemoTile>

        <DemoTile
          label="Empty dataset — show <Empty />, never a blank chart"
          className="items-stretch p-4"
        >
          <Empty className="h-56 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ChartLineData02Icon} size={16} />
              </EmptyMedia>
              <EmptyTitle>No data yet</EmptyTitle>
              <EmptyDescription>
                Charts appear here as soon as there is activity to show.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>
}
