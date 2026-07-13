"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsStringLiteral, useQueryState } from "nuqs"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { DataTable } from "@workspace/ui/components/data-table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import type { DemoRun, RunMode, RunStatus } from "./demo-data"
import { SectionHeader } from "./primitives"
import { runColumns } from "./runs-table"

const STATUS_FILTERS = ["all", "queued", "running", "completed", "failed"] as const
const MODE_FILTERS = ["all", "backtest", "paper"] as const

const STATUS_LABELS: Record<(typeof STATUS_FILTERS)[number], string> = {
  all: "All",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
}

const MODE_LABELS: Record<(typeof MODE_FILTERS)[number], string> = {
  all: "All",
  backtest: "Backtest",
  paper: "Paper",
}

/** A single segmented toggle row — house-style, rounded-none, token colors. */
function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLabel,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  renderLabel: (option: T) => string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 border border-border bg-card p-0.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors duration-[var(--duration-instant)] motion-reduce:transition-none",
              value === option
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {renderLabel(option)}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The full run log: URL-backed status + mode filters (nuqs), then the shared
 * runs table. Row clicks route to the run detail under the current basePath.
 * All fixture data — the same view backs /demo and /dashboard.
 */
export function RunsView({
  basePath,
  runs,
}: {
  basePath: string
  runs: DemoRun[]
}) {
  const router = useRouter()

  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_FILTERS).withDefault("all")
  )
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsStringLiteral(MODE_FILTERS).withDefault("all")
  )

  const filtered = React.useMemo(
    () =>
      runs.filter(
        (run) =>
          (status === "all" || run.status === (status as RunStatus)) &&
          (mode === "all" || run.mode === (mode as RunMode))
      ),
    [runs, status, mode]
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Runs"
        description="Every engine cycle — backtests and paper runs across all strategies."
      />

      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Run log</CardTitle>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {filtered.length} of {runs.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <SegmentedFilter
              label="Status"
              options={STATUS_FILTERS}
              value={status}
              onChange={(next) => setStatus(next === "all" ? null : next)}
              renderLabel={(option) => STATUS_LABELS[option]}
            />
            <SegmentedFilter
              label="Mode"
              options={MODE_FILTERS}
              value={mode}
              onChange={(next) => setMode(next === "all" ? null : next)}
              renderLabel={(option) => MODE_LABELS[option]}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden border border-border">
            <DataTable
              data={filtered}
              columns={runColumns}
              getRowId={(run) => run.id}
              enableRowSelection={false}
              onRowClick={(run) => router.push(`${basePath}/runs/${run.id}`)}
              empty={
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No matching runs</EmptyTitle>
                    <EmptyDescription>
                      No runs match the current filters. Reset a filter to widen
                      the view.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
