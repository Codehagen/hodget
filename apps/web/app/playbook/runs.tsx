"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Loading03Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@workspace/ui/components/menu"

/* ------------------------------------------------------------------ */
/* Domain — engine runs (static gallery data, no real wiring)         */
/* ------------------------------------------------------------------ */

export const RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const RUN_MODES = ["backtest", "paper"] as const
export type RunMode = (typeof RUN_MODES)[number]

export const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
}

const MODE_LABELS: Record<RunMode, string> = {
  backtest: "Backtest",
  paper: "Paper",
}

export type Run = {
  id: string
  strategy: string
  mode: RunMode
  status: RunStatus
  positions: number
  sharpe: number | null
  createdAt: string
}

/* --- Formatting helpers --- */

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

/* --- Status state machine (soft-tinted badges) --- */

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

/* --- Cells --- */

function ActionsCell({ run }: { run: Run }) {
  return (
    <Menu>
      <MenuTrigger
        aria-label="Row actions"
        className="inline-flex size-7 items-center justify-center rounded-none text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/50"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem onClick={() => navigator.clipboard?.writeText(run.id)}>
          Copy run ID
        </MenuItem>
        <MenuItem onClick={() => navigator.clipboard?.writeText(run.strategy)}>
          Copy strategy
        </MenuItem>
        <MenuItem
          onClick={() => navigator.clipboard?.writeText(STATUS_LABELS[run.status])}
        >
          Copy status
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/* --- Columns --- */

export const runColumns: ColumnDef<Run>[] = [
  {
    id: "select",
    enableSorting: false,
    meta: { className: "w-[44px]", skeleton: { variant: "checkbox" } },
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  },
  {
    accessorKey: "id",
    header: "Run",
    meta: { sortField: "id", className: "w-[130px]", skeleton: { width: "70%" } },
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: "strategy",
    header: "Strategy",
    meta: {
      sortField: "strategy",
      className: "min-w-[180px] max-w-[260px]",
      skeleton: { width: "80%" },
    },
    cell: ({ row }) => (
      <span className="block truncate font-medium text-foreground">
        {row.original.strategy}
      </span>
    ),
  },
  {
    accessorKey: "mode",
    header: "Mode",
    enableSorting: false,
    meta: { className: "w-[110px]", skeleton: { variant: "badge", width: "60%" } },
    cell: ({ row }) => <RunModeBadge mode={row.original.mode} />,
  },
  {
    accessorKey: "sharpe",
    header: "Sharpe",
    meta: {
      sortField: "sharpe",
      align: "right",
      className: "w-[100px]",
      skeleton: { width: "50%" },
    },
    cell: ({ row }) => {
      const value = row.original.sharpe
      return (
        <span className="font-medium tabular-nums text-foreground">
          {value == null ? "—" : value.toFixed(2)}
        </span>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    meta: { className: "w-[140px]", skeleton: { variant: "badge", width: "70%" } },
    cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    meta: {
      sortField: "createdAt",
      className: "w-[130px]",
      skeleton: { width: "60%" },
    },
    cell: ({ row }) => (
      <span className={cn("font-mono text-xs text-muted-foreground")}>
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    meta: { className: "w-[52px]" },
    cell: ({ row }) => <ActionsCell run={row.original} />,
  },
]
