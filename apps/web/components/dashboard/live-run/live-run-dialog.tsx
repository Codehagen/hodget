"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import { Marker, MarkerContent } from "@workspace/ui/components/marker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Progress } from "@workspace/ui/components/progress"
import { StatBar, StatItem } from "@workspace/ui/components/stat"

import Link from "next/link"

import {
  formatCurrencyCompact,
  formatSignedNumber,
  formatSignedPercent,
} from "../format"
import {
  SIMULATED_RUN_ID,
  useSimulatedRun,
  type FeedEntry,
  type SimulatedRunStatus,
} from "./simulated-run"

/**
 * "New run" for the fixture-backed surfaces (plan 005): a dialog that replays a
 * scripted run — the day counter sweeps the curve while analyst signals,
 * committee views, risk-gate actions and fills stream into a stick-to-bottom
 * feed, and the fixture run's real metrics land at the end. Wraps the trigger
 * button; nothing renders (or runs) until the user opens it, so the demo pages
 * stay statically prerendered.
 */
export function LiveRunDialog({
  basePath,
  trigger,
}: {
  basePath: string
  /** The trigger element, e.g. the surface's existing "New run" button. */
  trigger: React.ReactElement
}) {
  const { state, detail, start, reset } = useSimulatedRun()

  return (
    <Dialog
      onOpenChange={(open) => {
        // Closing cancels a mid-flight replay so a reopen starts clean.
        if (!open) reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>New run</DialogTitle>
            <Badge variant="amber">Simulated — mock data</Badge>
          </div>
          <DialogDescription>
            A scripted replay of a recorded backtest — the same event stream the
            engine emits, played back from the demo fixtures.
          </DialogDescription>
        </DialogHeader>

        {state.status === "idle" ? (
          <Idle onStart={start} strategyName={detail?.strategy.name} />
        ) : (
          <Replay
            state={state}
            basePath={basePath}
            metrics={detail?.metrics ?? null}
            onRestart={start}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Idle({
  onStart,
  strategyName,
}: {
  onStart: () => void
  strategyName: string | undefined
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs/relaxed text-muted-foreground">
        Launches the <span className="text-foreground">{strategyName ?? "earnings-drift"}</span>{" "}
        panel over 60 trading days of the bundled dataset: each decision day the
        analysts emit signals with written theses, the committee blends them
        into target weights, the risk gate clips or vetoes, and fills settle
        into the ledger.
      </p>
      <Button onClick={onStart} className="self-start">
        Start run
      </Button>
    </div>
  )
}

const STATUS_BADGE: Record<
  Exclude<SimulatedRunStatus, "idle">,
  { label: string; variant: "neutral" | "blue" | "green" }
> = {
  queued: { label: "Queued", variant: "neutral" },
  running: { label: "Running", variant: "blue" },
  completed: { label: "Completed", variant: "green" },
}

function Replay({
  state,
  basePath,
  metrics,
  onRestart,
}: {
  state: ReturnType<typeof useSimulatedRun>["state"]
  basePath: string
  metrics: {
    sharpe: number
    cagr: number
    maxDrawdown: number
    hitRate: number
    turnover: number
  } | null
  onRestart: () => void
}) {
  const badge = STATUS_BADGE[state.status as Exclude<SimulatedRunStatus, "idle">]
  const done = state.status === "completed"

  return (
    <div className="flex flex-col gap-3">
      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="font-mono text-xs text-muted-foreground">
          {SIMULATED_RUN_ID}
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          Day {state.day} / {state.totalDays || "—"}
          {state.equity !== null
            ? ` · ${formatCurrencyCompact(state.equity)}`
            : ""}
        </span>
      </div>
      <Progress value={state.totalDays ? (state.day / state.totalDays) * 100 : 0} />

      {/* Event feed — pins to the newest entry while the replay streams in;
          scrolling up releases the pin and surfaces the jump-to-end button. */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="h-56 rounded-none bg-card ring-1 ring-foreground/10">
          <MessageScrollerViewport aria-label="Run event feed">
            <MessageScrollerContent className="gap-1.5 p-3 font-mono text-[11px]/relaxed">
              {state.feed.map((entry, i) => (
                <MessageScrollerItem key={i}>
                  <FeedRow entry={entry} />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Result */}
      {done && metrics ? (
        <>
          <StatBar>
            {/* min-w tightened from the default 9rem so all four fit one row
                inside the dialog's width instead of orphaning the last cell. */}
            <StatItem
              size="sm"
              className="min-w-[6.5rem]"
              label="Sharpe"
              value={metrics.sharpe.toFixed(2)}
            />
            <StatItem
              size="sm"
              className="min-w-[6.5rem]"
              label="CAGR"
              value={formatSignedPercent(metrics.cagr, 1)}
            />
            <StatItem
              size="sm"
              className="min-w-[6.5rem]"
              label="Max drawdown"
              value={formatSignedPercent(metrics.maxDrawdown, 1)}
            />
            <StatItem
              size="sm"
              className="min-w-[6.5rem]"
              label="Hit rate"
              value={`${metrics.hitRate.toFixed(0)}%`}
            />
          </StatBar>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={onRestart}>
              Run again
            </Button>
            <Button
              variant="outline"
              render={<Link href={`${basePath}/runs/${SIMULATED_RUN_ID}`} />}
            >
              View full run →
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}

const GATE_TONE: Record<string, string> = {
  pass: "text-muted-foreground",
  clip: "text-amber-600 dark:text-amber-500",
  veto: "text-destructive",
}

/** One feed line. Mono, dense, colored only where the sign carries meaning. */
function FeedRow({ entry }: { entry: FeedEntry }) {
  switch (entry.kind) {
    case "lifecycle":
      return (
        <Marker>
          <MarkerContent>{entry.text}</MarkerContent>
        </Marker>
      )
    case "day":
      return (
        <Marker variant="separator" className="mt-1.5 first:mt-0">
          <MarkerContent className="font-semibold text-foreground">
            {entry.date} · repricing {entry.securities}{" "}
            {entry.securities === 1 ? "security" : "securities"}
          </MarkerContent>
        </Marker>
      )
    case "signal":
      return (
        <p className="text-muted-foreground">
          <span className="text-foreground">{entry.security}</span>{" "}
          <span>{entry.analystId}</span>{" "}
          <span
            className={cn(
              "tabular-nums",
              entry.conviction > 0
                ? "text-success"
                : entry.conviction < 0
                  ? "text-destructive"
                  : undefined
            )}
          >
            {formatSignedNumber(entry.conviction)}
          </span>{" "}
          <span className="italic">“{entry.thesis}”</span>
        </p>
      )
    case "committee":
      return (
        <p className="text-muted-foreground">
          <span className="text-foreground">{entry.security}</span> committee net{" "}
          <span className="tabular-nums">{formatSignedNumber(entry.netView)}</span>{" "}
          → target{" "}
          <span className="tabular-nums">
            {formatSignedPercent(entry.targetWeight, 1)}
          </span>
        </p>
      )
    case "gate":
      return (
        <p className={GATE_TONE[entry.gate.kind] ?? "text-muted-foreground"}>
          <span className="text-foreground">{entry.security}</span> risk gate:{" "}
          {entry.gate.label}
        </p>
      )
    case "fill":
      return (
        <p className="text-muted-foreground">
          <span
            className={entry.side === "buy" ? "text-success" : "text-destructive"}
          >
            {entry.side.toUpperCase()}
          </span>{" "}
          <span className="tabular-nums">
            {entry.qty.toLocaleString("en-US")} {entry.security} @ {entry.price}
          </span>{" "}
          · {entry.session}
        </p>
      )
    case "no-order":
      return (
        <p className="text-muted-foreground">
          <span className="text-foreground">{entry.security}</span> no order —
          already at target
        </p>
      )
  }
}
