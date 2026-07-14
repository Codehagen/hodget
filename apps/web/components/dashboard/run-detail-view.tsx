import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Download04Icon,
  GitCompareIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Separator } from "@workspace/ui/components/separator"
import { StatBar, StatItem } from "@workspace/ui/components/stat"
import { StageStepper } from "@workspace/ui/components/stage-stepper"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  RUN_EVIDENCE,
  type PipelineStage,
  type RunDetail,
} from "./demo-data"
import { formatSignedPercent, pnlToneClass } from "./format"
import { StatusPill } from "./primitives"
import { RunEquityChart } from "./run-equity-chart"
import { CopyButton } from "./run-detail/copy-button"
import { DecisionLog } from "./run-detail/decision-log"

/* ------------------------------------------------------------------ */
/* Per-run header model — everything drawn from the opened run          */
/* ------------------------------------------------------------------ */

// A completed run has cleared every pipeline stage. The stage rail is a
// property of the run's terminal state, so it is derived here rather than
// carried per-run in the fixture.
const COMPLETED_STAGES: PipelineStage[] = [
  { id: "data", label: "Data", state: "complete" },
  { id: "analysts", label: "Analysts", state: "complete" },
  { id: "committee", label: "Committee", state: "complete" },
  { id: "risk", label: "Risk", state: "complete" },
  { id: "fills", label: "Fills", state: "complete" },
]

