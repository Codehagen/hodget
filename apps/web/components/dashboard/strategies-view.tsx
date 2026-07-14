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
  InformationCircleIcon,
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
import { StatBar, StatItem } from "@workspace/ui/components/stat"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { TableRow } from "@workspace/ui/components/table"

import {
  getStrategyDetail,
  getValidationHistory,
  STRATEGY_REGISTRY,
  STRATEGY_TABS,
  type PanelSeat,
  type StrategyDetail,
  type StrategyReadiness,
  type StrategyRegistryRow,
  type ValidationHistoryRow,
} from "./demo-data"
import { pnlToneClass } from "./format"
import { Figure, SectionHeader, StatusPill, type StatusName } from "./primitives"
import {
  advisorQuestion,
  getStrategyCopy,
  getStrategyEvidence,
  type GateEvidence,
  type OosPoint,
  type StrategyCopy,
  type StrategyDecisionRow,
  type StrategyEvidence,
} from "./strategies/fixtures"

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
/* Derivations — shape the technical fixtures into the plain panels    */
/* ------------------------------------------------------------------ */

/** The rebalance cadence word, e.g. "Weekly (Friday close)" → "weekly". */
function cadenceWord(rebalance: string): string {
  return (rebalance.split(" (")[0] ?? rebalance).toLowerCase()
}

/** The parenthetical detail, e.g. "Weekly (Friday close)" → "Friday close". */
function rebalanceDetail(rebalance: string): string {
  const match = rebalance.match(/\(([^)]+)\)/)
  return match ? match[1]! : rebalance
}

type FlowStep = { title: string; lines: string[] }

/** The five plain-language steps from evidence to positions. */
function buildFlowSteps(detail: StrategyDetail): FlowStep[] {
  const { panel, universe, construction, risk } = detail.decisionSystem
  return [
    { title: "Where it looks", lines: [universe.coverage, universe.markets] },
    { title: "What forms a view", lines: [`${panel.length} independent signals`] },
    { title: "How views combine", lines: [`${construction.weighting} blend`] },
    {
      title: "How positions are built",
      lines: [`${construction.mode} · ${cadenceWord(construction.rebalance)}`],
    },
    {
      title: "What limits every trade",
      lines: [
        `${risk.maxPosition} per name · ${risk.grossExposureLimit} gross · ${risk.volatilityTarget} volatility`,
      ],
    },
  ]
}

/** The risk-contract key/value rows (hard, deterministic limits). */
function riskContractRows(detail: StrategyDetail): [string, string][] {
  const { construction, risk } = detail.decisionSystem
  return [
    ["Maximum position", risk.maxPosition],
    ["Gross exposure limit", risk.grossExposureLimit],
    ["Volatility target", risk.volatilityTarget],
    ["Mode", construction.mode],
    ["Rebalance", rebalanceDetail(construction.rebalance)],
  ]
}

/* ------------------------------------------------------------------ */
/* Left column — strategy library table                                */
/* ------------------------------------------------------------------ */

function DrawdownFigure({ value }: { value: string }) {
  const num = Number(value.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0)
  return <Figure value={value} className={cn("text-sm", pnlToneClass(num))} />
}

