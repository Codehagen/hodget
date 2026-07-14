"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Maximize01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
  getDecisionTrace,
  type DecisionLogRow,
  type DecisionResult,
  type DecisionTraceStage,
} from "../demo-data"
import { formatSignedNumber, pnlToneClass } from "../format"
import { AgreementBar, StatusPill, type StatusName } from "../primitives"
import { CopyButton } from "./copy-button"

/* ------------------------------------------------------------------ */
/* Shared tone helpers                                                 */
/* ------------------------------------------------------------------ */

const GATE_STATUS: Record<DecisionResult, StatusName> = {
  passed: "passed",
  clipped: "clipped",
  vetoed: "vetoed",
}

// The trace fixture carries a "warning" tone that widens ValueTone, so key on
// the raw string rather than the narrowed union.
const TRACE_TONE: Record<string, string> = {
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
  neutral: "text-foreground",
  muted: "text-muted-foreground",
}

const TRACE_CHECK: Record<string, string> = {
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
  neutral: "text-muted-foreground",
  muted: "text-muted-foreground",
}

function signalDot(value: number): string {
  return value > 0.15
    ? "bg-success"
    : value < -0.15
      ? "bg-destructive"
      : "bg-muted-foreground"
}

/* ------------------------------------------------------------------ */
/* Decision table                                                      */
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

const HEAD_CLASS =
  "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground"
const CELL_CLASS = "h-auto py-2.5 text-xs"

function DecisionRow({
  row,
  selected,
  onSelect,
}: {
  row: DecisionLogRow
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <TableRow
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
      className="cursor-pointer outline-none focus-visible:bg-muted/60 data-[state=selected]:bg-primary/5"
    >
      <TableCell
        className={cn(
          CELL_CLASS,
          "relative font-mono text-muted-foreground tabular-nums",
          selected &&
            "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:content-['']"
        )}
      >
        {row.time}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "font-mono font-medium text-foreground")}>
        {row.ticker}
      </TableCell>
      <TableCell className={CELL_CLASS}>
        <AgreementBar values={row.agreement} />
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
      <TableCell className={cn(CELL_CLASS, "font-mono text-foreground tabular-nums")}>
        {row.targetWeight.toFixed(2)}%
      </TableCell>
      <TableCell className={CELL_CLASS}>
        <StatusPill status={GATE_STATUS[row.riskGate]} appearance="dot" />
      </TableCell>
      <TableCell
        className={cn(
          CELL_CLASS,
          "font-mono tabular-nums",
          row.nextSessionFill === "No trade"
            ? "text-muted-foreground"
            : "text-foreground"
        )}
      >
        {row.nextSessionFill}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "font-mono text-muted-foreground")}>
        {row.decisionId}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "w-8 pr-3 text-right")}>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={14}
          className={cn(
            "inline-block",
            selected ? "text-primary" : "text-muted-foreground"
          )}
        />
      </TableCell>
    </TableRow>
  )
}

/* ------------------------------------------------------------------ */
/* Selected-decision trace                                             */
/* ------------------------------------------------------------------ */

function TraceNode({ index }: { index: number }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-medium tabular-nums",
        index === 1
          ? "border-info bg-info text-info-foreground"
          : "border-border bg-background text-muted-foreground"
      )}
    >
      {index}
    </span>
  )
}

