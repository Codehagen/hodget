"use client"

import "./decisions-view.css"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Search01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { parseAsString, useQueryState } from "nuqs"

import { cn } from "@workspace/ui/lib/utils"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { formatSignedNumber, pnlToneClass } from "../format"
import { StatusPill } from "../primitives"
import {
  DEFAULT_TODAY_ID,
  getTodayDecisionMap,
  TODAY_DECISIONS,
  type DecisionMap,
  type Tone,
  type TodayRailItem,
} from "./data"
import { AuditTab, EvidenceTab } from "./decision-tabs"
import { AdvisorRail } from "./inspector"

import dynamic from "next/dynamic"

// @xyflow/react is heavy; the flow canvas loads in its own async chunk
// (plan 010).
const DecisionFlow = dynamic(
  () => import("./decision-flow").then((m) => m.DecisionFlow),
  {
    ssr: false,
    loading: () => (
      <div aria-hidden className="h-[480px] w-full animate-pulse bg-muted/40" />
    ),
  }
)
import { analystNodeId } from "./layout"
import { SummaryTab } from "./summary-tab"

/* ------------------------------------------------------------------ */
/* Tone helpers                                                        */
/* ------------------------------------------------------------------ */

function toneClass(tone: Tone): string {
  return tone === "success"
    ? "text-success"
    : tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-muted-foreground"
}

function actionTone(actionLine: string): string {
  if (actionLine === "No trade") return "text-muted-foreground"
  if (actionLine.startsWith("Sold")) return "text-destructive"
  return "text-success"
}

/**
 * The rail's gate read as a soft icon + phrase — an amber shield for a
 * safety-reduced position, a green check for a clean pass, a red slash for a
 * veto. Keyed by the derived `gateWord` so every row stays honest.
 */
const GATE_META: Record<
  string,
  { icon: typeof Shield01Icon; className: string; phrase: string }
> = {
  Passed: {
    icon: CheckmarkCircle02Icon,
    className: "text-success",
    phrase: "Passed",
  },
  Reduced: {
    icon: Shield01Icon,
    className: "text-warning",
    phrase: "Reduced by safety",
  },
  Vetoed: {
    icon: CancelCircleIcon,
    className: "text-destructive",
    phrase: "Vetoed",
  },
}

/* ------------------------------------------------------------------ */
/* Left rail — today's decisions                                       */
/* ------------------------------------------------------------------ */

function RailRow({
  item,
  selected,
  onSelect,
}: {
  item: TodayRailItem
  selected: boolean
  onSelect: (decisionId: string) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(item.decisionId)}
      className={cn(
        "relative flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left outline-none focus-visible:bg-muted/60",
        selected
          ? "bg-primary/5 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:content-['']"
          : "transition-colors duration-[var(--duration-instant)] hover:bg-muted/40"
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {item.time}
        </span>
        <span className="font-heading text-sm font-semibold text-foreground">
          {item.ticker}
        </span>
      </div>
      <span className={cn("text-xs font-medium", actionTone(item.actionLine))}>
        {item.actionLine}
      </span>
      {(() => {
        const gate = GATE_META[item.gateWord] ?? GATE_META.Passed!
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              gate.className
            )}
          >
            <HugeiconsIcon icon={gate.icon} size={13} className="shrink-0" />
            {gate.phrase}
          </span>
        )
      })()}
    </button>
  )
}

