"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardTitle } from "@workspace/ui/components/card"

import {
  ATTRIBUTION_BY_SECURITY,
  ATTRIBUTION_BY_STRATEGY,
  ATTRIBUTION_TOTAL_BP,
  type AttributionRow,
} from "../demo-data"
import { formatBps, pnlToneClass } from "../format"

/** Diverging bp bar: positive grows right (green), negative grows left (red),
 * from a shared center axis scaled to the largest absolute contribution. */
function DivergingBar({ bp, maxAbs }: { bp: number; maxAbs: number }) {
  const pct = maxAbs === 0 ? 0 : (Math.abs(bp) / maxAbs) * 100
  return (
    <div className="flex h-2.5 items-stretch" aria-hidden>
      <div className="flex w-1/2 justify-end">
        {bp < 0 ? (
          <span className="bg-destructive" style={{ width: `${pct}%` }} />
        ) : null}
      </div>
      <span className="w-px shrink-0 bg-border" />
      <div className="flex w-1/2 justify-start">
        {bp > 0 ? (
          <span className="bg-success" style={{ width: `${pct}%` }} />
        ) : null}
      </div>
    </div>
  )
}

function AttributionRows({ rows }: { rows: AttributionRow[] }) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.bp)))
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(6rem,1fr)_minmax(0,1.4fr)_3.25rem] items-center gap-3"
        >
          <span className="truncate font-mono text-xs text-foreground">
            {row.label}
          </span>
          <DivergingBar bp={row.bp} maxAbs={maxAbs} />
          <span
            className={cn(
              "text-right font-mono text-xs font-medium tabular-nums",
              pnlToneClass(row.bp)
            )}
          >
            {formatBps(row.bp)}
          </span>
        </div>
      ))}
    </div>
  )
}

const MODES = ["Strategy", "Security"] as const
type Mode = (typeof MODES)[number]

export function AttributionCard() {
  const [mode, setMode] = React.useState<Mode>("Strategy")
  const rows =
    mode === "Strategy" ? ATTRIBUTION_BY_STRATEGY : ATTRIBUTION_BY_SECURITY

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3">
        <CardTitle>Today&apos;s attribution</CardTitle>
        <div className="flex items-center gap-0.5 border border-border bg-card p-0.5">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "px-2 py-0.5 text-[11px] font-medium transition-colors duration-[var(--duration-instant)]",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-3">
        <div className="flex justify-end">
          <span className="text-[11px] text-muted-foreground">
            Contribution (bp)
          </span>
        </div>
        <div
          key={mode}
          className="motion-safe:animate-fade-in [animation-duration:var(--duration-fast)]"
        >
          <AttributionRows rows={rows} />
        </div>
        <div className="mt-1 grid grid-cols-[minmax(6rem,1fr)_minmax(0,1.4fr)_3.25rem] items-center gap-3 border-t border-border pt-3">
          <span className="text-xs font-medium text-foreground">Total</span>
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <span>−</span>
            <span>0</span>
            <span>+</span>
          </div>
          <span className="text-right font-mono text-xs font-medium tabular-nums text-success">
            {formatBps(ATTRIBUTION_TOTAL_BP)}
          </span>
        </div>
      </div>
    </Card>
  )
}
