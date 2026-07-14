import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { StatBar } from "@workspace/ui/components/stat"

import { RUNS_SUMMARY } from "../demo-data"
import { StatusPill } from "../primitives"
import { RunProgress } from "./run-progress"

/**
 * The three-cell live status strip above the run history: how many runs are
 * Running / Queued / Failed right now, each with a one-line pointer to the most
 * relevant run and a jump link. Purely presentational — it reads the shared
 * `RUNS_SUMMARY` fixture and links into the run detail under the active basePath.
 */
function SummaryCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-[15rem] flex-1 flex-col gap-2 border-l border-border px-4 py-3 first:border-l-0",
        className
      )}
    >
      {children}
    </div>
  )
}

/** A `run_id · strategy · note` byline in the summary cells. */
function RunByline({
  id,
  strategy,
  note,
}: {
  id: string
  strategy: string
  note: React.ReactNode
}) {
  return (
    <p className="min-w-0 truncate text-xs text-muted-foreground">
      <span className="font-mono text-foreground">{id}</span>
      <span className="mx-1.5 text-border">·</span>
      <span className="font-mono">{strategy}</span>
      <span className="mx-1.5 text-border">·</span>
      {note}
    </p>
  )
}

export function RunsSummary({ basePath }: { basePath: string }) {
  const { running, queued, failed } = RUNS_SUMMARY

  return (
    <StatBar>
      {/* Running */}
      <SummaryCell>
        <div className="flex items-center justify-between gap-2">
          <StatusPill
            status="running"
            appearance="dot"
            className="text-sm font-semibold text-foreground"
          />
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {running.count}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <RunByline
            id={running.latest.id}
            strategy={running.latest.strategy}
            note={`${running.latest.progressPct}%`}
          />
          <Link
            href={`${basePath}/runs/${running.latest.id}`}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:text-primary/80"
          >
            View live run
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={2} />
          </Link>
        </div>
        <RunProgress
          value={running.latest.progressPct}
          status="running"
          showValue={false}
        />
      </SummaryCell>

      {/* Queued */}
      <SummaryCell>
        <div className="flex items-center justify-between gap-2">
          <StatusPill
            status="queued"
            appearance="dot"
            className="text-sm font-semibold text-foreground"
          />
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {queued.count}
          </span>
        </div>
        <RunByline
          id={queued.latest.id}
          strategy={queued.latest.strategy}
          note={queued.latest.note}
        />
      </SummaryCell>

      {/* Failed */}
      <SummaryCell>
        <div className="flex items-center justify-between gap-2">
          <StatusPill
            status="failed"
            appearance="dot"
            className="text-sm font-semibold text-foreground"
          />
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {failed.count}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <RunByline
            id={failed.latest.id}
            strategy={failed.latest.strategy}
            note={failed.latest.note}
          />
          <Link
            href={`${basePath}/runs/${failed.latest.id}`}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-destructive transition-colors duration-[var(--duration-instant)] hover:text-destructive/80"
          >
            View logs
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={2} />
          </Link>
        </div>
      </SummaryCell>
    </StatBar>
  )
}
