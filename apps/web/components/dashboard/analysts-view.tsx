"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  MoreVerticalIcon,
  Refresh01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  MasterDetail,
  MasterDetailList,
  MasterDetailPanel,
} from "@workspace/ui/components/master-detail"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import {
  ANALYST_RECENT_SIGNALS,
  ANALYST_REGISTRY,
  ANALYST_TABS,
  COMMITTEE_DISAGREEMENT,
  COMMITTEE_USAGE,
  DATA_LAST_CHECKED,
  getAnalystDetail,
  type AnalystRegistryRow,
  type OperationalHealthRow,
} from "./demo-data"
import { formatInteger, pnlToneClass } from "./format"
import { AnalystKindBadge, StatusPill } from "./primitives"
import { SignalBehaviorChart } from "./analysts/signal-behavior-chart"

/* ------------------------------------------------------------------ */
/* Small local helpers                                                 */
/* ------------------------------------------------------------------ */

type KindFilter = "all" | AnalystRegistryRow["kind"]
type HealthFilter = "all" | AnalystRegistryRow["health"]
type SortKey = "default" | "ic" | "abstain"

const HEADER_TIMESTAMP = DATA_LAST_CHECKED

/** Compact section title with an optional info affordance, house-style. */
function PanelTitle({
  children,
  info,
}: {
  children: React.ReactNode
  info?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {info ? (
        <HugeiconsIcon
          icon={InformationCircleIcon}
          size={13}
          className="text-muted-foreground"
          aria-label={info}
        />
      ) : null}
    </div>
  )
}

/** A thin outlined card that sits on the inspector's card surface. */
function InnerCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex flex-col gap-3 border border-border p-3.5", className)}
      {...props}
    />
  )
}

/** A page-level card matching the StatBar / inspector ring treatment. */
function SurfaceCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-none bg-card ring-1 ring-foreground/10",
        className
      )}
      {...props}
    />
  )
}

/** Operational-health status: a check circle (verified/healthy) or alert. */
function OpStatus({ status }: { status: OperationalHealthRow["status"] }) {
  const attention = status === "attention"
  const label =
    status === "verified"
      ? "Verified"
      : status === "healthy"
        ? "Healthy"
        : "Attention"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        attention ? "text-warning" : "text-success"
      )}
    >
      <HugeiconsIcon
        icon={attention ? Alert01Icon : CheckmarkCircle02Icon}
        size={14}
        strokeWidth={2}
      />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Top summary strip                                                   */
/* ------------------------------------------------------------------ */

