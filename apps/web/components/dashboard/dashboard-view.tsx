"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon, Refresh01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type { DashboardData } from "./demo-data"
import { OverviewStats } from "./overview-stats"
import { PerformanceCard } from "./equity-chart"
import { AttentionPanel } from "./fund-monitor/attention-panel"
import { AttributionCard } from "./fund-monitor/attribution-card"
import { EngineOpsCard } from "./fund-monitor/engine-ops-card"
import { PositionsCard } from "./fund-monitor/positions-card"
import { RecentDecisionsCard } from "./fund-monitor/recent-decisions-card"
import { RiskCard } from "./fund-monitor/risk-card"

// Deterministic — the engine reports UTC, and a mocked timestamp must never vary
// between server and client render (keeps the /demo page prerenderable).
const AS_OF = "2025-05-15 14:32 UTC"

const PORTFOLIOS = [
  "Paper portfolio",
  "Live portfolio",
  "Backtest sandbox",
] as const

/**
 * Fund monitor — the engine's home surface: portfolio, risk, attribution, and
 * exceptions on one dense page. Purely presentational; every figure comes from
 * the deterministic fixtures in `demo-data`, so the same view backs both the
 * public `/demo` route and the authenticated `/dashboard` (the optional `notice`
 * renders the dashboard's "sample data" caveat next to the title). `data.equity`
 * feeds the performance chart; the rest reads the fund-monitor fixtures directly.
 */
export function DashboardView({
  data,
  notice,
}: {
  data: DashboardData
  notice?: React.ReactNode
}) {
  const pathname = usePathname()
  const basePath = pathname?.startsWith("/demo") ? "/demo" : "/dashboard"

  const [portfolio, setPortfolio] = React.useState<string>(PORTFOLIOS[0])

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Fund monitor
            </h1>
            {notice}
          </div>
          <p className="text-sm text-muted-foreground">
            Portfolio, risk, attribution, and exceptions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={portfolio}
            onValueChange={(next) => next && setPortfolio(next)}
          >
            <SelectTrigger aria-label="Select portfolio" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PORTFOLIOS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline">
            {AS_OF}
          </span>
          <Button variant="outline" size="icon" aria-label="Refresh">
            <HugeiconsIcon icon={Refresh01Icon} size={16} />
          </Button>
          <Button>
            <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} />
            New run
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <OverviewStats />

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left — positions, performance/attribution, decisions */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <PositionsCard />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
            <PerformanceCard data={data.equity} />
            <AttributionCard />
          </div>
          <RecentDecisionsCard basePath={basePath} />
        </div>

        {/* Right — attention, risk, engine operations */}
        <div className="flex flex-col gap-4">
          <AttentionPanel />
          <RiskCard basePath={basePath} />
          <EngineOpsCard basePath={basePath} />
        </div>
      </div>
    </div>
  )
}
