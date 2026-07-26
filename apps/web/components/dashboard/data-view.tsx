import { Fragment, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { StatBar, StatItem } from "@workspace/ui/components/stat"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  COVERAGE_MATRIX,
  DATA_INCIDENTS,
  DATA_KPIS,
  DATA_LAST_CHECKED,
  DATA_QUALITY_CHECKS,
  DATA_RETENTION,
  DATA_SNAPSHOTS,
  DATA_SNAPSHOTS_TOTAL,
  PIT_FLOW,
  PIT_RULES,
  ROUTING_HEALTH,
  type CoverageState,
} from "./demo-data"
import { formatInteger } from "./format"
import { SectionHeader, StatusPill } from "./primitives"

/**
 * Data — coverage, freshness, lineage, and point-in-time integrity. Purely
 * presentational: every value arrives through `demo-data`, so this same view
 * backs both the authenticated `/dashboard/data` and the public `/demo/data`
 * routes. No `"use client"` — it stays server-rendered and prerenderable.
 */

/* ------------------------------------------------------------------ */
/* Small shared status atoms (mock uses inline icon + colored text,    */
/* not the filled StatusPill, for coverage/verification/quality)       */
/* ------------------------------------------------------------------ */

/** Green success check — the health-strip / rules affordance. */
function OkCheck({ size = 15 }: { size?: number }) {
  return (
    <HugeiconsIcon
      icon={CheckmarkCircle02Icon}
      size={size}
      className="shrink-0 text-success"
    />
  )
}

const COVERAGE_META: Record<
  CoverageState,
  { icon: IconSvgElement; className: string; label: string }
> = {
  covered: { icon: CheckmarkCircle02Icon, className: "text-success", label: "Covered" },
  partial: { icon: Alert02Icon, className: "text-warning", label: "Partial" },
  "not-covered": {
    icon: CancelCircleIcon,
    className: "text-destructive",
    label: "Not covered",
  },
  "covered-empty": { icon: Alert02Icon, className: "text-warning", label: "Empty" },
}

/** Coverage cell — icon + colored label (matches the mock's unboxed style). */
function CoverageCell({ state }: { state: CoverageState }) {
  const meta = COVERAGE_META[state]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        meta.className
      )}
    >
      <HugeiconsIcon icon={meta.icon} size={14} className="shrink-0" />
      {meta.label}
    </span>
  )
}

const CHECK_META = {
  passed: { icon: CheckmarkCircle02Icon, className: "text-success", label: "Passed" },
  drift: { icon: Alert02Icon, className: "text-warning", label: "Drift review" },
} as const

/** Passed / drift-review status — quality checks and snapshot verification. */
function CheckStatus({ state }: { state: keyof typeof CHECK_META }) {
  const meta = CHECK_META[state]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        meta.className
      )}
    >
      <HugeiconsIcon icon={meta.icon} size={14} className="shrink-0" />
      {meta.label}
    </span>
  )
}

/** Muted informational glyph next to a section label. Decorative. */
function InfoDot() {
  return (
    <HugeiconsIcon
      icon={InformationCircleIcon}
      size={13}
      className="text-muted-foreground/60"
      aria-hidden
    />
  )
}

/** A link-styled action that carries an external-link glyph. */
function ViewLink({ children }: { children: ReactNode }) {
  return (
    <Button
      variant="link"
      className="h-auto gap-1 p-0 text-xs font-medium text-primary"
    >
      {children}
      <HugeiconsIcon icon={LinkSquare02Icon} size={13} />
    </Button>
  )
}

/* Full-bleed table: header underline + row hover span the card, while the
 * first/last columns still align to the card's own horizontal padding. */
const flushTable = cn(
  "[&_thead_th:first-child]:pl-4 [&_tbody_td:first-child]:pl-4",
  "[&_thead_th:last-child]:pr-4 [&_tbody_td:last-child]:pr-4",
  "[&_thead_th]:h-9 [&_tbody_td]:h-11"
)

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function CoverageMatrixCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage matrix</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table className={flushTable}>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>US (XNAS/XNYS)</TableHead>
              <TableHead>Norway (XOSL)</TableHead>
              <TableHead>Historical depth</TableHead>
              <TableHead>Freshness</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COVERAGE_MATRIX.map((row) => (
              <TableRow key={row.domain}>
                <TableCell className="font-medium text-foreground">
                  {row.domain}
                </TableCell>
                <TableCell>
                  <CoverageCell state={row.us} />
                </TableCell>
                <TableCell>
                  <CoverageCell state={row.norway} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.historicalDepth}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.freshness}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.source}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="gap-6">
        <CoverageCell state="covered" />
        <CoverageCell state="partial" />
        <CoverageCell state="not-covered" />
      </CardFooter>
    </Card>
  )
}

function RoutingHealthCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Routing &amp; health</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table className={flushTable}>
          <TableHeader>
            <TableRow>
              <TableHead>Exchange / Feed</TableHead>
              <TableHead>Routes to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>p95 latency</TableHead>
              <TableHead>Last successful sync</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROUTING_HEALTH.map((row) => (
              <TableRow key={row.exchange}>
                <TableCell className="font-mono text-xs font-medium text-foreground">
                  {row.exchange}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.routesTo}
                </TableCell>
                <TableCell>
                  <StatusPill status={row.status} appearance="dot" />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.p95Latency}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.lastSync}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function IncidentsCard() {
  const { warnings, incidents, items } = DATA_INCIDENTS
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Incidents &amp; warnings</CardTitle>
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span
              className={cn(
                "font-medium",
                warnings > 0 ? "text-warning" : "text-muted-foreground"
              )}
            >
              {warnings} warning{warnings === 1 ? "" : "s"}
            </span>
            <span className="text-muted-foreground">
              {incidents} incident{incidents === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No open incidents or warnings.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {items.map((item) => (
              <li
                key={item.label}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="flex items-center gap-2 text-xs text-foreground">
                  <HugeiconsIcon
                    icon={Alert02Icon}
                    size={14}
                    className="shrink-0 text-warning"
                  />
                  {item.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  Since {item.since}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function PitPolicyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Point-in-time policy</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {PIT_FLOW.map((step, i) => (
            <Fragment key={step.title}>
              <div className="flex flex-1 flex-col gap-1 border border-border bg-muted/30 p-3">
                <span className="text-sm font-medium text-foreground">
                  {step.title}
                </span>
                <p className="text-xs/relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
              {i < PIT_FLOW.length - 1 ? (
                <div
                  className="hidden shrink-0 items-center justify-center text-muted-foreground lg:flex"
                  aria-hidden
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-xs">
          <span className="font-medium text-muted-foreground">
            Rules &amp; guarantees
          </span>
          {PIT_RULES.map((rule) => (
            <span key={rule.label} className="flex items-center gap-1.5">
              <OkCheck size={14} />
              <span className="font-medium text-foreground">{rule.label}:</span>
              <span className="text-muted-foreground">{rule.value}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SnapshotsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent snapshots</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table className={flushTable}>
          <TableHeader>
            <TableRow>
              <TableHead>Snapshot ID</TableHead>
              <TableHead>Created UTC</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Hash (SHA-256)</TableHead>
              <TableHead className="text-right">Used by runs</TableHead>
              <TableHead>Verification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DATA_SNAPSHOTS.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs font-medium text-foreground">
                  {row.id}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.createdUtc}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.coverage}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatInteger(row.rows)}
                </TableCell>
                <TableCell>
                  <span className="block max-w-[16rem] truncate font-mono text-xs text-muted-foreground">
                    {row.hash}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {row.usedByRuns}
                </TableCell>
                <TableCell>
                  <CheckStatus state={row.verified ? "passed" : "drift"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-xs text-muted-foreground">
          Showing 1 to {DATA_SNAPSHOTS.length} of {DATA_SNAPSHOTS_TOTAL} snapshots
        </span>
        <ViewLink>View all snapshots</ViewLink>
      </CardFooter>
    </Card>
  )
}

function QualityChecksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Data quality checks
          <InfoDot />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table className={flushTable}>
          <TableHeader>
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last checked (UTC)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DATA_QUALITY_CHECKS.map((row) => (
              <TableRow key={row.check}>
                <TableCell className="text-xs text-foreground">
                  {row.check}
                </TableCell>
                <TableCell>
                  <CheckStatus state={row.status} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.lastChecked}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="justify-end">
        <ViewLink>View check history</ViewLink>
      </CardFooter>
    </Card>
  )
}

function RetentionCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention &amp; licensing</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 md:divide-x md:divide-border">
        {DATA_RETENTION.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex flex-wrap items-start justify-between gap-x-8 gap-y-3",
              i > 0 ? "md:pl-8" : undefined
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {row.label}
                <InfoDot />
              </span>
              <p className="text-xs text-muted-foreground">{row.note}</p>
            </div>
            <dl className="flex shrink-0 flex-col gap-1.5 text-xs">
              <div className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 text-muted-foreground">Retention</dt>
                <dd className="font-mono text-foreground tabular-nums">
                  {row.retention}
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 text-muted-foreground">License</dt>
                <dd className="text-foreground">{row.license}</dd>
              </div>
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function DataView() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Data"
        description="Coverage, freshness, lineage, and point-in-time integrity."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline">Refresh checks</Button>
            <Button>Add source</Button>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {DATA_LAST_CHECKED}
            </span>
          </div>
        }
      />

      <StatBar>
        {DATA_KPIS.map((kpi) => (
          <StatItem
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            status={<OkCheck size={18} />}
          />
        ))}
        <StatItem
          label="Last checked"
          value={DATA_LAST_CHECKED}
          valueClassName="text-sm font-normal text-muted-foreground"
        />
      </StatBar>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CoverageMatrixCard />
          </div>
          <div className="flex flex-col gap-4">
            <RoutingHealthCard />
            <IncidentsCard />
          </div>
        </div>

        <PitPolicyCard />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SnapshotsCard />
          </div>
          <div>
            <QualityChecksCard />
          </div>
        </div>

        <RetentionCard />
      </div>
    </div>
  )
}
