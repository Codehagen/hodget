"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Edit02Icon,
  LinkSquare02Icon,
  MoreVerticalIcon,
  PlayIcon,
  Search01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  MasterDetail,
  MasterDetailList,
  MasterDetailPanel,
} from "@workspace/ui/components/master-detail"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import {
  getStrategyDetail,
  getValidationHistory,
  STRATEGY_REGISTRY,
  STRATEGY_TABS,
  type PanelSeat,
  type PromotionGate,
  type StrategyBuildStage,
  type StrategyDetail,
  type StrategyReadiness,
  type StrategyRegistryRow,
  type ValidationHistoryRow,
} from "./demo-data"
import { Figure, SectionHeader, StatusPill, type StatusName } from "./primitives"

/* ------------------------------------------------------------------ */
/* Readiness → status vocabulary                                       */
/* ------------------------------------------------------------------ */

/**
 * Map a strategy's readiness onto the shared StatusPill vocabulary. Draft uses
 * the amber "attention" tone with a "Draft" label — a promotion still owes work
 * — while paper-ready and live read green and archived stays muted.
 */
const READINESS: Record<
  StrategyReadiness,
  { status: StatusName; label?: string }
> = {
  "paper-ready": { status: "paper-ready" },
  live: { status: "live" },
  draft: { status: "attention", label: "Draft" },
  archived: { status: "archived" },
}

function ReadinessPill({
  readiness,
  appearance = "dot",
}: {
  readiness: StrategyReadiness
  appearance?: "pill" | "dot"
}) {
  const meta = READINESS[readiness]
  return (
    <StatusPill status={meta.status} appearance={appearance} label={meta.label} />
  )
}

/* ------------------------------------------------------------------ */
/* Left column — strategy registry table                               */
/* ------------------------------------------------------------------ */

