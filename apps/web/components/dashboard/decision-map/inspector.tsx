"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"

import { formatSignedNumber, pnlToneClass } from "../format"
import { StatusPill } from "../primitives"
import { CopyButton } from "../run-detail/copy-button"
import { analystNodeId } from "./layout"
import type { DecisionMap } from "./data"

function InspectorRow({
  label,
  value,
  copy,
}: {
  label: string
  value: React.ReactNode
  copy?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
        {value}
        {copy ? <CopyButton value={copy} /> : null}
      </span>
    </div>
  )
}

/** Presentational, per-node inspector — populated from the derived map. */
export function Inspector({
  map,
  selectedId,
  onClose,
}: {
  map: DecisionMap
  selectedId: string | null
  onClose: () => void
}) {
  const analyst = map.analysts.find((a) => analystNodeId(a.analystId) === selectedId)

  let title = "Overview"
  let body: React.ReactNode

  if (analyst) {
    title = analyst.name
    body = (
      <>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Why{" "}
            <span className={cn("font-mono font-medium tabular-nums", pnlToneClass(analyst.conviction))}>
              {formatSignedNumber(analyst.conviction)}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Top contributing evidence</span>
          <ul className="flex flex-col gap-2">
            {analyst.evidence.map((ev) => (
              <li key={ev.title} className="flex items-start gap-2 border border-border bg-muted/30 p-2">
                <HugeiconsIcon icon={File01Icon} size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs/relaxed text-foreground">{ev.title}</span>
                  <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground tabular-nums">
                    <span>{ev.time}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span>{ev.source}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-3">
          <InspectorRow label="Rendered context" value={analyst.renderedContext} copy={analyst.renderedContext} />
          <InspectorRow label="Prompt" value={analyst.prompt} copy={analyst.prompt !== "—" ? analyst.prompt : undefined} />
          <InspectorRow label="Model" value={analyst.model} copy={analyst.model} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Parse verified</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />
              {analyst.parseVerified ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </>
    )
  } else if (selectedId === "committee") {
    title = "Committee"
    body = (
      <div className="flex flex-col gap-3">
        <InspectorRow label="Net view" value={
          <span className={pnlToneClass(map.committee.netView)}>{formatSignedNumber(map.committee.netView)}</span>
        } />
        <InspectorRow label="Dominant horizon" value={map.committee.dominantHorizon} />
        <InspectorRow label="Method" value={<span className="font-sans">{map.committee.method}</span>} />
      </div>
    )
  } else if (selectedId === "risk") {
    title = "Risk gate"
    body = (
      <div className="flex flex-col gap-3">
        <StatusPill status={map.risk.result} className="uppercase" />
        <InspectorRow label="Reason" value={<span className="font-sans">{map.risk.reason}</span>} />
        {map.risk.result === "clipped" ? (
          <InspectorRow label="Transformation" value={`${map.risk.fromPct.toFixed(2)}% → ${map.risk.toPct.toFixed(2)}%`} />
        ) : null}
      </div>
    )
  } else if (selectedId === "construction" && map.construction) {
    title = "Construction"
    body = (
      <div className="flex flex-col gap-3">
        <InspectorRow label="Proposed target" value={`${map.construction.proposedTargetPct.toFixed(2)}%`} />
        <InspectorRow label="Position size" value={`${map.construction.side} ${map.construction.size}`} />
      </div>
    )
  } else if (selectedId === "execution" && map.execution) {
    title = "Execution"
    body = (
      <div className="flex flex-col gap-3">
        <StatusPill status="executed" label={map.execution.status} className="uppercase" />
        <InspectorRow label="Order" value={`${map.execution.side} ${map.execution.qty} @ $${map.execution.price.toFixed(2)}`} />
        <InspectorRow label="Timeline" value={map.execution.timeline} />
        <InspectorRow label="Ledger ID" value={map.execution.ledgerId} copy={map.execution.ledgerId} />
      </div>
    )
  } else {
    title = map.data.ticker
    body = (
      <div className="flex flex-col gap-3">
        <InspectorRow label="Cutoff" value={map.data.cutoff} />
        <InspectorRow label="State" value={<span className="text-success">{map.data.state}</span>} />
      </div>
    )
  }

  return (
    <aside className="flex w-full flex-col gap-4 rounded-none bg-card p-4 text-card-foreground ring-1 ring-foreground/10 lg:w-80">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Selected</span>
          <span className="font-heading text-sm font-medium text-foreground">{title}</span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      </div>

      <div className="flex flex-col gap-4">{body}</div>

      <Button variant="outline" size="sm" className="mt-1 w-full">
        Open full evidence
      </Button>
    </aside>
  )
}
