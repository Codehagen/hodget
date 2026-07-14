"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons"
import { parseAsStringLiteral, useQueryState } from "nuqs"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  MasterDetail,
  MasterDetailList,
} from "@workspace/ui/components/master-detail"

import { RUN_HISTORY, RUN_HISTORY_TOTAL } from "./demo-data"
import { SectionHeader } from "./primitives"
import { RunsSummary } from "./runs/runs-summary"
import {
  RunsToolbar,
  type ModeFilter,
  type StatusFilter,
} from "./runs/runs-toolbar"
import { RunHistoryTable } from "./runs/run-history-table"
import { RunInspector } from "./runs/run-inspector"

const MODE_VALUES = ["all", "backtest", "paper"] as const
const STATUS_VALUES = ["all", "running", "queued", "completed", "failed"] as const

/** Distinct strategy names in the run history, for the strategy filter select. */
const STRATEGY_OPTIONS = Array.from(
  new Set(RUN_HISTORY.map((run) => run.strategy))
)

/** Static, presentational pager — the fixtures are a single page of 48 total. */
function Pagination({ shown, total }: { shown: number; total: number }) {
  const [page, setPage] = React.useState(1)
  const pages = [1, 2, 3, 4, 5]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Showing <span className="tabular-nums">1</span> to{" "}
        <span className="tabular-nums">{shown}</span> of{" "}
        <span className="tabular-nums">{total}</span> runs
      </p>
      <nav className="flex items-center gap-1" aria-label="Run history pages">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="inline-flex size-7 items-center justify-center border border-input text-muted-foreground transition-colors duration-[var(--duration-instant)] hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} />
        </button>
        {pages.map((p) => {
          const active = p === page
          return (
            <button
              key={p}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setPage(p)}
              className={cn(
                "inline-flex size-7 items-center justify-center font-mono text-xs tabular-nums transition-colors duration-[var(--duration-instant)]",
                active
                  ? "border border-input bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p}
            </button>
          )
        })}
        <span className="px-1 text-xs text-muted-foreground">…</span>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => setPage((p) => p + 1)}
          className="inline-flex size-7 items-center justify-center border border-input text-muted-foreground transition-colors duration-[var(--duration-instant)] hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
        </button>
      </nav>
    </div>
  )
}

/**
 * The Runs page: a live status strip, a filterable dense run-history table, and
 * a closable inspector that opens for the selected run. The same view backs
 * `/demo` (public) and `/dashboard` (session-guarded) — `basePath` routes the
 * jump links. All fixture data for now; filter + selection state is client-side
 * and instant (no row-select animation, per Design.md's frequency rule).
 */
export function RunsView({ basePath }: { basePath: string }) {
  const [query, setQuery] = React.useState("")
  const [strategy, setStrategy] = React.useState("all")
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsStringLiteral(MODE_VALUES).withDefault("all")
  )
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_VALUES).withDefault("all")
  )
  // Open on the live run by default, matching the mock.
  const [selectedId, setSelectedId] = React.useState<string | null>(
    RUN_HISTORY[0]?.id ?? null
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return RUN_HISTORY.filter((run) => {
      if (mode !== "all" && run.mode !== mode) return false
      if (status !== "all" && run.status !== status) return false
      if (strategy !== "all" && run.strategy !== strategy) return false
      if (
        q &&
        !run.id.toLowerCase().includes(q) &&
        !run.strategy.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [query, mode, status, strategy])

  const selectedRow = React.useMemo(
    () => RUN_HISTORY.find((run) => run.id === selectedId) ?? null,
    [selectedId]
  )

  function handleReset() {
    setQuery("")
    setStrategy("all")
    void setMode(null)
    void setStatus(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Runs"
        description="Every engine cycle — backtests and paper runs across all strategies."
        actions={
          <Button>
            <HugeiconsIcon icon={PlusSignIcon} size={15} strokeWidth={2} />
            New run
          </Button>
        }
      />

      <RunsSummary basePath={basePath} />

      <MasterDetail
        className={cn(
          "gap-6",
          selectedRow ? "lg:grid-cols-[1fr_340px]" : "lg:grid-cols-1"
        )}
      >
        <MasterDetailList>
          <div className="flex flex-col rounded-none bg-card ring-1 ring-foreground/10">
            <div className="border-b border-border p-3">
              <RunsToolbar
                query={query}
                onQueryChange={setQuery}
                mode={mode as ModeFilter}
                onModeChange={(next) => setMode(next === "all" ? null : next)}
                status={status as StatusFilter}
                onStatusChange={(next) =>
                  setStatus(next === "all" ? null : next)
                }
                strategy={strategy}
                onStrategyChange={setStrategy}
                strategies={STRATEGY_OPTIONS}
                onReset={handleReset}
              />
            </div>

            <div className="px-4 pt-4 pb-2">
              <h2 className="font-heading text-sm font-semibold text-foreground">
                Run history
              </h2>
            </div>

            {filtered.length > 0 ? (
              <>
                <RunHistoryTable
                  rows={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <Pagination shown={filtered.length} total={RUN_HISTORY_TOTAL} />
              </>
            ) : (
              <div className="px-4 pb-6">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No matching runs</EmptyTitle>
                    <EmptyDescription>
                      No runs match the current filters. Reset a filter to widen
                      the view.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )}
          </div>
        </MasterDetailList>

        {selectedRow ? (
          <RunInspector
            row={selectedRow}
            basePath={basePath}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </MasterDetail>
    </div>
  )
}