function LibraryTable({
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
        <CardTitle className="font-heading text-sm">Strategy library</CardTitle>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              {[
                { label: "Strategy", align: "left" },
                { label: "Readiness", align: "left" },
                { label: "OOS Sharpe", align: "right" },
                { label: "Worst drawdown", align: "right" },
                { label: "Last validated", align: "left" },
              ].map((head, i, all) => (
                <th
                  key={head.label}
                  className={cn(
                    "px-3 py-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
                    head.align === "right" ? "text-right" : "text-left",
                    i === 0 && "pl-4",
                    i === all.length - 1 && "pr-4"
                  )}
                >
                  {head.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.id === selectedId
              const evidence = getStrategyEvidence(row.id)
              return (
                <TableRow
                  key={row.id}
                  data-state={selected ? "selected" : undefined}
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
                  className="cursor-pointer outline-none last:border-b-0 focus-visible:bg-muted/60 data-[state=selected]:bg-primary/5 data-[state=selected]:shadow-[inset_2px_0_0_0_var(--primary)] data-[state=selected]:hover:bg-primary/5"
                >
                  <td className="py-3 pr-3 pl-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {row.name}
                      </span>
                      <Figure
                        value={row.version}
                        className="text-[11px] text-muted-foreground"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <ReadinessPill readiness={row.readiness} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Figure
                      value={evidence.meanOosSharpe}
                      className="text-sm text-foreground"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <DrawdownFigure value={evidence.worstOosDrawdown} />
                  </td>
                  <td className="py-3 pr-4 pl-3">
                    <Figure
                      value={row.lastValidated}
                      className="text-xs text-muted-foreground"
                    />
                  </td>
                </TableRow>
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
/* Readiness banner — the paper/live/draft callout                     */
/* ------------------------------------------------------------------ */

type BannerTone = "warning" | "success" | "muted"

const BANNER_TONE: Record<
  BannerTone,
  { wrap: string; icon: string; title: string; iconGlyph: typeof AlertCircleIcon }
> = {
  warning: {
    wrap: "border-warning/30 bg-warning/10",
    icon: "text-warning",
    title: "text-warning",
    iconGlyph: InformationCircleIcon,
  },
  success: {
    wrap: "border-success/25 bg-success/10",
    icon: "text-success",
    title: "text-success",
    iconGlyph: CheckmarkCircle02Icon,
  },
  muted: {
    wrap: "border-border bg-muted/40",
    icon: "text-muted-foreground",
    title: "text-foreground",
    iconGlyph: AlertCircleIcon,
  },
}

function bannerFor(
  readiness: StrategyReadiness,
  detail: StrategyDetail
): { tone: BannerTone; title: string; body: string; actionLabel?: string } {
  switch (readiness) {
    case "paper-ready":
      return {
        tone: "warning",
        title: "Ready for paper trading, not approved for live capital",
        body: "Backtest and walk-forward gates passed. Live launch is blocked until the risk review is complete.",
        actionLabel: "Start risk review",
      }
    case "live":
      return {
        tone: "success",
        title: "Live and trading with an approved risk review",
        body: detail.nextRequirement,
        actionLabel: "View risk review",
      }
    case "archived":
      return {
        tone: "muted",
        title: "Archived — kept for reference only",
        body: detail.nextRequirement,
      }
    case "draft":
    default:
      return {
        tone: "muted",
        title: "Draft — not yet cleared for paper trading",
        body: detail.nextRequirement,
        actionLabel: "Continue setup",
      }
  }
}

function ReadinessBanner({
  readiness,
  detail,
}: {
  readiness: StrategyReadiness
  detail: StrategyDetail
}) {
  const { tone, title, body, actionLabel } = bannerFor(readiness, detail)
  const meta = BANNER_TONE[tone]
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 border px-4 py-3",
        meta.wrap
      )}
    >
      <HugeiconsIcon
        icon={meta.iconGlyph}
        size={18}
        className={cn("mt-0.5 shrink-0", meta.icon)}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("text-sm font-semibold", meta.title)}>{title}</p>
        <p className="text-xs/relaxed text-muted-foreground">{body}</p>
      </div>
      {actionLabel ? (
        <Button variant="outline" size="sm" className="shrink-0">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Overview tab — flow, advisor roles, why-it-works, risk contract     */
/* ------------------------------------------------------------------ */

function FlowSteps({ detail }: { detail: StrategyDetail }) {
  const steps = buildFlowSteps(detail)
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-heading text-sm font-semibold text-foreground">
        How this strategy turns evidence into positions
      </h3>
      <ol className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {steps.map((step, i) => {
          const last = i === steps.length - 1
          return (
            <li key={step.title} className="flex flex-1 items-start gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[11px] text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                  {step.title}
                </span>
                {step.lines.map((line, j) => (
                  <Figure
                    key={line}
                    value={line}
                    className={cn(
                      "text-[11px] leading-snug",
                      j === 0 ? "text-foreground" : "text-muted-foreground"
                    )}
                  />
                ))}
              </div>
              {!last ? (
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={15}
                  className="mt-0.5 hidden shrink-0 text-muted-foreground/50 lg:block"
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function OverviewCard({
  title,
  children,
  footer,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-heading text-sm">{title}</CardTitle>
      </CardHeader>
      <div className="flex flex-1 flex-col gap-3 border-t border-border px-4 py-3">
        {children}
      </div>
      {footer ? (
        <div className="border-t border-border px-4 py-2.5 text-[11px]/relaxed text-muted-foreground italic">
          {footer}
        </div>
      ) : null}
    </Card>
  )
}

function AdvisorRoleRow({ seat }: { seat: PanelSeat }) {
  const pct = Math.round(seat.weight * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <span className="w-32 shrink-0 truncate font-mono text-xs text-foreground">
          {seat.signal}
        </span>
        <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {pct}%
        </span>
        <div className="h-1.5 flex-1 bg-muted" aria-hidden>
          <span
            className="block h-full bg-chart-1"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="pl-32 text-[11px]/snug text-muted-foreground italic">
        {advisorQuestion(seat.signal, seat.notes)}
      </p>
    </div>
  )
}

function AdvisorRoles({ detail }: { detail: StrategyDetail }) {
  return (
    <OverviewCard
      title="Advisor roles"
      footer="Advisors form views. Deterministic code sizes and limits positions."
    >
      {detail.decisionSystem.panel.map((seat) => (
        <AdvisorRoleRow key={seat.signal} seat={seat} />
      ))}
    </OverviewCard>
  )
}

function WhyItWorks({ copy }: { copy: StrategyCopy }) {
  return (
    <OverviewCard title="Why this might work" footer={copy.whyFooter}>
      <ul className="flex flex-col gap-2.5">
        {copy.whyItWorks.map((point) => (
          <li key={point} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success"
              aria-hidden
            />
            <span className="text-xs/relaxed text-foreground">{point}</span>
          </li>
        ))}
      </ul>
    </OverviewCard>
  )
}

function RiskContract({ detail }: { detail: StrategyDetail }) {
  const rows = riskContractRows(detail)
  return (
    <OverviewCard
      title="Risk contract"
      footer={
        <span className="font-semibold not-italic">
          Hard rules · deterministic · cannot be overridden by an LLM
        </span>
      }
    >
      <dl className="flex flex-col gap-2">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <dt className="text-xs text-muted-foreground">{key}</dt>
            <dd>
              <Figure value={value} className="text-xs text-foreground" />
            </dd>
          </div>
        ))}
      </dl>
    </OverviewCard>
  )
}

function OverviewTab({
  detail,
  copy,
}: {
  detail: StrategyDetail
  copy: StrategyCopy
}) {
  return (
    <div className="flex flex-col gap-4">
      <FlowSteps detail={detail} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdvisorRoles detail={detail} />
        <WhyItWorks copy={copy} />
        <RiskContract detail={detail} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Validation tab — the per-strategy validation-run history            */
/* ------------------------------------------------------------------ */

function ValidationResult({
  result,
}: {
  result: ValidationHistoryRow["result"]
}) {
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

function ValidationTab({ rows }: { rows: ValidationHistoryRow[] }) {
  return (
    <div className="overflow-x-auto">
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
                  i >= 3 && i <= 4 ? "text-right" : "text-left"
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
              <td className="px-3 py-2.5">
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
                <DrawdownFigure value={row.maxDrawdown} />
              </td>
              <td className="px-3 py-2.5 text-foreground">{row.gate}</td>
              <td className="px-3 py-2.5 font-medium">
                <ValidationResult result={row.result} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Decisions tab — a few recent committee decisions                    */
/* ------------------------------------------------------------------ */

function DecisionsTab({
  name,
  decisions,
}: {
  name: string
  decisions: StrategyDecisionRow[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs/relaxed text-muted-foreground">
        Every position traces back to a committee decision. Recent decisions for{" "}
        <span className="font-mono text-foreground">{name}</span>:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Security", "Committee view", "Target", "Result"].map(
                (head, i) => (
                  <th
                    key={head}
                    className={cn(
                      "px-3 py-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
                      i === 2 ? "text-right" : "text-left"
                    )}
                  >
                    {head}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {decisions.map((row) => {
              const target = Number(
                row.target.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0
              )
              return (
                <tr
                  key={row.security}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3 py-2.5">
                    <Figure
                      value={row.security}
                      className="text-xs font-medium text-foreground"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.view}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Figure
                      value={row.target}
                      className={cn("text-xs", pnlToneClass(target))}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={row.result} appearance="dot" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Versions tab — the version history list                             */
/* ------------------------------------------------------------------ */

function VersionsTab({ versions }: { versions: string[] }) {
  return (
    <ol className="flex flex-col">
      {versions.map((version, i) => (
        <li
          key={version}
          className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
        >
          <div className="flex items-center gap-2.5">
            <Figure
              value={version}
              className="text-sm font-medium text-foreground"
            />
            {i === 0 ? (
              <StatusPill status="verified" label="Current" />
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Superseded
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon-xs" aria-label={`More on ${version}`}>
            <HugeiconsIcon icon={MoreVerticalIcon} size={14} />
          </Button>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Inspector — header, banner, and the four tabs                       */
/* ------------------------------------------------------------------ */

function Inspector({
  strategy,
  detail,
  copy,
  validation,
}: {
  strategy: StrategyRegistryRow
  detail: StrategyDetail
  copy: StrategyCopy
  validation: ValidationHistoryRow[]
}) {
  const isDraft = strategy.readiness === "draft"
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
          <p className="max-w-prose text-sm/relaxed text-muted-foreground">
            {copy.plainDescription}
          </p>
          <p className="text-xs text-muted-foreground">{copy.metaLine}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={PlayIcon} size={14} />
            Run backtest
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(!isDraft && "text-primary")}
          >
            <HugeiconsIcon icon={Edit02Icon} size={14} />
            Edit draft
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="More options">
            <HugeiconsIcon icon={MoreVerticalIcon} size={15} />
          </Button>
        </div>
      </div>

      <ReadinessBanner readiness={strategy.readiness} detail={detail} />

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab detail={detail} copy={copy} />
        </TabsContent>
        <TabsContent value="validation">
          <ValidationTab rows={validation} />
        </TabsContent>
        <TabsContent value="decisions">
          <DecisionsTab name={strategy.name} decisions={copy.decisions} />
        </TabsContent>
        <TabsContent value="versions">
          <VersionsTab versions={detail.versionHistory} />
        </TabsContent>
      </Tabs>
    </MasterDetailPanel>
  )
}

/* ------------------------------------------------------------------ */
/* Out-of-sample card — the evidence dot-plot                          */
/* ------------------------------------------------------------------ */

function OosDotPlot({
  points,
  threshold,
}: {
  points: OosPoint[]
  threshold: number
}) {
  const sharpes = points.map((p) => p.sharpe)
  const domainMax = Math.max(...sharpes) + 0.2
  const domainMin = Math.min(...sharpes, threshold) - 0.15
  const span = Math.max(domainMax - domainMin, 0.01)
  const topPct = (value: number) => ((domainMax - value) / span) * 100
  const thresholdTop = topPct(threshold)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4">
        {/* Legend */}
        <ul className="flex w-32 shrink-0 flex-col justify-center gap-2 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full bg-info" />
            OOS Sharpe
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full border-2 border-info bg-card" />
            Latest backtest
          </li>
          <li className="flex items-center gap-2">
            <span className="h-0 w-3.5 shrink-0 border-t border-dashed border-muted-foreground" />
            Required OOS Sharpe {threshold.toFixed(2)}
          </li>
        </ul>

        {/* Plot */}
        <div className="relative h-40 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/60"
            style={{ top: `${thresholdTop}%` }}
            aria-hidden
          />
          <div className="flex h-full">
            {points.map((point) => {
              const top = topPct(point.sharpe)
              return (
                <div key={point.label} className="relative flex-1">
                  {/* Stem down to the axis */}
                  <span
                    className="absolute w-px -translate-x-1/2 bg-border"
                    style={{ left: "50%", top: `${top}%`, bottom: 0 }}
                    aria-hidden
                  />
                  {/* Value label */}
                  <span
                    className="absolute -translate-x-1/2 -translate-y-[190%] font-mono text-xs font-medium text-foreground tabular-nums"
                    style={{ left: "50%", top: `${top}%` }}
                  >
                    {point.sharpe.toFixed(2)}
                  </span>
                  {/* Dot */}
                  <span
                    className={cn(
                      "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
                      point.isBacktest
                        ? "border-2 border-info bg-card"
                        : "bg-info"
                    )}
                    style={{ left: "50%", top: `${top}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Period labels */}
      <div className="flex gap-4">
        <div className="w-32 shrink-0" />
        <div className="flex flex-1">
          {points.map((point) => (
            <span
              key={point.label}
              className="flex-1 px-1 text-center text-[10px]/tight text-muted-foreground"
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>

      {/* Drawdown row */}
      <div className="flex gap-4 border-t border-border pt-2">
        <span className="w-32 shrink-0 text-[11px] text-muted-foreground">
          Drawdown
        </span>
        <div className="flex flex-1">
          {points.map((point) => (
            <span key={point.label} className="flex-1 text-center">
              <DrawdownFigure value={point.drawdown} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function OutOfSampleCard({
  copy,
  evidence,
}: {
  copy: StrategyCopy
  evidence: StrategyEvidence
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-heading text-sm">
          Did it work outside the development period?
        </CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
        <p className="text-sm font-medium text-success">{copy.oosAnswer}</p>

        <StatBar>
          <StatItem
            size="sm"
            label="Latest backtest Sharpe"
            value={evidence.latestBacktestSharpe}
          />
          <StatItem
            size="sm"
            label="Mean OOS Sharpe"
            value={evidence.meanOosSharpe}
          />
          <StatItem
            size="sm"
            label="Worst OOS drawdown"
            value={evidence.worstOosDrawdown}
            valueClassName={pnlToneClass(
              Number(evidence.worstOosDrawdown.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0)
            )}
          />
          <StatItem
            size="sm"
            label="Paper observation"
            value={evidence.paperObservation}
          />
        </StatBar>

        <OosDotPlot points={evidence.points} threshold={evidence.oosThreshold} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Path to live — the promotion gate ladder                            */
/* ------------------------------------------------------------------ */

function GateCircle({ status }: { status: GateEvidence["status"] }) {
  const passed = status === "passed"
  return (
    <HugeiconsIcon
      icon={passed ? CheckmarkCircle02Icon : AlertCircleIcon}
      size={18}
      className={cn("shrink-0", passed ? "text-success" : "text-warning")}
      aria-hidden
    />
  )
}

function PathToLiveCard({
  detail,
  evidence,
}: {
  detail: StrategyDetail
  evidence: StrategyEvidence
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-heading text-sm">Path to live</CardTitle>
      </CardHeader>

      <div className="border-t border-border px-4 py-4">
        <ol className="flex flex-col">
          {evidence.gates.map((gate, i) => {
            const last = i === evidence.gates.length - 1
            return (
              <li
                key={gate.gate}
                className={cn("relative flex gap-3", !last && "pb-4")}
              >
                {!last ? (
                  <span
                    className="absolute top-6 left-[8.5px] h-[calc(100%-1.25rem)] w-px bg-border"
                    aria-hidden
                  />
                ) : null}
                <GateCircle status={gate.status} />
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{gate.gate}</span>
                    <StatusPill status={gate.status} />
                  </div>
                  <Figure
                    value={gate.evidence}
                    className="text-xs text-muted-foreground"
                  />
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
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
              className="font-mono text-[11px] text-primary tabular-nums underline-offset-4 transition-colors duration-[var(--duration-instant)] hover:text-primary/80 hover:underline"
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
      <Tabs value={tab} onValueChange={(value) => onTabChange(String(value))}>
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
    return STRATEGY_REGISTRY.filter((row) => row.name.toLowerCase().includes(q))
  }, [query])

  const selected =
    STRATEGY_REGISTRY.find((row) => row.id === selectedId) ??
    STRATEGY_REGISTRY[0]!
  const detail = getStrategyDetail(selected.id)
  const copy = getStrategyCopy(selected.id)
  const evidence = getStrategyEvidence(selected.id)
  const validation = getValidationHistory(selected.id)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Strategies"
        description="Understand the edge, decision rules, risks, and evidence behind every strategy."
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

      <MasterDetail className="gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <MasterDetailList>
          <LibraryTable
            rows={filtered}
            total={STRATEGY_REGISTRY.length}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </MasterDetailList>
        <Inspector
          strategy={selected}
          detail={detail}
          copy={copy}
          validation={validation}
        />
      </MasterDetail>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <OutOfSampleCard copy={copy} evidence={evidence} />
        <PathToLiveCard detail={detail} evidence={evidence} />
      </div>
    </div>
  )
}
