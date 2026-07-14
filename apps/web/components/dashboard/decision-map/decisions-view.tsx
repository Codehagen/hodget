"use client"

import "./decisions-view.css"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { parseAsString, useQueryState } from "nuqs"

import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  DECISION_LOG,
  type DecisionLogRow,
  type DecisionResult,
} from "../demo-data"
import { formatSignedNumber, pnlToneClass } from "../format"
import { SectionHeader, StatusPill, type StatusName } from "../primitives"
import { getDecisionMap } from "./data"
import { DecisionFlow } from "./decision-flow"

/**
 * Every fixture decision is a view of the same value-panel committee, so we hang
 * them all off that strategy's flagship completed run. This is the run whose
 * canonical per-decision page each picker row deep-links to; it also decides the
 * map's `mode` badge (backtest). It is a real id in `ALL_RUNS`, so the per-run
 * route it points at is statically generated and never 404s.
 */
const CANONICAL_RUN_ID = "run_8c41cf"

/** The flagship decision shown by default (NVDA), matching the product mock. */
const DEFAULT_DECISION_ID = "dec_c12f8b7a"

const GATE_STATUS: Record<DecisionResult, StatusName> = {
  passed: "passed",
  clipped: "clipped",
  vetoed: "vetoed",
}

const HEAD_CLASS =
  "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground"
const CELL_CLASS = "h-auto py-2.5 text-xs"

/* ------------------------------------------------------------------ */
/* Picker                                                              */
/* ------------------------------------------------------------------ */

type DateGroup = { date: string; rows: DecisionLogRow[] }

function groupByDate(rows: readonly DecisionLogRow[]): DateGroup[] {
  const groups: DateGroup[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.date === row.date) last.rows.push(row)
    else groups.push({ date: row.date, rows: [row] })
  }
  return groups
}

function PickerRow({
  row,
  selected,
  onSelect,
  basePath,
}: {
  row: DecisionLogRow
  selected: boolean
  onSelect: (decisionId: string) => void
  basePath: string
}) {
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(row.decisionId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect(row.decisionId)
        }
      }}
      className="cursor-pointer outline-none focus-visible:bg-muted/60 data-[state=selected]:bg-primary/5"
    >
      <TableCell
        className={cn(
          CELL_CLASS,
          "relative pl-4 font-mono text-muted-foreground tabular-nums",
          selected &&
            "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:content-['']"
        )}
      >
        {row.time}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "font-mono font-medium text-foreground")}>
        {row.ticker}
      </TableCell>
      <TableCell
        className={cn(
          CELL_CLASS,
          "font-mono font-medium tabular-nums",
          pnlToneClass(row.committeeView)
        )}
      >
        {formatSignedNumber(row.committeeView)}
      </TableCell>
      <TableCell className={CELL_CLASS}>
        <StatusPill status={GATE_STATUS[row.riskGate]} appearance="dot" />
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "font-mono text-muted-foreground")}>
        {row.decisionId}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "font-mono text-muted-foreground")}>
        {CANONICAL_RUN_ID}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "w-8 pr-3 text-right")}>
        <Link
          href={`${basePath}/runs/${CANONICAL_RUN_ID}/decisions/${row.decisionId}`}
          aria-label={`Open the ${row.ticker} decision map on its run page`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex text-muted-foreground transition-colors duration-[var(--duration-instant)] hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
        </Link>
      </TableCell>
    </TableRow>
  )
}

function DecisionPicker({
  selectedId,
  onSelect,
  basePath,
}: {
  selectedId: string
  onSelect: (decisionId: string) => void
  basePath: string
}) {
  const groups = React.useMemo(() => groupByDate(DECISION_LOG), [])

  return (
    <div className="flex flex-col rounded-none bg-card ring-1 ring-foreground/10">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          All decisions
        </h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {DECISION_LOG.length}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(HEAD_CLASS, "pl-4")}>Time (UTC)</TableHead>
            <TableHead className={HEAD_CLASS}>Ticker</TableHead>
            <TableHead className={HEAD_CLASS}>Committee view</TableHead>
            <TableHead className={HEAD_CLASS}>Risk gate</TableHead>
            <TableHead className={HEAD_CLASS}>Decision ID</TableHead>
            <TableHead className={HEAD_CLASS}>Run</TableHead>
            <TableHead className={cn(HEAD_CLASS, "w-8")} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <React.Fragment key={group.date}>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="h-auto bg-muted/30 py-1.5 pl-4 font-mono text-[11px] text-muted-foreground tabular-nums"
                >
                  {group.date}
                </TableCell>
              </TableRow>
              {group.rows.map((row) => (
                <PickerRow
                  key={row.id}
                  row={row}
                  selected={row.decisionId === selectedId}
                  onSelect={onSelect}
                  basePath={basePath}
                />
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

/**
 * The top-level Decisions page: the decision map for the selected decision, with
 * a dense picker table below to swap between every committee decision. Selection
 * lives in the URL (`?d=dec_…`) via nuqs, so any decision is deep-linkable. The
 * same view backs `/demo` (public) and `/dashboard` (session-guarded) —
 * `basePath` routes the per-run deep links. Fixtures only, so it prerenders.
 *
 * Swapping decisions remounts the map (React Flow only reads its initial nodes),
 * which would replay the entrance stagger on every click. Per Design.md's
 * frequency rule that is too much motion for a frequent interaction, so we play
 * the stagger on first mount only and suppress it on every later swap — tracked
 * by `suppressEntrance`, surfaced as `data-entrance` for decisions-view.css.
 */
export function DecisionsView({ basePath }: { basePath: string }) {
  const [decisionId, setDecisionId] = useQueryState(
    "d",
    parseAsString.withDefault(DEFAULT_DECISION_ID)
  )

  // Fall back to the flagship decision if the URL carries an unknown id.
  const map =
    getDecisionMap(decisionId, CANONICAL_RUN_ID) ??
    getDecisionMap(DEFAULT_DECISION_ID, CANONICAL_RUN_ID)!

  // Suppress the entrance stagger from the first swap onward. Adjusting state
  // during render (the "derive from a changing prop" pattern) flips this before
  // the swapped, remounted map ever commits, so the animation never starts —
  // and the initial on-load entrance still plays.
  const [suppressEntrance, setSuppressEntrance] = React.useState(false)
  const renderedIdRef = React.useRef(map.id)
  if (renderedIdRef.current !== map.id) {
    renderedIdRef.current = map.id
    if (!suppressEntrance) setSuppressEntrance(true)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Decisions"
        description="Every committee decision, mapped end to end."
      />

      <div
        className="decisions-map"
        data-entrance={suppressEntrance ? "off" : "on"}
      >
        <DecisionFlow key={map.id} map={map} />
      </div>

      <DecisionPicker
        selectedId={map.id}
        onSelect={(next) => void setDecisionId(next)}
        basePath={basePath}
      />
    </div>
  )
}
