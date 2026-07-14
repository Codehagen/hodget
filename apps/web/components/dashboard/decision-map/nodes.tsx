"use client"

import * as React from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  MinusSignCircleIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

import { formatSignedNumber, pnlToneClass } from "../format"
import { ConvictionBar, StatusPill } from "../primitives"
import { CopyButton } from "../run-detail/copy-button"
import type {
  AnalystViewNodeData,
  CommitteeNodeData,
  ConstructionNodeData,
  DataSourceNodeData,
  ExecutionNodeData,
  RiskGateNodeData,
} from "./data"

/* ------------------------------------------------------------------ */
/* Shared node shell                                                   */
/* ------------------------------------------------------------------ */

type Accent = "amber" | "green"

/**
 * A read-only flow node: a hairline-ringed card shell with the four edge ports
 * every node exposes (left/top targets, right/bottom sources) so the layout can
 * route edges through any side. Ports are invisible — the canvas is not
 * connectable — they only anchor the derived edges. Selection is a blue ring
 * and stays instant (no transition), matching the product's motion posture;
 * only the unselected-node hover ring (fine pointers) eases its box-shadow.
 *
 * `accent` gives a node a persistent semantic ring — amber for the safety gate,
 * green for the fill — which the blue selection ring wins over when selected.
 */
function NodeShell({
  selected,
  accent,
  width = "w-56",
  className,
  children,
}: {
  selected?: boolean
  accent?: Accent
  width?: string
  className?: string
  children: React.ReactNode
}) {
  const accentRing =
    accent === "amber"
      ? "ring-warning/50"
      : accent === "green"
        ? "ring-success/45"
        : "ring-foreground/10"
  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-none bg-card text-card-foreground ring-1",
        selected
          ? "ring-2 ring-info"
          : cn(
              accentRing,
              "transition-[box-shadow] duration-[var(--duration-instant)] ease-out-quad pointer-fine:hover:ring-foreground/25"
            ),
        width,
        className
      )}
    >
      <Handle id="l" type="target" position={Position.Left} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="t" type="target" position={Position.Top} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="r" type="source" position={Position.Right} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="b" type="source" position={Position.Bottom} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      {children}
    </div>
  )
}

/** A small muted caption above a value. */
function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-[10px] tracking-wide text-muted-foreground uppercase", className)}>
      {children}
    </span>
  )
}

/** −1.0 / 0 / +1.0 axis ticks under a conviction bar. */
function ConvictionAxis() {
  return (
    <div className="flex justify-between font-mono text-[9px] text-muted-foreground/70 tabular-nums">
      <span>-1.0</span>
      <span>0</span>
      <span>+1.0</span>
    </div>
  )
}

