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
import { LiveRunDialog } from "./live-run/live-run-dialog"
import { StatusStrip } from "./overview-stats"
import { AttentionPanel } from "./fund-monitor/attention-panel"
import { EngineOpsCard } from "./fund-monitor/engine-ops-card"
import { PositionsCard } from "./fund-monitor/positions-card"
import { RecentDecisionsCard } from "./fund-monitor/recent-decisions-card"
import { RiskCard } from "./fund-monitor/risk-card"
import { SystemTrustCard } from "./fund-monitor/system-trust-card"
import { WhatChangedCard } from "./fund-monitor/what-changed-card"

// Deterministic — the engine reports UTC, and a mocked timestamp must never vary
// between server and client render (keeps the /demo page prerenderable). The
// mock's 2026 clock is the mock's own; the fixtures keep the 2025-05-15 clock.
const AS_OF = "2025-05-15 14:32 UTC"

const PORTFOLIOS = [
  "Paper portfolio",
  "Live portfolio",
  "Backtest sandbox",
] as const

/**
 * Fund overview — the engine's home surface. Answers three questions on one
 * dense page: what the fund owns, why it changed today, and what needs a
 * human's attention. Purely presentational; every figure comes from the
 * deterministic fixtures in `demo-data`, so the same view backs both the public
 * `/demo` route and the authenticated `/dashboard` (the optional `notice`
 * renders the dashboard's "sample data" caveat next to the title). `data.equity`
 * feeds the performance chart; the rest reads the Fund-overview fixtures.
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
              Fund overview
            </h1>
            {notice}
          </div>
          <p className="text-sm text-muted-foreground">
            What the fund owns, why it changed, and what needs attention.
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
          <LiveRunDialog
            basePath={basePath}
            trigger={
              <Button>
                <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} />
                New run
              </Button>
            }
          />
        </div>
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
