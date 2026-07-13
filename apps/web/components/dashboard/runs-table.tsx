"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { DataTable } from "@workspace/ui/components/data-table"

import type { DemoRun, RunMode, RunStatus } from "./demo-data"

/* ------------------------------------------------------------------ */
/* Status + mode badges — production variant of the run state machine  */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
}

const MODE_LABELS: Record<RunMode, string> = {
  backtest: "Backtest",
  paper: "Paper",
}

const STATUS_META: Record<
  RunStatus,
  {
    className: string
    icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  }
> = {
  queued: {
    className: "border-border bg-muted text-muted-foreground",
    icon: Clock01Icon,
  },
  running: {
    className: "border-blue-200 bg-blue-100 text-blue-800",
    icon: Loading03Icon,
  },
  completed: {
    className: "border-green-200 bg-green-100 text-green-800",
    icon: CheckmarkCircle02Icon,
  },
  failed: {
    className: "border-red-200 bg-red-100 text-red-800",
    icon: AlertCircleIcon,
  },
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge variant="neutral" className={meta.className}>
      <HugeiconsIcon icon={meta.icon} size={12} strokeWidth={2} />
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function RunModeBadge({ mode }: { mode: RunMode }) {
  return (
    <Badge variant={mode === "backtest" ? "sky" : "violet"}>
      {MODE_LABELS[mode]}
    </Badge>
  )
}

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(iso))
}

const runColumns: ColumnDef<DemoRun>[] = [
  {
    accessorKey: "id",
    header: "Run",
    meta: { className: "w-[130px]" },
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: "strategy",
    header: "Strategy",
    meta: { className: "min-w-[180px] max-w-[260px]" },
    cell: ({ row }) => (
      <span className="block truncate font-mono text-sm font-medium text-foreground">
        {row.original.strategy}
      </span>
    ),
  },
  {
    accessorKey: "mode",
    header: "Mode",
    meta: { className: "w-[110px]" },
    cell: ({ row }) => <RunModeBadge mode={row.original.mode} />,
  },
  {
    accessorKey: "sharpe",
    header: "Sharpe",
    meta: { align: "right", className: "w-[100px]" },
    cell: ({ row }) => {
      const value = row.original.sharpe
      return (
        <span className="font-mono font-medium text-foreground tabular-nums">
          {value == null ? "—" : value.toFixed(2)}
        </span>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { className: "w-[140px]" },
    cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created (UTC)",
    meta: { className: "w-[140px]" },
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
]

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export function RunsTable({ runs }: { runs: DemoRun[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent runs</CardTitle>
        <CardDescription>
          Latest engine cycles across every strategy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden border border-border">
          <DataTable
            data={runs}
            columns={runColumns}
            getRowId={(run) => run.id}
            enableRowSelection={false}
          />
        </div>
      </CardContent>
    </Card>
  )
}