function LeftRail({
  items,
  selectedId,
  onSelect,
}: {
  items: TodayRailItem[]
  selectedId: string
  onSelect: (decisionId: string) => void
}) {
  return (
    <div className="w-full shrink-0 rounded-none bg-card ring-1 ring-foreground/10 lg:w-52">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2.5">
        <span className="font-heading text-xs font-semibold tracking-wide text-foreground uppercase">
          Today
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {items.length} decisions
        </span>
      </div>
      <div className="flex flex-col">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground">
            No decisions match.
          </p>
        ) : (
          items.map((item) => (
            <RailRow
              key={item.decisionId}
              item={item}
              selected={item.decisionId === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Header card + KPI strip                                             */
/* ------------------------------------------------------------------ */

function KpiCell({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          className
        )}
      >
        {value}
      </span>
    </div>
  )
}

function HeaderCard({ map }: { map: DecisionMap }) {
  const { kpis } = map
  const approvedClass =
    kpis.approvedPct == null
      ? "text-muted-foreground"
      : kpis.approvedPct > 0
        ? "text-success"
        : map.risk.result === "vetoed"
          ? "text-destructive"
          : "text-muted-foreground"

  return (
    <div className="flex flex-col gap-4 rounded-none bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {map.ticker} · {map.time}
          </span>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {map.headline}
          </h1>
          <p className="max-w-2xl text-sm/relaxed text-muted-foreground">
            {map.explainer}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={map.mode} />
          {map.executed ? <StatusPill status="executed" /> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        <KpiCell
          label="Combined view"
          value={formatSignedNumber(kpis.combinedView)}
          className={pnlToneClass(kpis.combinedView)}
        />
        <KpiCell
          label="Proposed"
          value={
            kpis.proposedPct == null ? "—" : `${kpis.proposedPct.toFixed(2)}%`
          }
          className="text-foreground"
        />
        <KpiCell
          label="Approved"
          value={
            kpis.approvedPct == null ? "—" : `${kpis.approvedPct.toFixed(2)}%`
          }
          className={approvedClass}
        />
        <KpiCell
          label={kpis.outcomeLabel}
          value={kpis.statusLabel}
          className={toneClass(kpis.statusTone)}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

type OutcomeFilter = "all" | "Passed" | "Reduced" | "Vetoed"

const OUTCOME_LABELS: Record<OutcomeFilter, string> = {
  all: "All outcomes",
  Passed: "Passed",
  Reduced: "Reduced",
  Vetoed: "Vetoed",
}

/**
 * The Decisions page — a plain-language explainer for what the fund decided,
 * why, and what safety rules changed. The left rail lists today's decisions; the
 * main column carries a headline card + KPIs and the tabbed explanation (the
 * question-led decision map); the right rail explains the selected advisor.
 *
 * Selection lives in the URL (`?d=dec_…`) via nuqs, so any decision is
 * deep-linkable. The same view backs `/demo` (public) and `/dashboard`
 * (session-guarded). Fixtures only, so it prerenders.
 *
 * Swapping decisions remounts the map (React Flow only reads its initial nodes),
 * which would replay the entrance stagger on every click. Per Design.md's
 * frequency rule that is too much motion for a frequent interaction, so we play
 * the stagger on first mount only and suppress it on every later swap — tracked
 * by `suppressEntrance`, surfaced as `data-entrance` for decisions-view.css.
 */
export function DecisionsView() {
  const [decisionId, setDecisionId] = useQueryState(
    "d",
    parseAsString.withDefault(DEFAULT_TODAY_ID)
  )
  const [search, setSearch] = React.useState("")
  const [outcome, setOutcome] = React.useState<OutcomeFilter>("all")
  const [tab, setTab] = React.useState("summary")

  // Fall back to the flagship decision if the URL carries an unknown id.
  const map =
    getTodayDecisionMap(decisionId) ?? getTodayDecisionMap(DEFAULT_TODAY_ID)!

  const items = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return TODAY_DECISIONS.filter((item) => {
      const matchesSearch =
        q === "" ||
        item.ticker.toLowerCase().includes(q) ||
        item.decisionId.toLowerCase().includes(q)
      const matchesOutcome = outcome === "all" || item.gateWord === outcome
      return matchesSearch && matchesOutcome
    })
  }, [search, outcome])

  // Selection state, shared by the canvas and the advisor rail. Suppress the
  // entrance stagger from the first swap onward, and reset selection to the new
  // lead advisor — both derived during render (the "derive from a changing prop"
  // pattern) so they settle before the remounted map ever commits.
  const [suppressEntrance, setSuppressEntrance] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(
    analystNodeId(map.primaryAnalystId)
  )
  const [railAdvisorId, setRailAdvisorId] = React.useState(map.primaryAnalystId)
  const [renderedId, setRenderedId] = React.useState(map.id)
  if (renderedId !== map.id) {
    setRenderedId(map.id)
    if (!suppressEntrance) setSuppressEntrance(true)
    setSelectedId(analystNodeId(map.primaryAnalystId))
    setRailAdvisorId(map.primaryAnalystId)
  }

  // No manual useCallback: the React Compiler memoizes this itself, and the
  // adjust-state-during-render block above defeats its ability to preserve a
  // hand-written memo (react-hooks/preserve-manual-memoization).
  const handleSelectedIdChange = (id: string | null) => {
    setSelectedId(id)
    const advisor = map.analysts.find((a) => analystNodeId(a.analystId) === id)
    if (advisor) setRailAdvisorId(advisor.analystId)
  }

  const railAdvisor =
    map.analysts.find((a) => a.analystId === railAdvisorId) ??
    map.analysts.find((a) => a.analystId === map.primaryAnalystId)!

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      {/* Page header + controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Decisions
          </h1>
          <p className="text-sm text-muted-foreground">
            See what the fund decided, why, and what safety rules changed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker or decision…"
              aria-label="Search ticker or decision"
              className="h-8 w-full pl-8 sm:w-56"
            />
          </div>
          <Select value="today" onValueChange={() => {}}>
            <SelectTrigger aria-label="Date" className="w-fit">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={14}
                className="text-muted-foreground"
              />
              <SelectValue>{() => "Today"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={outcome}
            onValueChange={(next) => setOutcome(next as OutcomeFilter)}
          >
            <SelectTrigger aria-label="Filter by outcome" className="w-fit">
              <SelectValue>
                {(value) => OUTCOME_LABELS[value as OutcomeFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="Passed">Passed</SelectItem>
              <SelectItem value="Reduced">Reduced</SelectItem>
              <SelectItem value="Vetoed">Vetoed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Three columns: rail · explainer · advisor */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <LeftRail
          items={items}
          selectedId={map.id}
          onSelect={(next) => void setDecisionId(next)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <HeaderCard map={map} />

          <Tabs value={tab} onValueChange={(value) => setTab(value as string)}>
            <TabsList variant="line">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="full">Full decision path</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="audit">Audit &amp; replay</TabsTrigger>
            </TabsList>

            {/*
             * keepMounted so returning to Summary never remounts the timeline —
             * its one-time draw (summary-tab.tsx / decisions-view.css) is gated
             * by the shared `suppressEntrance` flag, not by mount, so it plays
             * once per page load and never on a tab return.
             */}
            <TabsContent value="summary" keepMounted className="pt-4">
              <SummaryTab
                map={map}
                onNavigate={(next) => setTab(next)}
                suppressEntrance={suppressEntrance}
              />
            </TabsContent>

            <TabsContent value="full" keepMounted className="pt-4">
              <div
                className="decisions-map"
                data-entrance={suppressEntrance ? "off" : "on"}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <DecisionFlow
                    key={map.id}
                    map={map}
                    selectedId={selectedId}
                    onSelectedIdChange={handleSelectedIdChange}
                  />
                  <AdvisorRail map={map} advisor={railAdvisor} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="pt-4">
              <EvidenceTab map={map} />
            </TabsContent>

            <TabsContent value="audit" className="pt-4">
              <AuditTab map={map} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Views are opinions. Deterministic code sizes positions, applies safety
        limits, and records fills.
      </p>
    </div>
  )
}
