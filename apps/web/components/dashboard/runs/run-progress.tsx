import { cn } from "@workspace/ui/lib/utils"

import type { RunStatus } from "../demo-data"

/**
 * A dense inline progress bar for a run: an optional `NN%` figure followed by a
 * thin track. The fill hue is semantic — blue while running, green once
 * complete — and stays muted otherwise. Queued/failed runs (no `value`) render a
 * single em dash so the column still reads as tabular.
 *
 * The width transition uses the shared slow token, so a live-updating running
 * bar sweeps like every other indicator in the app; it never runs on a hot path
 * because the fixtures are static.
 */
const FILL_TONE: Record<RunStatus, string> = {
  running: "bg-info",
  completed: "bg-success",
  queued: "bg-muted-foreground",
  failed: "bg-muted-foreground",
}

export function RunProgress({
  value,
  status,
  showValue = true,
  className,
  trackClassName,
}: {
  value: number | null
  status: RunStatus
  /** Render the leading `NN%` figure. */
  showValue?: boolean
  className?: string
  trackClassName?: string
}) {
  if (value == null) {
    return <span className="text-xs text-muted-foreground tabular-nums">—</span>
  }

  const pct = Math.max(0, Math.min(100, value))

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showValue ? (
        <span className="w-9 shrink-0 font-mono text-xs text-foreground tabular-nums">
          {pct}%
        </span>
      ) : null}
      <div className={cn("h-1 min-w-0 flex-1 bg-muted", trackClassName)} aria-hidden>
        <span
          className={cn(
            "block h-full transition-[width] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none",
            FILL_TONE[status]
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