/** A small outlined tag, e.g. "Deterministic rule". */
function OutlineTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 w-fit items-center rounded-none border border-border bg-transparent px-1.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`
}

/* ------------------------------------------------------------------ */
/* 1 · What did we know? (Point-in-time data)                          */
/* ------------------------------------------------------------------ */

export function DataSourceNode({ data, selected }: NodeProps) {
  const d = (data as { d: DataSourceNodeData }).d
  return (
    <NodeShell selected={selected} width="w-48">
      <div className="flex flex-col gap-3 px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-sm font-medium text-foreground">
            {d.ticker} evidence available
          </span>
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            Known at {d.knownAt}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {d.sources.map((s) => (
            <div key={s.label} className="flex items-start gap-2">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={14}
                className={cn("mt-px shrink-0", s.ok ? "text-success" : "text-muted-foreground")}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-xs text-foreground">{s.label}</span>
                <span className="text-[11px] text-success">Verified</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 2 · What did advisors think? (Independent views)                    */
/* ------------------------------------------------------------------ */

export function AnalystNode({ data, selected }: NodeProps) {
  const a = (data as { a: AnalystViewNodeData }).a
  return (
    <NodeShell selected={selected} width="w-56">
      <div className="flex flex-col gap-2.5 px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span className="font-heading text-sm font-medium text-foreground">{a.name}</span>
          <StatusPill status={a.kind} />
        </span>

        <div className="flex items-start justify-between gap-2">
          <span className={cn("font-mono text-lg font-semibold tabular-nums", pnlToneClass(a.conviction))}>
            {formatSignedNumber(a.conviction)}{" "}
            <span className="text-sm font-medium text-foreground">{a.word}</span>
          </span>
          <span className="mt-1 shrink-0 text-[11px] text-muted-foreground">{a.horizonDays}-day view</span>
        </div>

        <div className="flex flex-col gap-1">
          <ConvictionBar value={a.conviction} showValue={false} segments={20} />
          <ConvictionAxis />
        </div>

        <p className="text-xs/relaxed text-foreground">{a.thesis}</p>

        <div className="flex items-center gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span>Weight</span>
          <span className="font-mono text-foreground tabular-nums">{a.weight.toFixed(2)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className={cn(!a.included && "text-info")}>{a.usedLabel}</span>
        </div>
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 3 · How were views combined? (Committee)                            */
/* ------------------------------------------------------------------ */

export function CommitteeNode({ data, selected }: NodeProps) {
  const c = (data as { c: CommitteeNodeData }).c
  return (
    <NodeShell selected={selected} width="w-72">
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-heading text-sm font-medium text-foreground">{c.resultLabel}</span>
          <span className={cn("font-mono text-2xl font-semibold tabular-nums", pnlToneClass(c.netView))}>
            {formatSignedNumber(c.netView)}
          </span>
          <p className="text-xs/relaxed text-foreground">{c.sentence}</p>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          {c.included.map((m) => (
            <div key={m.name} className="flex items-center gap-2 text-xs">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} className="shrink-0 text-success" />
              <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
              <span className={cn("font-mono text-[11px] font-medium tabular-nums", pnlToneClass(m.conviction))}>
                {formatSignedNumber(m.conviction)}
              </span>
            </div>
          ))}
          {c.excluded.map((m) => (
            <div key={m.name} className="flex items-center gap-2 text-xs">
              <HugeiconsIcon icon={MinusSignCircleIcon} size={13} className="shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {m.name} <span className="text-muted-foreground/70">(dissent)</span>
              </span>
              <span className={cn("font-mono text-[11px] font-medium tabular-nums", pnlToneClass(m.conviction))}>
                {formatSignedNumber(m.conviction)}
              </span>
            </div>
          ))}
        </div>

        {c.dissentNote ? (
          <p className="text-[11px]/relaxed text-muted-foreground">{c.dissentNote}</p>
        ) : null}

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
          <span>
            Net view{" "}
            <span className={cn("font-mono font-medium tabular-nums", pnlToneClass(c.netView))}>
              {formatSignedNumber(c.netView)}
            </span>
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="tabular-nums">Weights sum to {c.sumWeights.toFixed(2)}</span>
        </div>
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 4 · What did safety change? (Construction + risk gate)              */
/* ------------------------------------------------------------------ */

export function ConstructionNode({ data, selected }: NodeProps) {
  const c = (data as { c: ConstructionNodeData }).c
  return (
    <NodeShell selected={selected} width="w-48">
      <div className="flex flex-col gap-2.5 px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Proposed position</FieldLabel>
          <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
            {fmtPct(c.proposedTargetPct)}
          </span>
        </div>
        <span className={cn("font-mono text-sm font-medium tabular-nums", c.side === "BUY" ? "text-success" : "text-destructive")}>
          {c.side} {c.size}
        </span>
      </div>
    </NodeShell>
  )
}

export function RiskGateNode({ data, selected }: NodeProps) {
  const r = (data as { r: RiskGateNodeData }).r
  const clipped = r.result === "clipped"
  const vetoed = r.result === "vetoed"
  const accent: Accent | undefined = vetoed ? undefined : clipped ? "amber" : undefined
  return (
    <NodeShell selected={selected} accent={accent} width="w-52" className={cn(vetoed && !selected && "ring-destructive/50")}>
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <span className="font-heading text-sm font-medium text-foreground">{r.headline}</span>

        {clipped || vetoed ? (
          <span className="flex items-baseline gap-1.5 font-mono text-lg font-semibold tabular-nums">
            <span className="text-muted-foreground line-through">{fmtPct(r.fromPct)}</span>
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="self-center text-muted-foreground" />
            <span className="text-foreground">{fmtPct(r.toPct)}</span>
          </span>
        ) : null}

        {r.approvedSize > 0 ? (
          <span className={cn("font-mono text-sm font-medium tabular-nums", r.approvedSide === "BUY" ? "text-success" : "text-destructive")}>
            {r.approvedSide} {r.approvedSize}
          </span>
        ) : vetoed ? (
          <span className="font-mono text-sm font-medium text-destructive tabular-nums">No fill</span>
        ) : null}

        <div className="flex flex-col gap-0.5">
          <FieldLabel>Reason</FieldLabel>
          <span className="text-xs text-foreground">{r.reason}</span>
        </div>

        <OutlineTag>Deterministic rule</OutlineTag>
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 5 · What was executed? (Fill)                                       */
/* ------------------------------------------------------------------ */

export function ExecutionNode({ data, selected }: NodeProps) {
  const e = (data as { e: ExecutionNodeData }).e
  return (
    <NodeShell selected={selected} accent="green" width="w-52">
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-success">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
          Filled next session
        </span>
        <span className={cn("font-mono text-base font-semibold tabular-nums", e.side === "BUY" ? "text-success" : "text-destructive")}>
          {e.side} {e.qty} @ ${e.price.toFixed(2)}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{e.timeline}</span>
        <span className="text-[11px] text-muted-foreground">Recorded in immutable ledger</span>
        <div className="flex flex-col gap-0.5 border-t border-border pt-2">
          <FieldLabel>Ledger ID</FieldLabel>
          <span className="flex items-center gap-1 font-mono text-xs text-foreground">
            {e.ledgerId}
            <CopyButton value={e.ledgerId} />
          </span>
        </div>
      </div>
    </NodeShell>
  )
}

export const nodeTypes = {
  dataSource: DataSourceNode,
  analyst: AnalystNode,
  committee: CommitteeNode,
  construction: ConstructionNode,
  risk: RiskGateNode,
  execution: ExecutionNode,
}
