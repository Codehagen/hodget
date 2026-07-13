"use client"

import { Cell, Pie, PieChart } from "recharts"

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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import type { StatusSlice } from "./demo-data"

// Keys match each slice's `label`; ChartLegend/Tooltip look the config up via
// nameKey="label".
const statusConfig = {
  Completed: { label: "Completed", color: "var(--chart-5)" },
  Running: { label: "Running", color: "var(--chart-3)" },
  Queued: { label: "Queued", color: "var(--chart-1)" },
  Failed: { label: "Failed", color: "var(--muted-foreground)" },
} satisfies ChartConfig

export function StatusDonut({ data }: { data: StatusSlice[] }) {
  const isAnimationActive = useChartAnimation()
  const total = data.reduce((sum, slice) => sum + slice.count, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Runs by status</CardTitle>
        <CardDescription>{total} runs in the last 48 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={statusConfig} className="mx-auto h-64 w-full">
          <PieChart margin={{ top: 8, bottom: 8 }}>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="label" hideLabel />}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius={48}
              outerRadius={76}
              paddingAngle={2}
              isAnimationActive={isAnimationActive}
            >
              {data.map((slice) => (
                <Cell key={slice.status} fill={slice.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="label" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
