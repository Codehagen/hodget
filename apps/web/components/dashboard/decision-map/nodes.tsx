"use client"

import * as React from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

import { formatSignedNumber, pnlToneClass } from "../format"
import { ConvictionBar, StatusPill } from "../primitives"
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

/**
 * A read-only flow node: a hairline-ringed card shell with the four edge ports
 * every node exposes (left/top targets, right/bottom sources) so the layout can
 * route edges through any side. Ports are invisible — the canvas is not
 * connectable — they only anchor the derived edges. Selection is a blue ring
 * and stays instant (no transition), matching the product's motion posture;
 * only the unselected-node hover ring (fine pointers) eases its box-shadow.
 */
function NodeShell({
  selected,
  width = "w-56",
  className,
  children,
}: {
  selected?: boolean
  width?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-none bg-card text-card-foreground ring-1 ring-foreground/10",
        selected
          ? "ring-2 ring-info"
          : "transition-[box-shadow] duration-[var(--duration-instant)] ease-out-quad pointer-fine:hover:ring-foreground/20",
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

function NodeHeader({
  title,
  children,
}: {
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
      <span className="font-heading text-sm font-medium text-foreground">{title}</span>
      {children}
    </div>
  )
}

/** A small caption above a value — the field label vocabulary used throughout. */
function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-[10px] tracking-wide text-muted-foreground uppercase", className)}>
      {children}
    </span>
  )
}

