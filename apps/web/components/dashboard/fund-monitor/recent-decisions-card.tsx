"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { FUND_DECISIONS, type FundDecision } from "../demo-data"
import { formatBps, pnlToneClass } from "../format"
import { SegmentBar, StatusPill } from "../primitives"

// Shared column template — the header labels and every row line up on it.
const GRID =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_5rem_7rem_4rem_9.5rem] items-center gap-x-3"

function DecisionRow({
  decision,
  basePath,
}: {
  decision: FundDecision
  basePath: string
}) {
  const [open, setOpen] = React.useState(false)
  const filled = Math.round((decision.agreementPct / 100) * 5)

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          GRID,
          "min-h-11 w-full px-4 py-3 text-left outline-none transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 focus-visible:bg-muted/60"
        )}
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={14}
          aria-hidden
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-[var(--duration-instant)]",
            open && "rotate-90"
          )}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">
            {decision.title}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {decision.explainer}
          </p>
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {decision.time}
        </span>
        <span className="flex items-center gap-2">
          <SegmentBar filled={filled} total={5} />
          <span className="font-mono text-xs text-foreground tabular-nums">
            {decision.agreementPct}%
          </span>
        </span>
        <span
          className={cn(
            "font-mono text-xs font-medium tabular-nums",
            pnlToneClass(decision.impactBp)
          )}
        >
          {formatBps(decision.impactBp)}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {decision.statuses.map((s) => (
            <StatusPill key={s.label ?? s.status} status={s.status} label={s.label} />
          ))}
        </span>
      </button>

      {open ? (
        <div className={cn(GRID, "px-4 pt-0 pb-3")}>
          <span />
          <p className="text-[11px] text-muted-foreground">
            {decision.explainer}{" "}
            <Link
              href={`${basePath}/decisions`}
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              View in Decisions
              <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}

/**
 * "Recent decisions" — the plain-language trade log. Each row is a real
 * keyboard-accessible <button> that expands instantly (per Design.md's
 * frequency rule) to a detail line linking into Decisions. Columns: time,
 * advisor agreement (a 5-segment meter + %), impact in bp, and status pills.
 */
export function RecentDecisionsCard({ basePath }: { basePath: string }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle>Recent decisions</CardTitle>
      </CardHeader>

      {/* Column header */}
      <div
        className={cn(
          GRID,
          "border-t border-border px-4 py-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
        )}
      >
        <span />
        <span />
        <span>Time (UTC)</span>
        <span>Advisor agreement</span>
        <span>Impact</span>
        <span>Status</span>
      </div>

      <div className="flex flex-col">
        {FUND_DECISIONS.map((d) => (
          <DecisionRow key={d.id} decision={d} basePath={basePath} />
        ))}
      </div>
    </Card>
  )
}
