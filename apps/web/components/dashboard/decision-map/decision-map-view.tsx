import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { StatusPill } from "../primitives"
import { CopyButton } from "../run-detail/copy-button"
import type { DecisionMap } from "./data"
import { DecisionFlow } from "./decision-flow"

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header({
  basePath,
  map,
}: {
  basePath: string
  map: DecisionMap
}) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`${basePath}/runs`} />}>
              Runs
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href={`${basePath}/runs/${map.runId}`} />}
              className="font-mono"
            >
              {map.runId}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono">{map.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Decision map
          </h1>
          <p className="text-sm text-muted-foreground">
            How independent analyst views became this {map.ticker} position.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-sm font-medium text-foreground">
            {map.ticker}
          </span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {map.timestamp}
          </span>
          <StatusPill status={map.mode} />
          {map.executed ? <StatusPill status="executed" /> : null}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Provenance strip                                                    */
/* ------------------------------------------------------------------ */

function MetaCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 border-border px-4 py-3 sm:border-l sm:first:border-l-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 text-xs">{children}</div>
    </div>
  )
}

function ProvenanceStrip({ map }: { map: DecisionMap }) {
  const p = map.provenance
  return (
    <div className="grid grid-cols-1 rounded-none bg-card ring-1 ring-foreground/10 sm:grid-cols-3">
      <MetaCell label="Dataset">
        <span className="font-mono font-medium text-foreground">{p.dataset}</span>
        <CopyButton value={p.dataset} />
      </MetaCell>
      <MetaCell label="Panel">
        <span className="font-mono font-medium text-foreground">{p.panel}</span>
        <CopyButton value={p.panel} />
      </MetaCell>
      <MetaCell label="Deterministic replay">
        <span className="font-medium text-success">
          {p.deterministicReplay ? "Enabled" : "Disabled"}
        </span>
        <HugeiconsIcon
          icon={InformationCircleIcon}
          size={13}
          className="text-muted-foreground"
        />
      </MetaCell>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Evidence + Audit log tabs                                           */
/* ------------------------------------------------------------------ */

const HEAD =
  "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground"
const CELL = "h-auto py-2.5 text-xs"

function EvidenceTab({ map }: { map: DecisionMap }) {
  const rows = map.analysts.flatMap((a) =>
    a.evidence.map((ev) => ({ analyst: a.name, ...ev }))
  )
  return (
    <div className="rounded-none bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(HEAD, "pl-4")}>Analyst</TableHead>
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
              <TableCell className={cn(CELL, "pr-4 text-muted-foreground")}>
                {r.source}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function AuditTab({ map }: { map: DecisionMap }) {
  const events: { time: string; stage: string; detail: string }[] = [
    { time: map.data.cutoff, stage: "Point-in-time data", detail: `${map.data.ticker} snapshot ${map.data.state.toLowerCase()} · ${map.provenance.dataset}` },
    ...map.analysts.map((a) => ({
      time: a.evidence[0]?.time ?? map.timestamp,
      stage: "Independent view",
      detail: `${a.name} conviction ${a.conviction >= 0 ? "+" : ""}${a.conviction.toFixed(2)} (${a.horizonDays}d)${a.included ? "" : " · excluded"}`,
    })),
    { time: map.timestamp, stage: "Committee", detail: `Net view ${map.committee.netView >= 0 ? "+" : ""}${map.committee.netView.toFixed(2)} · ${map.committee.method}` },
    { time: map.timestamp, stage: "Risk gate", detail: `${map.risk.result} · ${map.risk.reason}` },
    ...(map.execution
      ? [{ time: map.timestamp, stage: "Execution", detail: `${map.execution.status} · ${map.execution.side} ${map.execution.qty} @ $${map.execution.price.toFixed(2)} · ${map.execution.ledgerId}` }]
      : [{ time: map.timestamp, stage: "Execution", detail: "No trade — target weight flat" }]),
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
              <TableCell className={cn(CELL, "font-medium text-foreground")}>
                {e.stage}
              </TableCell>
              <TableCell className={cn(CELL, "pr-4 text-muted-foreground")}>
                {e.detail}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function DecisionMapView({
  basePath,
  map,
}: {
  basePath: string
  map: DecisionMap
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <Header basePath={basePath} map={map} />

      <Tabs defaultValue="map">
        <TabsList variant="line">
          <TabsTrigger value="map">Decision map</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="flex flex-col gap-4 pt-4">
          <ProvenanceStrip map={map} />
          <DecisionFlow map={map} />
        </TabsContent>

        <TabsContent value="evidence" className="pt-4">
          <EvidenceTab map={map} />
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <AuditTab map={map} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
