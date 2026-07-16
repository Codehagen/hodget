import type { DashboardData } from "./demo-data"
import { DashboardHeaderControls } from "./dashboard-header-controls"
import { StatusStrip } from "./overview-stats"
import { AttentionPanel } from "./fund-monitor/attention-panel"
import { EngineOpsCard } from "./fund-monitor/engine-ops-card"
import { PositionsCard } from "./fund-monitor/positions-card"
import { RecentDecisionsCard } from "./fund-monitor/recent-decisions-card"
import { RiskCard } from "./fund-monitor/risk-card"
import { SystemTrustCard } from "./fund-monitor/system-trust-card"
import { WhatChangedCard } from "./fund-monitor/what-changed-card"

/**
 * Fund overview — the engine's home surface. Answers three questions on one
 * dense page: what the fund owns, why it changed today, and what needs a
 * human's attention. Purely presentational; every figure comes from the
 * deterministic fixtures in `demo-data`, so the same view backs both the public
 * `/demo` route and the authenticated `/dashboard` (the optional `notice`
 * renders the dashboard's "sample data" caveat next to the title). `data.equity`
 * feeds the performance chart; the rest reads the Fund-overview fixtures.
 *
 * A server component (plan 010): the page is ~95% static presentation, so the
 * only client island is {@link DashboardHeaderControls} (portfolio select,
 * refresh, New run dialog). `basePath` comes from the owning page instead of
 * usePathname so the whole card tree stays out of the client bundle.
 */
export function DashboardView({
  data,
  basePath,
  notice,
  source = "simulated",
}: {
  data: DashboardData
  basePath: string
  notice?: React.ReactNode
  /** Which data source backs the New-run dialog. `/dashboard` passes "real". */
  source?: "simulated" | "real"
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Fund overview
            </h1>
            {notice}
          </div>
          <p className="text-sm text-muted-foreground">
            What the fund owns, why it changed, and what needs attention.
          </p>
        </div>

        <DashboardHeaderControls basePath={basePath} source={source} />
      </div>

      {/* Status strip */}
      <StatusStrip />

      {/* Row 1 — what changed today + needs attention */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WhatChangedCard data={data.equity} />
        </div>
        <AttentionPanel />
      </div>

      {/* Row 2 — portfolio now + forward risk / why the system acted */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PositionsCard />
        </div>
        <div className="flex flex-col gap-4">
          <RiskCard basePath={basePath} />
          <EngineOpsCard basePath={basePath} />
        </div>
      </div>

      {/* Row 3 — recent decisions + system trust */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentDecisionsCard basePath={basePath} />
        </div>
        <SystemTrustCard />
      </div>
    </div>
  )
}
