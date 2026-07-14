"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { MasterDetailPanel } from "@workspace/ui/components/master-detail"
import { StageStepper, type StageStep } from "@workspace/ui/components/stage-stepper"

import {
  RUN_INSPECTOR,
  type RunHistoryRow,
  type RunMode,
  type RunStatus,
} from "../demo-data"
import { formatSignedPercent, pnlToneClass } from "../format"
import { StatusPill } from "../primitives"
import { RunProgress } from "./run-progress"

const MODE_LABEL: Record<RunMode, string> = {
  backtest: "Backtest",
  paper: "Paper",
}

const STAGE_DEFS = [
  { id: "data", label: "Data" },
  { id: "analysts", label: "Analysts" },
  { id: "committee", label: "Committee" },
  { id: "risk", label: "Risk" },
  { id: "fills", label: "Fills" },
] as const

/**
 * The pipeline snapshot for a run. Completed runs show every stage done; a
 * running run is mid-flight at Analysts (matching the live fixture); queued runs
 * are all pending; a failed run got through Data before stopping.
 */
function stagesFor(status: RunStatus): StageStep[] {
  if (status === "running") return RUN_INSPECTOR.stages

  return STAGE_DEFS.map((def, i) => {
    const state =
      status === "completed"
        ? "complete"
        : status === "failed" && def.id === "data"
          ? "complete"
          : "pending"
    return {
      id: def.id,
      label: def.label,
      state,
      caption: state === "pending" ? "Pending" : undefined,
      index: i + 1,
    }
  })
}

function lastEventFor(row: RunHistoryRow): { label: string; time: string } {
  if (row.id === RUN_INSPECTOR.id) return RUN_INSPECTOR.lastEvent
  const time = `${row.startedAt} UTC`
  switch (row.status) {
    case "completed":
      return { label: "Run completed", time }
    case "running":
      return { label: "Analyst model evaluation started", time }
    case "queued":
      return { label: "Queued — waiting for a worker", time }
    case "failed":
      return { label: "Run failed — see logs", time }
  }
}

/** One `label → value` row in the inspector's detail list. */
function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs text-foreground">{children}</dd>
    </div>
  )
}

export function RunInspector({
  row,
  basePath,
  onClose,
}: {
  row: RunHistoryRow
  basePath: string
  onClose: () => void
}) {
  const stages = stagesFor(row.status)
  const lastEvent = lastEventFor(row)

  return (
    <MasterDetailPanel className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-base font-semibold text-foreground">
            {row.id}
          </span>
          <StatusPill status={row.status} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors duration-[var(--duration-instant)] hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Detail list */}
      <dl className="flex flex-col divide-y divide-border/60 border-y border-border/60">
        <DetailRow label="Strategy">
          <span className="font-mono">{row.strategy}</span>
        </DetailRow>
        <DetailRow label="Mode">{MODE_LABEL[row.mode]}</DetailRow>
        <DetailRow label="Universe">{row.universe}</DetailRow>
        <DetailRow label="Started">
          <span className="font-mono tabular-nums">{row.startedAt} UTC</span>
        </DetailRow>
        <DetailRow label="Duration">
          <span className="font-mono tabular-nums">
            {row.durationLabel ?? "—"}
          </span>
        </DetailRow>
        <DetailRow label="Progress">
          <RunProgress
            value={row.progressPct}
            status={row.status}
            className="w-32 justify-end"
          />
        </DetailRow>
        <DetailRow label="Sharpe">
          <span className="font-mono tabular-nums">
            {row.sharpe == null ? "—" : row.sharpe.toFixed(2)}
          </span>
        </DetailRow>
        <DetailRow label="Return">
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              row.returnPct == null ? "text-muted-foreground" : pnlToneClass(row.returnPct)
            )}
          >
            {row.returnPct == null ? "—" : formatSignedPercent(row.returnPct)}
          </span>
        </DetailRow>
      </dl>

      {/* Current stage */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-medium text-foreground">Current stage</h3>
        <StageStepper steps={stages} orientation="vertical" />
      </div>

      {/* Last event */}
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-foreground">Last event</h3>
        <p className="text-xs text-muted-foreground">{lastEvent.label}</p>
        <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {lastEvent.time}
        </p>
      </div>

      <Link
        href={`${basePath}/runs/${row.id}`}
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:text-primary/80"
      >
        View live run
        <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={2} />
      </Link>
    </MasterDetailPanel>
  )
}