function RegistryTable({
  rows,
  total,
  selectedId,
  onSelect,
}: {
  rows: StrategyRegistryRow[]
  total: number
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-4 py-3">
        <CardTitle className="font-heading text-sm">Strategy registry</CardTitle>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Strategy
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Version
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Mode / Readiness
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Last validated
              </th>
              <th className="px-4 py-2 text-right font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Sharpe (12M)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.id === selectedId
              return (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => onSelect(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onSelect(row.id)
                    }
                  }}
                  data-selected={selected || undefined}
                  className={cn(
                    "cursor-pointer border-b border-border outline-none transition-colors duration-[var(--duration-instant)] last:border-b-0 motion-reduce:transition-none",
                    "hover:bg-muted/60 focus-visible:bg-muted/60",
                    selected &&
                      "bg-primary/5 shadow-[inset_2px_0_0_0_var(--primary)] hover:bg-primary/5"
                  )}
                >
                  <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-3 py-3">
                    <Figure
                      value={row.version}
                      className="text-xs text-muted-foreground"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <ReadinessPill readiness={row.readiness} />
                  </td>
                  <td className="px-3 py-3">
                    <Figure
                      value={row.lastValidated}
                      className="text-xs text-muted-foreground"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Figure
                      value={row.sharpe12m.toFixed(2)}
                      className="text-sm text-foreground"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        Showing {rows.length === 0 ? 0 : 1} to {rows.length} of {total}{" "}
        strategies
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Stage pipeline — five arrowed stage cards                           */
/* ------------------------------------------------------------------ */

function StagePipeline({ stages }: { stages: StrategyBuildStage[] }) {
  return (
    <div className="bg-card ring-1 ring-foreground/10">
      <ol className="flex flex-col items-stretch gap-4 p-4 sm:flex-row">
        {stages.map((stage, i) => {
          const last = i === stages.length - 1
          return (
            <li
              key={stage.stage}
              className="flex flex-1 items-center gap-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {stage.stage}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {stage.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stage.caption}
                </span>
                <Figure
                  value={stage.version}
                  className="text-[11px] text-muted-foreground"
                />
              </div>
              {!last ? (
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={16}
                  className="hidden shrink-0 text-muted-foreground/60 sm:block"
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Decision system — grouped key/value table                           */
/* ------------------------------------------------------------------ */

function GroupLabel({
  children,
  rowSpan,
}: {
  children: React.ReactNode
  rowSpan: number
}) {
  return (
    <td
      rowSpan={rowSpan}
      className="w-28 border-r border-border px-3 py-2 align-top text-muted-foreground"
    >
      {children}
    </td>
  )
}

function KeyCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-2 text-muted-foreground">{children}</td>
  )
}

function DecisionSystem({ detail }: { detail: StrategyDetail }) {
  const { panel, universe, construction, risk } = detail.decisionSystem

  const universeRows: [string, string][] = [
    ["Coverage", universe.coverage],
    ["Markets", universe.markets],
    ["Base currency", universe.baseCurrency],
  ]
  const constructionRows: [string, string][] = [
    ["Mode", construction.mode],
    ["Weighting", construction.weighting],
    ["Rebalance", construction.rebalance],
  ]
  const riskRows: [string, string][] = [
    ["Max position", risk.maxPosition],
    ["Gross exposure limit", risk.grossExposureLimit],
    ["Volatility target (annualized)", risk.volatilityTarget],
  ]

  const kvGroup = (label: string, rows: [string, string][]) =>
    rows.map(([key, value], i) => (
      <tr key={key} className="border-t border-border">
        {i === 0 ? <GroupLabel rowSpan={rows.length}>{label}</GroupLabel> : null}
        <KeyCell>{key}</KeyCell>
        <td colSpan={2} className="px-3 py-2 text-foreground">
          {value}
        </td>
      </tr>
    ))

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-heading text-sm">Decision system</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit decision system"
          >
            <HugeiconsIcon icon={Edit02Icon} size={15} />
          </Button>
        </CardAction>
      </CardHeader>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {/* Panel — signal seats */}
            <tr>
              <GroupLabel rowSpan={panel.length + 1}>
                Panel
                <span className="block text-[11px]">(signal seats)</span>
              </GroupLabel>
              <th className="px-3 pt-2 pb-1 text-left font-medium text-muted-foreground">
                Signal
              </th>
              <th className="px-3 pt-2 pb-1 text-left font-medium text-muted-foreground">
                Weight
              </th>
              <th className="px-3 pt-2 pb-1 text-left font-medium text-muted-foreground">
                Notes
              </th>
            </tr>
            {panel.map((seat: PanelSeat) => (
              <tr key={seat.signal}>
                <td className="px-3 py-1.5 text-foreground">{seat.signal}</td>
                <td className="px-3 py-1.5">
                  <Figure
                    value={seat.weight.toFixed(2)}
                    className="text-xs text-foreground"
                  />
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {seat.notes}
                </td>
              </tr>
            ))}

            {kvGroup("Universe", universeRows)}
            {kvGroup("Construction", constructionRows)}
            {kvGroup("Risk", riskRows)}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Promotion evidence — gate table + next requirement                  */
/* ------------------------------------------------------------------ */

function GateStatus({ status }: { status: PromotionGate["status"] }) {
  if (status === "passed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
        Passed
      </span>
    )
  }
  if (status === "blocked") {
    return (
      <span className="inline-flex items-center gap-1.5 text-warning">
        <HugeiconsIcon icon={AlertCircleIcon} size={14} />
        Blocked
      </span>
    )
  }
  return <StatusPill status={status} appearance="dot" />
}

function PromotionEvidence({ detail }: { detail: StrategyDetail }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-heading text-sm">
          Promotion evidence
        </CardTitle>
      </CardHeader>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Gate
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Criteria
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.promotionEvidence.map((gate) => (
              <tr key={gate.gate} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 text-foreground">{gate.gate}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {gate.criteria}
                </td>
                <td className="px-3 py-2.5 font-medium">
                  <GateStatus status={gate.status} />
                </td>
                <td className="px-4 py-2.5">
                  <Figure
                    value={gate.details}
                    className="text-xs text-muted-foreground"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-xs/relaxed text-foreground">
          <span className="font-medium">Next requirement: </span>
          <span className="text-warning">{detail.nextRequirement}</span>
        </p>
        <Button variant="outline" size="sm" className="w-fit">
          View promotion policy
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <HugeiconsIcon icon={Clock01Icon} size={13} />
          Version history
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {detail.versionHistory.map((version) => (
            <button
              key={version}
              type="button"
              className="font-mono text-[11px] text-primary tabular-nums underline-offset-4 hover:underline"
            >
              {version}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="More version history"
          className="ml-auto"
        >
          <HugeiconsIcon icon={MoreVerticalIcon} size={14} />
        </Button>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Validation history — full-width table                               */
/* ------------------------------------------------------------------ */

function ValidationResult({ result }: { result: ValidationHistoryRow["result"] }) {
  if (result === "passed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
        Passed
      </span>
    )
  }
  return <StatusPill status={result} appearance="dot" />
}

function ValidationHistory({ rows }: { rows: ValidationHistoryRow[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-heading text-sm">Validation history</CardTitle>
        <CardAction className="flex items-center gap-1">
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={LinkSquare02Icon} size={14} />
            Compare evidence
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="More options">
            <HugeiconsIcon icon={MoreVerticalIcon} size={15} />
          </Button>
        </CardAction>
      </CardHeader>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              {[
                "Run",
                "Period",
                "Dataset snapshot",
                "Sharpe",
                "Max drawdown",
                "Gate",
                "Result",
              ].map((head, i) => (
                <th
                  key={head}
                  className={cn(
                    "px-3 py-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
                    i >= 3 && i <= 4 ? "text-right" : "text-left",
                    i === 0 && "pl-4",
                    i === 6 && "pr-4"
                  )}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.run}
                className="border-b border-border last:border-b-0"
              >
                <td className="py-2.5 pr-3 pl-4">
                  <Figure value={row.run} className="text-xs text-foreground" />
                </td>
                <td className="px-3 py-2.5">
                  <Figure
                    value={row.period}
                    className="text-xs text-muted-foreground"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Figure
                    value={row.snapshot}
                    className="text-xs text-muted-foreground"
                  />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Figure
                    value={row.sharpe.toFixed(2)}
                    className="text-xs text-foreground"
                  />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Figure
                    value={row.maxDrawdown}
                    className="text-xs text-muted-foreground"
                  />
                </td>
                <td className="px-3 py-2.5 text-foreground">{row.gate}</td>
                <td className="py-2.5 pr-4 pl-3 font-medium">
                  <ValidationResult result={row.result} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Inspector — selected strategy detail                                */
/* ------------------------------------------------------------------ */

function Inspector({
  strategy,
  detail,
}: {
  strategy: StrategyRegistryRow
  detail: StrategyDetail
}) {
  return (
    <MasterDetailPanel className="flex flex-col gap-4 lg:top-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-mono text-xl font-semibold tracking-tight text-foreground">
              {strategy.name}
            </h2>
            <Figure
              value={strategy.version}
              className="text-sm text-muted-foreground"
            />
            <ReadinessPill readiness={strategy.readiness} appearance="pill" />
          </div>
          <p className="max-w-prose text-sm text-muted-foreground">
            {detail.description}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={PlayIcon} size={14} />
            Run backtest
          </Button>
          <Button variant="outline" size="sm" className="text-primary">
            <HugeiconsIcon icon={Edit02Icon} size={14} />
            Edit draft
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="More options">
            <HugeiconsIcon icon={MoreVerticalIcon} size={15} />
          </Button>
        </div>
      </div>

      <StagePipeline stages={detail.stages} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DecisionSystem detail={detail} />
        <PromotionEvidence detail={detail} />
      </div>
    </MasterDetailPanel>
  )
}

/* ------------------------------------------------------------------ */
/* Tabs + search filter row                                            */
/* ------------------------------------------------------------------ */

const STRATEGY_TAB_ITEMS = [
  { value: "active", label: "Active", count: STRATEGY_TABS.active },
  { value: "draft", label: "Draft", count: STRATEGY_TABS.draft },
  { value: "archived", label: "Archived", count: STRATEGY_TABS.archived },
] as const

function TabsAndSearch({
  tab,
  onTabChange,
  query,
  onQueryChange,
}: {
  tab: string
  onTabChange: (value: string) => void
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(String(value))}
      >
        <TabsList variant="line">
          {STRATEGY_TAB_ITEMS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
              <span className="font-mono text-muted-foreground tabular-nums">
                {item.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative w-full sm:w-72">
        <HugeiconsIcon
          icon={Search01Icon}
          size={15}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search strategies…"
          aria-label="Search strategies"
          className="pl-8"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StrategiesView() {
  const [tab, setTab] = React.useState("active")
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState(STRATEGY_REGISTRY[0]!.id)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return STRATEGY_REGISTRY
    return STRATEGY_REGISTRY.filter((row) =>
      row.name.toLowerCase().includes(q)
    )
  }, [query])

  const selected =
    STRATEGY_REGISTRY.find((row) => row.id === selectedId) ??
    STRATEGY_REGISTRY[0]!
  const detail = getStrategyDetail(selected.id)
  const validation = getValidationHistory(selected.id)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Strategies"
        description="Versioned decision systems — panel, universe, construction, risk, and evidence."
        actions={
          <div className="flex items-center gap-2">
            <Button>
              <HugeiconsIcon icon={Add01Icon} size={15} />
              New strategy
            </Button>
            <Button variant="outline">
              <HugeiconsIcon icon={Upload01Icon} size={15} />
              Import
            </Button>
          </div>
        }
      />

      <TabsAndSearch
        tab={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
      />

      <MasterDetail className="lg:grid-cols-[minmax(0,420px)_1fr]">
        <MasterDetailList>
          <RegistryTable
            rows={filtered}
            total={STRATEGY_REGISTRY.length}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </MasterDetailList>
        <Inspector strategy={selected} detail={detail} />
      </MasterDetail>

      <ValidationHistory rows={validation} />
    </div>
  )
}
