"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import type { RunHistoryRow, RunMode } from "../demo-data"
import { formatSignedPercent, pnlToneClass } from "../format"
import { StatusPill } from "../primitives"
import { RunProgress } from "./run-progress"

const MODE_LABEL: Record<RunMode, string> = {
  backtest: "Backtest",
  paper: "Paper",
}

/** Sentence-case, sans header — overrides the shared uppercase mono head. */
function HeadCell({
  children,
  className,
  sortedDesc,
}: {
  children?: React.ReactNode
  className?: string
  sortedDesc?: boolean
}) {
  return (
    <TableHead
      className={cn(
        "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground",
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortedDesc ? (
          <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={2} />
        ) : null}
      </span>
    </TableHead>
  )
}

export function RunHistoryTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: readonly RunHistoryRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <HeadCell>Run</HeadCell>
          <HeadCell>Strategy</HeadCell>
          <HeadCell>Mode</HeadCell>
          <HeadCell>Status</HeadCell>
          <HeadCell>Progress</HeadCell>
          <HeadCell>Universe</HeadCell>
          <HeadCell sortedDesc>Started</HeadCell>
          <HeadCell>Duration</HeadCell>
          <HeadCell>Sharpe</HeadCell>
          <HeadCell>Return</HeadCell>
          <HeadCell className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const selected = row.id === selectedId
          return (
            <TableRow
              key={row.id}
              data-state={selected ? "selected" : undefined}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => onSelect(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelect(row.id)
                }
              }}
              className="h-11 cursor-pointer outline-none focus-visible:bg-muted/60"
            >
              <TableCell className="font-mono text-xs text-muted-foreground">
                {row.id}
              </TableCell>
              <TableCell className="font-mono text-sm text-foreground">
                {row.strategy}
              </TableCell>
              <TableCell className="text-sm text-foreground">
                {MODE_LABEL[row.mode]}
              </TableCell>
              <TableCell>
                <StatusPill status={row.status} appearance="dot" />
              </TableCell>
              <TableCell className="w-36">
                <RunProgress
                  value={row.progressPct}
                  status={row.status}
                  trackClassName="w-16 flex-none"
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.universe}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                {row.startedAt}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                {row.durationLabel ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-sm text-foreground tabular-nums">
                {row.sharpe == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  row.sharpe.toFixed(2)
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "font-mono text-sm font-medium tabular-nums",
                  row.returnPct == null
                    ? "text-muted-foreground"
                    : pnlToneClass(row.returnPct)
                )}
              >
                {row.returnPct == null ? "—" : formatSignedPercent(row.returnPct)}
              </TableCell>
              <TableCell className="pr-2 text-right">
                <button
                  type="button"
                  aria-label={`Actions for ${row.id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect(row.id)
                  }}
                  className="inline-flex size-6 items-center justify-center rounded-none text-muted-foreground transition-colors duration-[var(--duration-instant)] hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <HugeiconsIcon icon={MoreVerticalIcon} size={16} strokeWidth={2} />
                </button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