/** One cell in the summary strip — optionally a toggle with an active underline. */
function StripCell({
  label,
  value,
  dot,
  active,
  onClick,
}: {
  label: React.ReactNode
  value: React.ReactNode
  dot?: string
  active?: boolean
  onClick?: () => void
}) {
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-2 border-b-2 pb-1",
        active ? "border-primary" : "border-transparent"
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        {dot ? (
          <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        ) : null}
        {label}
      </span>
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </span>
  )

  return (
    <div className="flex min-w-[9rem] flex-1 items-center border-l border-border px-4 py-3 first:border-l-0">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          className="outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function AnalystsView() {
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortKey>("default")
  const [kind, setKind] = React.useState<KindFilter>("all")
  const [health, setHealth] = React.useState<HealthFilter>("all")
  const [selectedId, setSelectedId] = React.useState(ANALYST_REGISTRY[0]!.id)

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = ANALYST_REGISTRY.filter(
      (row) =>
        (kind === "all" || row.kind === kind) &&
        (health === "all" || row.health === health) &&
        (needle === "" || row.name.toLowerCase().includes(needle))
    )
    if (sort === "ic") {
      return [...rows].sort((a, b) => b.ic90d - a.ic90d)
    }
    if (sort === "abstain") {
      return [...rows].sort((a, b) => a.abstainPct - b.abstainPct)
    }
    return rows
  }, [query, kind, health, sort])

  const selected =
    ANALYST_REGISTRY.find((row) => row.id === selectedId) ?? ANALYST_REGISTRY[0]!
  const detail = getAnalystDetail(selected.id)
  const handle = `${selected.kind}.${selected.id}`

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Analysts
          </h1>
          <p className="text-sm text-muted-foreground">
            Versioned signal models — behavior, reliability, evidence, and
            committee usage.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button>
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
            New analyst
          </Button>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {HEADER_TIMESTAMP}
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div
        role="group"
        aria-label="Analyst roster summary"
        className="flex flex-wrap items-stretch overflow-hidden rounded-none bg-card ring-1 ring-foreground/10"
      >
        <StripCell
          label="Active"
          value={ANALYST_TABS.active}
          active={health !== "degraded"}
          onClick={() => setHealth("all")}
        />
        <StripCell
          label="Degraded"
          value={ANALYST_TABS.degraded}
          dot="bg-warning"
          active={health === "degraded"}
          onClick={() => setHealth("degraded")}
        />
        <StripCell label="Abstention rate" value={ANALYST_TABS.abstentionRate} />
        <StripCell
          label="Signals this month"
          value={formatInteger(ANALYST_TABS.signalsThisMonth)}
        />
      </div>

      {/* Master–detail */}
      <MasterDetail className="lg:grid-cols-[minmax(340px,5fr)_minmax(0,8fr)]">
        {/* Registry */}
        <MasterDetailList>
          <SurfaceCard>
            <div className="flex flex-col gap-3 border-b border-border p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[11rem] flex-1">
                  <HugeiconsIcon
                    icon={Search01Icon}
                    size={14}
                    strokeWidth={2}
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search analysts…"
                    aria-label="Search analysts"
                    className="pl-8"
                  />
                </div>
                <Select
                  value={sort}
                  onValueChange={(next) => setSort(next as SortKey)}
                >
                  <SelectTrigger aria-label="Sort analysts">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">All</SelectItem>
                    <SelectItem value="ic">Highest IC</SelectItem>
                    <SelectItem value="abstain">Lowest abstain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={kind}
                  onValueChange={(next) => setKind(next as KindFilter)}
                >
                  <SelectTrigger aria-label="Filter by kind">
                    <span className="text-muted-foreground">Kind:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="quant">Quant</SelectItem>
                    <SelectItem value="llm">LLM</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={health}
                  onValueChange={(next) => setHealth(next as HealthFilter)}
                >
                  <SelectTrigger aria-label="Filter by health">
                    <span className="text-muted-foreground">Health:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                  </SelectContent>
                </Select>
                <Select value="us-oslo" onValueChange={() => {}}>
                  <SelectTrigger aria-label="Filter by universe">
                    <span className="text-muted-foreground">Universe:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-oslo">US &amp; Oslo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="px-1.5">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 normal-case">Analyst</TableHead>
                    <TableHead className="h-9 normal-case">Kind</TableHead>
                    <TableHead className="h-9 normal-case">Version</TableHead>
                    <TableHead className="h-9 normal-case">Health</TableHead>
                    <TableHead className="h-9 normal-case text-right">
                      90d IC
                    </TableHead>
                    <TableHead className="h-9 normal-case text-right">
                      Abstain
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const isSelected = row.id === selected.id
                    return (
                      <TableRow
                        key={row.id}
                        data-state={isSelected ? "selected" : undefined}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedId(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedId(row.id)
                          }
                        }}
                        className="cursor-pointer outline-none focus-visible:bg-muted/60"
                      >
                        <TableCell className="h-10 font-medium text-foreground">
                          {row.name}
                        </TableCell>
                        <TableCell className="h-10">
                          <AnalystKindBadge kind={row.kind} />
                        </TableCell>
                        <TableCell className="h-10 font-mono text-xs text-muted-foreground tabular-nums">
                          {row.version}
                        </TableCell>
                        <TableCell className="h-10">
                          <StatusPill status={row.health} appearance="dot" />
                        </TableCell>
                        <TableCell className="h-10 text-right font-mono text-xs text-foreground tabular-nums">
                          {row.ic90d.toFixed(3)}
                        </TableCell>
                        <TableCell className="h-10 text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {row.abstainPct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="border-t border-border px-3.5 py-2.5">
              <span className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-mono tabular-nums">{filtered.length}</span>{" "}
                of{" "}
                <span className="font-mono tabular-nums">
                  {ANALYST_REGISTRY.length}
                </span>{" "}
                analysts
              </span>
            </div>
          </SurfaceCard>
        </MasterDetailList>

        {/* Inspector */}
        <MasterDetailPanel className="flex flex-col gap-4">
          {/* Identity */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-lg font-semibold text-foreground">
                  {selected.name}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  id
                  <span className="font-mono text-foreground">{handle}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {selected.version}
                </span>
                <AnalystKindBadge kind={selected.kind} />
                <StatusPill status={selected.health} />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Test analyst
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary hover:text-primary"
                >
                  New version
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="More actions"
                >
                  <HugeiconsIcon
                    icon={MoreVerticalIcon}
                    size={15}
                    strokeWidth={2}
                  />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.description}
            </p>
          </div>

          {/* Input / method / output / failure strip */}
          <div className="grid grid-cols-2 border border-border sm:grid-cols-4">
            <IoCell label="Input" value={detail.io.input} />
            <IoCell label="Method" value={detail.io.method} />
            <IoCell label="Output" value={detail.io.output} />
            <IoCell label="Failure behavior" value={detail.io.failure} />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="overview" className="flex-none">
                Overview
              </TabsTrigger>
              <TabsTrigger value="prompt" className="flex-none">
                Prompt &amp; evidence
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="flex-none">
                Diagnostics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Signal behavior */}
                <InnerCard>
                  <PanelTitle info="Realized outcome by conviction decile, 90-day window.">
                    Signal behavior (90d)
                  </PanelTitle>
                  <dl className="grid grid-cols-4 gap-3">
                    <BehaviorStat label="IC" value={detail.behavior.ic} />
                    <BehaviorStat
                      label="Hit rate"
                      value={detail.behavior.hitRate}
                    />
                    <BehaviorStat
                      label="Avg conviction"
                      value={detail.behavior.avgConviction}
                    />
                    <BehaviorStat
                      label="Coverage"
                      value={detail.behavior.coverage}
                    />
                  </dl>
                  <SignalBehaviorChart
                    deciles={detail.behaviorDeciles}
                  />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[2px] bg-success" />
                      Strong positive relationship
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-0 w-4 border-t-2 border-dashed border-border" />
                      Neutral baseline (0)
                    </span>
                  </div>
                </InnerCard>

                {/* Operational health */}
                <InnerCard>
                  <PanelTitle>Operational health</PanelTitle>
                  <dl className="flex flex-col">
                    {detail.operational.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center gap-3 border-b border-border py-2.5 first:pt-0 last:border-b-0"
                      >
                        <dt className="w-32 shrink-0 text-xs text-muted-foreground">
                          {row.label}
                        </dt>
                        <dd className="flex-1 truncate font-mono text-xs text-foreground tabular-nums">
                          {row.value}
                        </dd>
                        <OpStatus status={row.status} />
                      </div>
                    ))}
                  </dl>
                  <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      Last refreshed
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground tabular-nums">
                        {detail.lastRefreshed}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Refresh operational health"
                      >
                        <HugeiconsIcon
                          icon={Refresh01Icon}
                          size={14}
                          strokeWidth={2}
                        />
                      </Button>
                    </span>
                  </div>
                </InnerCard>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="pt-4">
              <TabPlaceholder
                title="Prompt & evidence"
                body="The rendered prompt template, retrieved evidence, and the written thesis for the most recent signal appear here."
              />
            </TabsContent>

            <TabsContent value="diagnostics" className="pt-4">
              <TabPlaceholder
                title="Diagnostics"
                body="Calibration curves, abstention drivers, and parse-failure traces for this analyst version appear here."
              />
            </TabsContent>
          </Tabs>
        </MasterDetailPanel>
      </MasterDetail>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Recent signals */}
        <SurfaceCard>
          <div className="flex items-center justify-between gap-3 border-b border-border p-3.5">
            <PanelTitle info="The latest signals this analyst emitted, with realized 10-day outcomes.">
              Recent signals
            </PanelTitle>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 normal-case">Time (UTC)</TableHead>
                <TableHead className="h-9 normal-case">Security</TableHead>
                <TableHead className="h-9 normal-case">As-of cutoff</TableHead>
                <TableHead className="h-9 normal-case text-right">
                  Conviction
                </TableHead>
                <TableHead className="h-9 normal-case">Horizon</TableHead>
                <TableHead className="h-9 normal-case">Thesis</TableHead>
                <TableHead className="h-9 normal-case text-right">
                  Outcome (10d)
                </TableHead>
                <TableHead className="h-9 normal-case">Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ANALYST_RECENT_SIGNALS.map((signal) => (
                <TableRow key={signal.run} className="hover:bg-muted/40">
                  <TableCell className="h-10 font-mono text-xs text-muted-foreground tabular-nums">
                    {signal.time}
                  </TableCell>
                  <TableCell className="h-10 font-mono text-xs font-semibold text-foreground">
                    {signal.security}
                  </TableCell>
                  <TableCell className="h-10 font-mono text-xs text-muted-foreground tabular-nums">
                    {signal.asOfCutoff}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "h-10 text-right font-mono text-xs font-medium tabular-nums",
                      pnlToneClass(signal.conviction)
                    )}
                  >
                    {signal.conviction > 0 ? "+" : ""}
                    {signal.conviction.toFixed(2)}
                  </TableCell>
                  <TableCell className="h-10 font-mono text-xs text-muted-foreground tabular-nums">
                    {signal.horizon}
                  </TableCell>
                  <TableCell className="h-10 max-w-[18rem] truncate text-xs text-muted-foreground">
                    {signal.thesis}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "h-10 text-right font-mono text-xs font-medium tabular-nums",
                      pnlToneClass(Number.parseFloat(signal.outcome))
                    )}
                  >
                    {signal.outcome}
                  </TableCell>
                  <TableCell className="h-10 font-mono text-xs text-primary">
                    {signal.run}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5">
            <span className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-mono tabular-nums">
                {ANALYST_RECENT_SIGNALS.length}
              </span>{" "}
              of{" "}
              <span className="font-mono tabular-nums">
                {ANALYST_RECENT_SIGNALS.length}
              </span>{" "}
              signals
            </span>
            <FooterLink>View all signals</FooterLink>
          </div>
        </SurfaceCard>

        {/* Committee usage */}
        <SurfaceCard>
          <div className="border-b border-border p-3.5">
            <PanelTitle info="Strategies weighting this analyst in their committee.">
              Committee usage
            </PanelTitle>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 normal-case">Strategy</TableHead>
                <TableHead className="h-9 normal-case text-right">
                  Weight
                </TableHead>
                <TableHead className="h-9 normal-case">Since</TableHead>
                <TableHead className="h-9 normal-case text-right">
                  90d IC
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMMITTEE_USAGE.map((row) => (
                <TableRow key={row.strategy} className="hover:bg-muted/40">
                  <TableCell className="h-10 font-mono text-xs text-foreground">
                    {row.strategy}
                  </TableCell>
                  <TableCell className="h-10 text-right font-mono text-xs text-foreground tabular-nums">
                    {row.weight.toFixed(2)}
                  </TableCell>
                  <TableCell className="h-10 font-mono text-xs text-muted-foreground tabular-nums">
                    {row.since}
                  </TableCell>
                  <TableCell className="h-10 text-right font-mono text-xs text-success tabular-nums">
                    {row.ic90d.toFixed(3)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-3">
            <span className="text-xs text-muted-foreground">
              Disagreement correlation (avg)
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-foreground tabular-nums">
                {COMMITTEE_DISAGREEMENT.correlation.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-success">
                {COMMITTEE_DISAGREEMENT.rating}
              </span>
            </span>
          </div>
          <div className="border-t border-border px-3.5 py-2.5">
            <FooterLink>View in strategies</FooterLink>
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Leaf components                                                     */
/* ------------------------------------------------------------------ */

function IoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-border px-3.5 py-3 first:border-l-0 [&:nth-child(3)]:border-l-0 sm:[&:nth-child(3)]:border-l">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

function BehaviorStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-lg font-semibold text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function FooterLink({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:text-primary/80"
    >
      {children}
      <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={2} />
    </button>
  )
}

function TabPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-1 border border-dashed border-border p-6">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <p className="max-w-prose text-xs/relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