function CodeBadge() {
  return (
    <span className="inline-flex h-4 items-center rounded-none border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
      code
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

function Verified({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />
      {label}
    </span>
  )
}

function signalDot(value: number): string {
  return value > 0.15 ? "bg-success" : value < -0.15 ? "bg-destructive" : "bg-muted-foreground"
}

/* ------------------------------------------------------------------ */
/* 1 · Point-in-time data                                              */
/* ------------------------------------------------------------------ */

export function DataSourceNode({ data, selected }: NodeProps) {
  const d = (data as { d: DataSourceNodeData }).d
  return (
    <NodeShell selected={selected} width="w-52">
      <NodeHeader title={d.ticker} />
      <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Cutoff</FieldLabel>
          <span className="font-mono text-xs text-foreground tabular-nums">{d.cutoff}</span>
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel>Sources</FieldLabel>
          {d.sources.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-xs text-foreground">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={13}
                className={s.ok ? "text-success" : "text-muted-foreground"}
              />
              {s.label}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-0.5">
          <FieldLabel>State</FieldLabel>
          <Verified label={d.state} />
        </div>
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 2 · Independent analyst view                                        */
/* ------------------------------------------------------------------ */

export function AnalystNode({ data, selected }: NodeProps) {
  const a = (data as { a: AnalystViewNodeData }).a
  return (
    <NodeShell selected={selected} width="w-60" className={cn(!a.included && "opacity-90")}>
      <NodeHeader
        title={
          <span className="flex items-center gap-2">
            {a.name}
            <StatusPill status={a.kind} />
          </span>
        }
      >
        <span className="font-mono text-[11px] text-muted-foreground">{a.version}</span>
      </NodeHeader>
      <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Conviction</FieldLabel>
            <span className={cn("font-mono text-base font-semibold tabular-nums", pnlToneClass(a.conviction))}>
              {formatSignedNumber(a.conviction)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <FieldLabel>Horizon</FieldLabel>
            <span className="font-mono text-xs text-foreground tabular-nums">{a.horizonDays}d</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <ConvictionBar value={a.conviction} showValue={false} segments={20} />
          <ConvictionAxis />
        </div>
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Thesis</FieldLabel>
          <p className="text-xs/relaxed text-foreground">{a.thesis}</p>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <FieldLabel>Analyst weight</FieldLabel>
          <span className="font-mono text-xs text-foreground tabular-nums">{a.weight.toFixed(2)}</span>
        </div>
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 3 · Committee                                                       */
/* ------------------------------------------------------------------ */

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function CommitteeNode({ data, selected }: NodeProps) {
  const c = (data as { c: CommitteeNodeData }).c
  return (
    <NodeShell selected={selected} width="w-64">
      <NodeHeader title="Conviction committee" />
      <div className="flex flex-col gap-3 px-3 pt-1 pb-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Dominant horizon</FieldLabel>
          <span className="font-mono text-xs text-foreground tabular-nums">{c.dominantHorizon}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Included contributors ({c.included.length})</FieldLabel>
          {c.included.map((m) => (
            <div key={m.name} className="flex items-center gap-2 text-xs">
              <span className={cn("size-1.5 shrink-0 rounded-full", signalDot(m.conviction))} />
              <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {m.weight.toFixed(2)}
              </span>
              <span className={cn("w-10 text-right font-mono text-[11px] font-medium tabular-nums", pnlToneClass(m.conviction))}>
                {formatSignedNumber(m.conviction)}
              </span>
            </div>
          ))}
        </div>

        {c.excluded.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Excluded ({c.excluded.length})</FieldLabel>
            {c.excluded.map((m) => (
              <div key={m.name} className="flex items-center gap-2 text-xs">
                <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{m.horizon}</span>
                <span className={cn("w-10 text-right font-mono text-[11px] font-medium tabular-nums", pnlToneClass(m.conviction))}>
                  {formatSignedNumber(m.conviction)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-0.5 border-t border-border pt-2">
          <FieldLabel>Net view</FieldLabel>
          <span className={cn("font-mono text-lg font-semibold tabular-nums", pnlToneClass(c.netView))}>
            {formatSignedNumber(c.netView)}
          </span>
          <span className="text-[10px] text-muted-foreground">{c.method}</span>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>Agreement (included views)</FieldLabel>
          <ConvictionBar value={mean(c.agreement)} showValue={false} segments={20} />
          <ConvictionAxis />
        </div>
        {c.dissent.length > 0 ? (
          <div className="flex flex-col gap-1">
            <FieldLabel>Dissent (excluded)</FieldLabel>
            <ConvictionBar value={mean(c.dissent)} showValue={false} segments={20} />
            <ConvictionAxis />
          </div>
        ) : null}
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 4 · Construction + risk gate                                        */
/* ------------------------------------------------------------------ */

export function ConstructionNode({ data, selected }: NodeProps) {
  const c = (data as { c: ConstructionNodeData }).c
  return (
    <NodeShell selected={selected} width="w-52">
      <NodeHeader title="Construction">
        <CodeBadge />
      </NodeHeader>
      <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Proposed target</FieldLabel>
          <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
            {c.proposedTargetPct.toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Position size</FieldLabel>
          <span className={cn("font-mono text-sm font-medium tabular-nums", c.side === "BUY" ? "text-success" : "text-destructive")}>
            {c.side} {c.size}
          </span>
        </div>
      </div>
    </NodeShell>
  )
}

export function RiskGateNode({ data, selected }: NodeProps) {
  const r = (data as { r: RiskGateNodeData }).r
  const clipped = r.result === "clipped"
  return (
    <NodeShell selected={selected} width="w-52">
      <NodeHeader title="Risk gate">
        <CodeBadge />
      </NodeHeader>
      <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
        <StatusPill status={r.result} className="uppercase" />
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Reason</FieldLabel>
          <span className="text-xs text-foreground">{r.reason}</span>
        </div>
        {clipped ? (
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Transformation</FieldLabel>
            <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
              <span className="text-muted-foreground line-through">{r.fromPct.toFixed(2)}%</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={12} className="text-muted-foreground" />
              <span className="font-medium text-foreground">{r.toPct.toFixed(2)}%</span>
            </span>
          </div>
        ) : null}
        {r.approvedSize > 0 ? (
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Approved size</FieldLabel>
            <span className={cn("font-mono text-sm font-medium tabular-nums", r.approvedSide === "BUY" ? "text-success" : "text-destructive")}>
              {r.approvedSide} {r.approvedSize}
            </span>
          </div>
        ) : null}
      </div>
    </NodeShell>
  )
}

/* ------------------------------------------------------------------ */
/* 5 · Execution                                                       */
/* ------------------------------------------------------------------ */

export function ExecutionNode({ data, selected }: NodeProps) {
  const e = (data as { e: ExecutionNodeData }).e
  return (
    <NodeShell selected={selected} width="w-52">
      <NodeHeader title="Execution">
        <CodeBadge />
      </NodeHeader>
      <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
        <StatusPill status={e.filled ? "executed" : "queued"} label={e.status} className="uppercase" />
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Order</FieldLabel>
          <span className={cn("font-mono text-sm font-medium tabular-nums", e.side === "BUY" ? "text-success" : "text-destructive")}>
            {e.side} {e.qty} @ ${e.price.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Timeline</FieldLabel>
          <span className="font-mono text-xs text-foreground tabular-nums">{e.timeline}</span>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-border pt-2">
          <FieldLabel>Ledger ID</FieldLabel>
          <span className="font-mono text-xs text-muted-foreground">{e.ledgerId}</span>
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
