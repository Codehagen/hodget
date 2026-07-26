import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import type { DecisionMap } from "./data"

/**
 * The "Evidence" and "Audit & replay" tab bodies, shared by the standalone
 * Decisions page and the per-run decision page. Both are plain, server-rendered
 * tables derived from the decision map, so the two surfaces never disagree.
 */

const HEAD =
  "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground"
const CELL = "h-auto py-2.5 text-xs"

export function EvidenceTab({ map }: { map: DecisionMap }) {
  const rows = map.analysts.flatMap((a) =>
    a.evidence.map((ev) => ({ analyst: a.name, ...ev }))
  )
  return (
    <div className="rounded-none bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(HEAD, "pl-4")}>Advisor</TableHead>
            <TableHead className={HEAD}>Evidence</TableHead>
            <TableHead className={HEAD}>Time (UTC)</TableHead>
            <TableHead className={cn(HEAD, "pr-4")}>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.analyst}-${r.title}`} className="hover:bg-transparent">
              <TableCell className={cn(CELL, "pl-4 font-medium text-foreground")}>
                {r.analyst}
              </TableCell>
              <TableCell className={cn(CELL, "text-foreground")}>{r.title}</TableCell>
              <TableCell className={cn(CELL, "font-mono text-muted-foreground tabular-nums")}>
                {r.time}
              </TableCell>
              <TableCell className={cn(CELL, "pr-4 text-muted-foreground")}>{r.source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function AuditTab({ map }: { map: DecisionMap }) {
  const events: { time: string; stage: string; detail: string }[] = [
    {
      time: map.data.cutoff,
      stage: "Point-in-time data",
      detail: `${map.data.ticker} snapshot ${map.data.state.toLowerCase()} · ${map.provenance.dataset}`,
    },
    ...map.analysts.map((a) => ({
      time: a.evidence[0]?.time ?? map.timestamp,
      stage: "Independent view",
      detail: `${a.name} conviction ${a.conviction >= 0 ? "+" : ""}${a.conviction.toFixed(2)} (${a.horizonDays}d)${a.included ? "" : " · excluded"}`,
    })),
    {
      time: map.timestamp,
      stage: "Committee",
      detail: `Net view ${map.committee.netView >= 0 ? "+" : ""}${map.committee.netView.toFixed(2)} · ${map.committee.method}`,
    },
    {
      time: map.timestamp,
      stage: "Safety",
      detail: `${map.risk.result} · ${map.risk.reason}`,
    },
    ...(map.execution
      ? [
          {
            time: map.timestamp,
            stage: "Execution",
            detail: `${map.execution.status} · ${map.execution.side} ${map.execution.qty} @ $${map.execution.price.toFixed(2)} · ${map.execution.ledgerId}`,
          },
        ]
      : [{ time: map.timestamp, stage: "Execution", detail: "No trade — nothing filled" }]),
  ]
  return (
    <div className="rounded-none bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(HEAD, "pl-4")}>Time (UTC)</TableHead>
            <TableHead className={HEAD}>Stage</TableHead>
            <TableHead className={cn(HEAD, "pr-4")}>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className={cn(CELL, "pl-4 font-mono text-muted-foreground tabular-nums")}>
                {e.time}
              </TableCell>
              <TableCell className={cn(CELL, "font-medium text-foreground")}>{e.stage}</TableCell>
              <TableCell className={cn(CELL, "pr-4 text-muted-foreground")}>{e.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
