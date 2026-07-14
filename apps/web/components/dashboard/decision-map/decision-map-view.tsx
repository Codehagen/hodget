import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"

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

import { StatusPill } from "../primitives"
import { CopyButton } from "../run-detail/copy-button"
import type { DecisionMap } from "./data"
import { DecisionCanvas } from "./decision-canvas"
import { AuditTab, EvidenceTab } from "./decision-tabs"

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
          <TabsTrigger value="map">Explanation</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="audit">Audit &amp; replay</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="flex flex-col gap-4 pt-4">
          <ProvenanceStrip map={map} />
          <DecisionCanvas map={map} />
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