/** ISO-8601 → "YYYY-MM-DD HH:MM:SS UTC" without a Date (stays deterministic). */
function formatUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`
}

/** Whole seconds → "HH:MM:SS". */
function formatDuration(seconds: number): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

type RunHeaderModel = {
  id: string
  mode: RunDetail["run"]["mode"]
  status: RunDetail["run"]["status"]
  strategy: string
  universe: string
  createdAt: string
  completedAt: string
  durationLabel: string
  stages: PipelineStage[]
  provenance: {
    datasetSnapshot: string
    codeVersion: string
    panelVersion: string
    deterministicReplay: boolean
  }
  metrics: {
    totalReturn: string
    totalReturnTone: string
    sharpe: string
    maxDrawdown: string
    turnover: string
    decisions: number
  }
  totalReturnLabel: string
  maxDrawdownLabel: string
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function RunBreadcrumb({ basePath, id }: { basePath: string; id: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={`${basePath}/runs`} />}>
            Runs
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-mono">{id}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function RunHeader({ h }: { h: RunHeaderModel }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {h.id}
          </h1>
          <StatusPill status={h.mode} />
          <StatusPill status={h.status} />
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span>
              <span className="text-muted-foreground">Strategy </span>
              <span className="font-mono font-medium text-foreground">
                {h.strategy}
              </span>
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span>
              <span className="text-muted-foreground">Universe </span>
              <span className="font-medium text-foreground">{h.universe}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            Created{" "}
            <span className="font-mono text-foreground tabular-nums">
              {h.createdAt}
            </span>
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span>
            Completed{" "}
            <span className="font-mono text-foreground tabular-nums">
              {h.completedAt}
            </span>
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span>
            Duration{" "}
            <span className="font-mono text-foreground tabular-nums">
              {h.durationLabel}
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={Download04Icon} />
          Export
        </Button>
        <Button variant="outline" size="sm" className="text-primary">
          <HugeiconsIcon icon={GitCompareIcon} />
          Compare
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stage rail + provenance strip                                       */
/* ------------------------------------------------------------------ */

function ProvenanceCell({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-border px-4 py-3 sm:border-l sm:first:border-l-0",
        className
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 text-xs">{children}</div>
    </div>
  )
}

function StageRailCard({ h }: { h: RunHeaderModel }) {
  const p = h.provenance
  return (
    <Card className="gap-0">
      <CardContent className="py-1">
        <StageStepper steps={h.stages} orientation="horizontal" labels="inline" />
      </CardContent>
      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <ProvenanceCell label="Dataset snapshot">
          <span className="font-mono font-medium text-foreground">
            {p.datasetSnapshot}
          </span>
          <CopyButton value={p.datasetSnapshot} />
        </ProvenanceCell>
        <ProvenanceCell label="Code version">
          <span className="font-mono font-medium text-foreground">
            {p.codeVersion}
          </span>
          <CopyButton value={p.codeVersion} />
        </ProvenanceCell>
        <ProvenanceCell label="Panel version">
          <span className="font-mono font-medium text-foreground">
            {p.panelVersion}
          </span>
          <CopyButton value={p.panelVersion} />
        </ProvenanceCell>
        <ProvenanceCell label="Deterministic replay">
          <span className="font-medium text-success">
            {p.deterministicReplay ? "Enabled" : "Disabled"}
          </span>
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={13}
            className="text-muted-foreground"
          />
        </ProvenanceCell>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* KPI strip                                                           */
/* ------------------------------------------------------------------ */

function KpiStrip({ h }: { h: RunHeaderModel }) {
  const m = h.metrics
  return (
    <StatBar>
      <StatItem
        label="Total return"
        value={m.totalReturn}
        valueClassName={m.totalReturnTone}
      />
      <StatItem label="Sharpe" value={m.sharpe} />
      <StatItem
        label="Max drawdown"
        value={m.maxDrawdown}
        valueClassName="text-destructive"
      />
      <StatItem label="Turnover" value={m.turnover} />
      <StatItem label="Decisions" value={String(m.decisions)} />
    </StatBar>
  )
}

/* ------------------------------------------------------------------ */
/* Run evidence                                                        */
/* ------------------------------------------------------------------ */

const EVIDENCE_HEAD =
  "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground"

function RunEvidenceCard() {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle>Run evidence</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(EVIDENCE_HEAD, "pl-(--card-spacing)")}>
                Component
              </TableHead>
              <TableHead className={EVIDENCE_HEAD}>Version / Snapshot</TableHead>
              <TableHead className={cn(EVIDENCE_HEAD, "pr-(--card-spacing) text-right")}>
                Verified
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {RUN_EVIDENCE.map((row) => (
              <TableRow key={row.component} className="hover:bg-transparent">
                <TableCell className="h-auto py-2.5 pl-(--card-spacing) text-xs text-foreground">
                  {row.component}
                </TableCell>
                <TableCell className="h-auto py-2.5 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-muted-foreground">
                      {row.version}
                    </span>
                    <CopyButton value={row.version} />
                  </span>
                </TableCell>
                <TableCell className="h-auto py-2.5 pr-(--card-spacing) text-right">
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={16}
                    className={cn(
                      "inline-block",
                      row.verified ? "text-success" : "text-muted-foreground"
                    )}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        All components verified and immutable.
      </CardFooter>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Pending / non-completed state                                       */
/* ------------------------------------------------------------------ */

function PendingRun({ basePath, detail }: { basePath: string; detail: RunDetail }) {
  const { run } = detail
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <RunBreadcrumb basePath={basePath} id={run.id} />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {run.id}
          </h1>
          <StatusPill status={run.mode} />
          <StatusPill status={run.status} />
        </div>
      </div>
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No results yet</EmptyTitle>
              <EmptyDescription>
                {run.status === "failed"
                  ? "This run failed before producing metrics or fills. The equity curve, run evidence, and decision log are only available for completed runs."
                  : "This run is still in the queue or executing. Metrics, the equity curve, and the decision log appear once it completes."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function RunDetailView({
  basePath,
  detail,
}: {
  basePath: string
  detail: RunDetail
}) {
  const { run, strategy, metrics, equity, decisions, completedAt, durationSeconds } =
    detail

  if (run.status !== "completed" || !metrics) {
    return <PendingRun basePath={basePath} detail={detail} />
  }

  // Total return is derived from the same curve the chart draws, so the KPI, the
  // legend figure, and the drawn line can never disagree.
  const first = equity[0]?.equity ?? 1
  const last = equity[equity.length - 1]?.equity ?? first
  const totalReturnPct = (last / first - 1) * 100
  const totalReturnLabel = formatSignedPercent(totalReturnPct)
  const maxDrawdownLabel = formatSignedPercent(metrics.maxDrawdown)
  const decisionCount = decisions.reduce((n, day) => n + day.securities.length, 0)

  const h: RunHeaderModel = {
    id: run.id,
    mode: run.mode,
    status: run.status,
    strategy: run.strategy,
    universe: strategy.universeLabel,
    createdAt: formatUtc(run.createdAt),
    completedAt: completedAt ? formatUtc(completedAt) : "—",
    durationLabel: durationSeconds != null ? formatDuration(durationSeconds) : "—",
    stages: COMPLETED_STAGES,
    provenance: {
      datasetSnapshot: "ds_9a7e52b1",
      codeVersion: "v1.24.3",
      panelVersion: `${strategy.id}@${strategy.version}`,
      deterministicReplay: true,
    },
    metrics: {
      totalReturn: totalReturnLabel,
      totalReturnTone: pnlToneClass(totalReturnPct),
      sharpe: metrics.sharpe.toFixed(2),
      maxDrawdown: maxDrawdownLabel,
      turnover: `${metrics.turnover.toFixed(2)}×`,
      decisions: decisionCount,
    },
    totalReturnLabel,
    maxDrawdownLabel,
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <RunBreadcrumb basePath={basePath} id={h.id} />
        <RunHeader h={h} />
      </div>

      <StageRailCard h={h} />
      <KpiStrip h={h} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.35fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-0">
            <CardHeader className="pb-2">
              <CardTitle>Portfolio equity</CardTitle>
            </CardHeader>
            <CardContent>
              <RunEquityChart
                data={equity}
                totalReturnLabel={h.totalReturnLabel}
                maxDrawdownLabel={h.maxDrawdownLabel}
              />
            </CardContent>
          </Card>
          <RunEvidenceCard />
        </div>

        <div className="min-w-0">
          <DecisionLog />
        </div>
      </div>
    </div>
  )
}
