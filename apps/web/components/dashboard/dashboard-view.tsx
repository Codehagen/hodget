import type * as React from "react"

import type { DashboardData } from "./demo-data"
import { EquityChart } from "./equity-chart"
import { OverviewStats } from "./overview-stats"
import { RunsTable } from "./runs-table"
import { StatusDonut } from "./status-donut"

/**
 * The full dashboard body: header row, KPI cards, equity curve + run-status
 * breakdown, then the recent-runs table. Purely presentational — all data
 * arrives through `data`, so the same view backs both the public `/demo` page
 * and the authenticated `/dashboard`. An optional `notice` renders under the
 * header (e.g. a "live data coming" note on the real dashboard).
 */
export function DashboardView({
  data,
  notice,
}: {
  data: DashboardData
  notice?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          {notice}
        </div>
        <p className="text-sm text-muted-foreground">
          Your engine at a glance.
        </p>
      </div>

      <OverviewStats stats={data.stats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EquityChart data={data.equity} />
        </div>
        <div className="lg:col-span-1">
          <StatusDonut data={data.statusBreakdown} />
        </div>
      </div>

      <RunsTable runs={data.runs} />
    </div>
  )
}
