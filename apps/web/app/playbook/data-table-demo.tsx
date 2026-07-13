"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { FilterIcon, Search01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  BulkActionBar,
  BulkActionButton,
} from "@workspace/ui/components/bulk-action-bar"
import { DataTable } from "@workspace/ui/components/data-table"
import { FilterPill } from "@workspace/ui/components/filter-pill"
import { Input } from "@workspace/ui/components/input"
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuTrigger,
} from "@workspace/ui/components/menu"

import {
  RUN_STATUSES,
  STATUS_LABELS,
  runColumns,
  type Run,
  type RunStatus,
} from "./runs"

const PAGE_SIZE = 6

// Static fixture — the playbook demo runs entirely in memory (no auth, no URL
// state). It models engine runs; the columns and badges match the real domain.
const ROWS: Run[] = (
  [
    ["run_9f2a10", "Momentum · Large Cap", "backtest", "completed", 24, 1.82, "2026-06-30T14:20:00.000Z"],
    ["run_9f2a11", "Mean Reversion · ETF", "paper", "running", 12, null, "2026-06-30T13:05:00.000Z"],
    ["run_9f2a12", "Value + Quality Blend", "backtest", "completed", 31, 2.14, "2026-06-30T11:47:00.000Z"],
    ["run_9f2a13", "Trend Following · Futures", "paper", "failed", 0, null, "2026-06-30T09:12:00.000Z"],
    ["run_9f2a14", "Low Volatility · Global", "backtest", "completed", 18, 0.96, "2026-06-29T18:40:00.000Z"],
    ["run_9f2a15", "Pairs · Sector Neutral", "backtest", "queued", 0, null, "2026-06-29T16:31:00.000Z"],
    ["run_9f2a16", "Carry · FX Basket", "paper", "completed", 9, 1.37, "2026-06-29T12:05:00.000Z"],
    ["run_9f2a17", "Breakout · Small Cap", "backtest", "running", 21, null, "2026-06-29T08:55:00.000Z"],
    ["run_9f2a18", "Dividend Growth", "backtest", "completed", 27, 1.05, "2026-06-28T20:18:00.000Z"],
    ["run_9f2a19", "Statistical Arb · US", "paper", "failed", 4, null, "2026-06-28T15:42:00.000Z"],
    ["run_9f2a1a", "Momentum · Emerging", "backtest", "completed", 15, -0.22, "2026-06-28T10:09:00.000Z"],
    ["run_9f2a1b", "Risk Parity · Multi-Asset", "backtest", "queued", 0, null, "2026-06-27T22:30:00.000Z"],
  ] as const
).map(([id, strategy, mode, status, positions, sharpe, createdAt]) => ({
  id: id as string,
  strategy: strategy as string,
  mode: mode as Run["mode"],
  status: status as RunStatus,
  positions: positions as number,
  sharpe: sharpe as number | null,
  createdAt: createdAt as string,
}))

export function PlaybookDataTable() {
  const [search, setSearch] = React.useState("")
  const [statuses, setStatuses] = React.useState<RunStatus[]>([])
  const [sort, setSort] = React.useState<{ field: string; dir: "asc" | "desc" }>(
    { field: "createdAt", dir: "desc" }
  )
  const [page, setPage] = React.useState(1)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const filtered = React.useMemo(() => {
    let rows = ROWS
    const q = search.trim().toLowerCase()
    if (q)
      rows = rows.filter(
        (r) =>
          r.strategy.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      )
    if (statuses.length) rows = rows.filter((r) => statuses.includes(r.status))
    const dir = sort.dir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.field === "sharpe") return ((a.sharpe ?? -99) - (b.sharpe ?? -99)) * dir
      if (sort.field === "strategy")
        return a.strategy.localeCompare(b.strategy) * dir
      if (sort.field === "id") return a.id.localeCompare(b.id) * dir
      return (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) * dir
    })
  }, [search, statuses, sort])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page + selection when the filtered set changes (render-time adjust).
  const sig = `${search}|${statuses.join(",")}|${sort.field}:${sort.dir}`
  const [prevSig, setPrevSig] = React.useState(sig)
  if (prevSig !== sig) {
    setPrevSig(sig)
    setPage(1)
    setRowSelection({})
  }
  const [prevPage, setPrevPage] = React.useState(page)
  if (prevPage !== page) {
    setPrevPage(page)
    setRowSelection({})
  }

  function onSortChange(field: string) {
    setSort((s) =>
      field === s.field
        ? { field, dir: s.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    )
  }
  function toggleStatus(s: RunStatus) {
    setStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  const selectedIds = Object.keys(rowSelection)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search runs…"
            className="pl-9"
            aria-label="Search runs"
          />
        </div>
        <Menu>
          <MenuTrigger className="inline-flex h-10 shrink-0 items-center gap-2 rounded-none border border-border bg-background px-3.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring/50">
            <HugeiconsIcon icon={FilterIcon} size={16} />
            Status
            {statuses.length > 0 ? (
              <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground">
                {statuses.length}
              </span>
            ) : null}
          </MenuTrigger>
          <MenuContent align="end">
            {RUN_STATUSES.map((s) => (
              <MenuCheckboxItem
                key={s}
                checked={statuses.includes(s)}
                onCheckedChange={() => toggleStatus(s)}
              >
                {STATUS_LABELS[s]}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </Menu>
      </div>

      {search.trim() || statuses.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2">
          {search.trim() ? (
            <li className="flex">
              <FilterPill
                label={`“${search.trim()}”`}
                onRemove={() => setSearch("")}
              />
            </li>
          ) : null}
          {statuses.map((s) => (
            <li key={s} className="flex">
              <FilterPill
                label={STATUS_LABELS[s]}
                onRemove={() => toggleStatus(s)}
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setStatuses([])
              }}
              className="px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          </li>
        </ul>
      ) : null}

      <div className="overflow-hidden border border-border">
        <DataTable
          data={pageRows}
          columns={runColumns}
          getRowId={(r) => r.id}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          sort={sort}
          onSortChange={onSortChange}
          empty={
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <p className="font-heading text-base font-semibold text-foreground">
                No runs match
              </p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setStatuses([])
                }}
                className="mt-2"
              >
                Clear filters
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3">
          <span className="font-mono text-xs text-muted-foreground">
            {total} {total === 1 ? "result" : "results"} · page {page} /{" "}
            {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <BulkActionBar
        count={selectedIds.length}
        onDeselect={() => setRowSelection({})}
      >
        <BulkActionButton
          onClick={() => navigator.clipboard?.writeText(selectedIds.join(", "))}
        >
          Export
        </BulkActionButton>
        <BulkActionButton onClick={() => setRowSelection({})}>
          Archive
        </BulkActionButton>
      </BulkActionBar>
    </div>
  )
}