/** A single numbered step in the decision trace. */
function TraceStage({
  stage,
  last,
}: {
  stage: DecisionTraceStage
  last: boolean
}) {
  const tone = stage.tone as string
  const valueClass = TRACE_TONE[tone] ?? "text-foreground"

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <TraceNode index={stage.index} />
        {!last ? <span className="my-1 w-px flex-1 bg-border" /> : null}
      </div>

      <div
        className={cn(
          "flex flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-2",
          !last && "pb-5"
        )}
      >
        {/* Left: title + optional handle/version */}
        <div className="flex min-w-[8rem] flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">
            {stage.title}
          </span>
          {stage.signals && stage.meta ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              ({stage.meta})
            </span>
          ) : null}
        </div>

        {/* Middle: per-stage body */}
        {stage.signals ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {stage.signals.map((sig) => (
              <div key={sig.name} className="flex items-start gap-2 text-xs">
                <span
                  className={cn("mt-1 size-1.5 shrink-0", signalDot(sig.value))}
                  aria-hidden
                />
                <span className="w-24 shrink-0 truncate text-foreground">
                  {sig.name}
                </span>
                <span
                  className={cn(
                    "w-12 shrink-0 text-right font-mono tabular-nums",
                    pnlToneClass(sig.value)
                  )}
                >
                  {formatSignedNumber(sig.value)}
                </span>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {sig.thesis}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              {stage.value ? (
                <span
                  className={cn(
                    "font-mono text-xs font-medium tabular-nums",
                    valueClass
                  )}
                >
                  {stage.value}
                </span>
              ) : null}
              {stage.target ? (
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  Target {stage.target}
                </span>
              ) : null}
            </div>
            {stage.meta ? (
              <span className="text-[11px] text-muted-foreground">
                {stage.meta}
              </span>
            ) : null}
          </div>
        )}

        {/* Right: agreement strip and/or status */}
        <div className="flex shrink-0 items-center gap-3">
          {stage.agreement ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">Agreement</span>
              <AgreementBar values={stage.agreement} />
            </div>
          ) : null}
          {stage.status ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                valueClass
              )}
            >
              {stage.status}
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={13}
                className={TRACE_CHECK[tone] ?? "text-muted-foreground"}
              />
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function SelectedDecision({ row }: { row: DecisionLogRow }) {
  const trace = getDecisionTrace(row.decisionId)
  return (
    <div className="flex flex-col gap-4 border-t border-border px-(--card-spacing) pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="text-muted-foreground">Selected decision:</span>
          <span className="font-mono font-medium text-foreground">
            {row.ticker}
          </span>
          <span className="text-muted-foreground">on</span>
          <span className="font-mono text-foreground tabular-nums">
            {row.date} {row.time} UTC
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Decision ID
            <span className="font-mono text-foreground">{row.decisionId}</span>
            <CopyButton value={row.decisionId} label="Copy decision ID" />
          </span>
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={RefreshIcon} />
            Replay decision
          </Button>
        </div>
      </div>

      <ol className="flex flex-col">
        {trace.stages.map((stage, i) => (
          <TraceStage
            key={stage.index}
            stage={stage}
            last={i === trace.stages.length - 1}
          />
        ))}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function DecisionLog() {
  const [selectedId, setSelectedId] = React.useState<string>(
    DECISION_LOG[0]?.id ?? ""
  )
  const groups = React.useMemo(() => groupByDate(DECISION_LOG), [])
  const selectedRow =
    DECISION_LOG.find((r) => r.id === selectedId) ?? DECISION_LOG[0]

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle>Decision log</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Expand decision log"
          >
            <HugeiconsIcon icon={Maximize01Icon} />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(HEAD_CLASS, "pl-(--card-spacing)")}>
                Time (UTC)
              </TableHead>
              <TableHead className={HEAD_CLASS}>Ticker</TableHead>
              <TableHead className={HEAD_CLASS}>Analyst agreement</TableHead>
              <TableHead className={HEAD_CLASS}>Committee view</TableHead>
              <TableHead className={HEAD_CLASS}>Target weight</TableHead>
              <TableHead className={HEAD_CLASS}>Risk gate</TableHead>
              <TableHead className={HEAD_CLASS}>Next-session fill</TableHead>
              <TableHead className={HEAD_CLASS}>Decision ID</TableHead>
              <TableHead className={cn(HEAD_CLASS, "w-8")} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <React.Fragment key={group.date}>
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={9}
                    className="h-auto bg-muted/30 py-1.5 pl-(--card-spacing) font-mono text-[11px] text-muted-foreground tabular-nums"
                  >
                    {group.date}
                  </TableCell>
                </TableRow>
                {group.rows.map((row) => (
                  <DecisionRow
                    key={row.id}
                    row={row}
                    selected={row.id === selectedId}
                    onSelect={setSelectedId}
                  />
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {selectedRow ? (
        <div className="pt-4">
          <SelectedDecision row={selectedRow} />
        </div>
      ) : null}
    </Card>
  )
}
