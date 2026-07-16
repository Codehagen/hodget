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
import { SIMULATED_RUN_ID, useSimulatedRun, type FeedEntry } from "./simulated-run"
import { useRealRun } from "./real-run"
import type { RunDialogState, RunDialogStatus, RunSource } from "./run-source"

/**
 * "New run" dialog. One dialog, two data sources (plan 005 seam):
 *
 *  - `source="simulated"` (default, the public `/demo` surface): replays a scripted
 *    run from the committed fixtures — no backend, statically prerenderable.
 *  - `source="real"` (signed-in `/dashboard`): POSTs a real backtest to
 *    `/api/runs`, streams the engine's live `RunEvent`s over `/api/runs/[id]/events`,
 *    and shows the run's persisted metrics on completion.
 *
 * Both sources drive the same {@link RunDialogState}, so everything below the source
 * seam is shared presentation. Nothing runs (or connects) until the user opens the
 * dialog and presses Start, so the demo pages stay statically prerendered.
 */
export function LiveRunDialog({
  basePath,
  trigger,
  source = "simulated",
}: {
  basePath: string
  /** The trigger element, e.g. the surface's existing "New run" button. */
  trigger: React.ReactElement
  /** Which data source backs the dialog. Defaults to the scripted simulation. */
  source?: "simulated" | "real"
}) {
  return source === "real" ? (
    <RealRunDialog basePath={basePath} trigger={trigger} />
  ) : (
    <SimulatedRunDialog basePath={basePath} trigger={trigger} />
  )
}

/* ------------------------------------------------------------------ */
/* Source-specific chrome + adapters                                   */
/* ------------------------------------------------------------------ */

interface DialogChrome {
  /** The honest disclosure badge in the header. */
  readonly badge: { label: string; variant: "amber" | "blue" }
  readonly description: string
  readonly idle: React.ReactNode
}

function SimulatedRunDialog({
  basePath,
  trigger,
}: {
  basePath: string
  trigger: React.ReactElement
}) {
  const { state, detail, start, reset } = useSimulatedRun()

  // Adapt the scripted state onto the shared contract. The fixture id is the
  // stable label + detail target; metrics land on completion.
  const source: RunSource = {
    state: {
      status: state.status,
      runIdLabel: SIMULATED_RUN_ID,
      detailRunId: SIMULATED_RUN_ID,
      day: state.day,
      totalDays: state.totalDays,
      equity: state.equity,
      feed: state.feed,
      metrics: state.status === "completed" ? (detail?.metrics ?? null) : null,
      error: null,
    },
    strategyName: detail?.strategy.name ?? "earnings-drift",
    start,
    reset,
  }

  const chrome: DialogChrome = {
    badge: { label: "Simulated — mock data", variant: "amber" },
    description:
      "A scripted replay of a recorded backtest — the same event stream the engine emits, played back from the demo fixtures.",
    idle: (
      <>
        Launches the{" "}
        <span className="text-foreground">{source.strategyName}</span> panel over
        60 trading days of the bundled dataset: each decision day the analysts emit
        signals with written theses, the committee blends them into target weights,
        the risk gate clips or vetoes, and fills settle into the ledger.
      </>
    ),
  }

  return (
    <RunDialogFrame basePath={basePath} trigger={trigger} source={source} chrome={chrome} />
  )
}

function RealRunDialog({
  basePath,
  trigger,
}: {
  basePath: string
  trigger: React.ReactElement
}) {
  const source = useRealRun()

  const chrome: DialogChrome = {
    badge: { label: "Live — real engine", variant: "blue" },
    description:
      "Runs the real engine backtest on the bundled dataset and streams its progress live. The result is persisted to your runs.",
    idle: (
      <>
        Runs the{" "}
        <span className="text-foreground">{source.strategyName}</span> quant panel
        over the bundled dataset on the real engine: each decision day the analysts
        evaluate the universe, the committee sizes target weights, the risk gate
        clips or vetoes, and fills settle into the ledger. Progress streams here
        live; the committee, gate, and fill detail is saved to the run.
      </>
    ),
  }

  return (
    <RunDialogFrame basePath={basePath} trigger={trigger} source={source} chrome={chrome} />
  )
}

/* ------------------------------------------------------------------ */
/* Shared presentation                                                 */
/* ------------------------------------------------------------------ */

function RunDialogFrame({
  basePath,
  trigger,
  source,
  chrome,
}: {
  basePath: string
  trigger: React.ReactElement
  source: RunSource
  chrome: DialogChrome
}) {
  const { state } = source
  const showIdle = state.status === "idle" && !state.error

  return (
    <Dialog
      onOpenChange={(open) => {
        // Closing cancels a mid-flight run so a reopen starts clean.
        if (!open) source.reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>New run</DialogTitle>
            <Badge variant={chrome.badge.variant}>{chrome.badge.label}</Badge>
          </div>
          <DialogDescription>{chrome.description}</DialogDescription>
        </DialogHeader>

        {showIdle ? (
          <Idle onStart={source.start}>{chrome.idle}</Idle>
        ) : (
          <Replay state={state} basePath={basePath} onRestart={source.start} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Idle({
  onStart,
  children,
}: {
  onStart: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs/relaxed text-muted-foreground">{children}</p>
      <Button onClick={onStart} className="self-start">
        Start run
      </Button>
    </div>
  )
}

const STATUS_BADGE: Record<
  Exclude<RunDialogStatus, "idle">,
  { label: string; variant: "neutral" | "blue" | "green" | "red" | "amber" }
> = {
  queued: { label: "Queued", variant: "neutral" },
  running: { label: "Running", variant: "blue" },
  completed: { label: "Completed", variant: "green" },
  failed: { label: "Failed", variant: "red" },
  disconnected: { label: "Stream lost", variant: "amber" },
}

function Replay({
  state,
  basePath,
  onRestart,
}: {
  state: RunDialogState
  basePath: string
  onRestart: () => void
}) {
  const badge = STATUS_BADGE[state.status as Exclude<RunDialogStatus, "idle">]
  const terminal =
    state.status === "completed" ||
    state.status === "failed" ||
    state.status === "disconnected"
  // The progress bar tracks live execution only: shown while queued/running and
  // filled on completion, hidden for failed/disconnected so a stalled run never
  // animates an indeterminate bar. Indeterminate (null) while a real run's total
  // is unknown; exact for the scripted sweep.
  const showProgress =
    state.status === "queued" ||
    state.status === "running" ||
    state.status === "completed"
  const progressValue =
    state.status === "completed"
      ? 100
      : state.totalDays
        ? (state.day / state.totalDays) * 100
        : null

  return (
    // Fades in over the Idle panel it replaces inside the already-open dialog.
    <div className="flex flex-col gap-3 motion-safe:animate-fade-in">
      {/* Status strip. The badge remounts per status so each flip (rare — a
          handful per run) gets a subtle scale-pop; completion also draws a
          check just after the pop. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge
          key={state.status}
          variant={badge.variant}
          className="motion-safe:animate-scale-in"
        >
          {state.status === "completed" ? <CompletedCheck /> : null}
          {badge.label}
        </Badge>
        {state.runIdLabel ? (
          <span className="font-mono text-xs text-muted-foreground">
            {state.runIdLabel}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          Day {state.day} / {state.totalDays || "—"}
          {state.equity !== null
            ? ` · ${formatCurrencyCompact(state.equity)}`
            : ""}
        </span>
      </div>
      {showProgress ? <Progress value={progressValue} /> : null}

      {/* Event feed — pins to the newest entry while the run streams in;
          scrolling up releases the pin and surfaces the jump-to-end button. */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="h-56 rounded-none bg-card ring-1 ring-foreground/10">
          <MessageScrollerViewport aria-label="Run event feed">
            <MessageScrollerContent className="gap-1.5 p-3 font-mono text-[11px]/relaxed">
              {/* Rows fade in as they stream — arrival, not decoration, so
                  opacity only at the fast duration (matches ask-view turns). */}
              {state.feed.map((entry, i) => (
                <MessageScrollerItem
                  key={i}
                  className="motion-safe:animate-fade-in motion-safe:[animation-duration:var(--duration-fast)]"
                >
                  <FeedRow entry={entry} />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {state.error ? <ErrorBlock error={state.error} /> : null}

      {/* Result — the payoff, so completion earns a sequenced arrival: the
          container fades while the stats cascade in 60ms apart and the action
          row lands last (~640ms total, opacity/transform only, motion-safe).
          Failed/disconnected keep the plain single entrance — no celebration
          on a failure path. */}
      {terminal ? (
        <div
          className={cn(
            "flex flex-col gap-3",
            state.status === "completed"
              ? "motion-safe:animate-fade-in"
              : "motion-safe:animate-slide-up-fade"
          )}
        >
          {state.metrics ? (
            <StatBar>
              {/* min-w tightened from the default 9rem so all four fit one row
                  inside the dialog's width instead of orphaning the last cell.
                  Metrics only exist on completion, so the stagger never plays
                  on a failure path. */}
              <StatItem
                size="sm"
                className="min-w-[6.5rem] motion-safe:animate-slide-up-fade"
                style={{ animationFillMode: "backwards" }}
                label="Sharpe"
                value={state.metrics.sharpe.toFixed(2)}
              />
              <StatItem
                size="sm"
                className="min-w-[6.5rem] motion-safe:animate-slide-up-fade"
                style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
                label="CAGR"
                value={formatSignedPercent(state.metrics.cagr, 1)}
              />
              <StatItem
                size="sm"
                className="min-w-[6.5rem] motion-safe:animate-slide-up-fade"
                style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
                label="Max drawdown"
                value={formatSignedPercent(state.metrics.maxDrawdown, 1)}
              />
              <StatItem
                size="sm"
                className="min-w-[6.5rem] motion-safe:animate-slide-up-fade"
                style={{ animationDelay: "180ms", animationFillMode: "backwards" }}
                label="Hit rate"
                value={`${state.metrics.hitRate.toFixed(0)}%`}
              />
            </StatBar>
          ) : null}
          {state.error?.kind !== "auth" ? (
            <div
              className={cn(
                "flex flex-wrap items-center justify-end gap-2",
                state.status === "completed" &&
                  "motion-safe:animate-slide-up-fade"
              )}
              style={
                state.status === "completed"
                  ? { animationDelay: "240ms", animationFillMode: "backwards" }
                  : undefined
              }
            >
              <Button variant="ghost" onClick={onRestart}>
                Run again
              </Button>
              {state.detailRunId ? (
                <Button
                  variant="outline"
                  render={
                    <Link href={`${basePath}/runs/${state.detailRunId}`} />
                  }
                >
                  View full run →
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Failure / session notice. Auth failures offer a sign-in link; engine and
 * connection failures state what happened. */
function ErrorBlock({
  error,
}: {
  error: NonNullable<RunDialogState["error"]>
}) {
  return (
    <div className="flex flex-col gap-2 border border-destructive/30 bg-destructive/5 p-3 text-xs/relaxed">
      <p className="text-destructive">{error.message}</p>
      {error.kind === "auth" ? (
        <Button variant="outline" size="sm" className="self-start" render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      ) : null}
    </div>
  )
}

/** Check drawn inside the Completed badge — the checkbox's draw-stroke idiom
 * (checkbox.tsx), delayed 100ms so it lands just after the badge's scale-in. */
function CompletedCheck() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M11.5 4L5.75 10L2.5 7"
        pathLength="1"
        strokeDasharray="1"
        className="motion-safe:animate-draw-stroke"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    case "day-tick":
      return (
        <Marker variant="separator" className="mt-1.5 first:mt-0">
          <MarkerContent className="font-semibold text-foreground">
            Day {entry.day} · {entry.date}
          </MarkerContent>
        </Marker>
      )
    case "analyst":
      return (
        <p className="text-muted-foreground">
          <span className="text-foreground">{entry.security}</span>{" "}
          <span>{entry.analystId}</span> evaluated
        </p>
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
          <span className="tabular-nums">
            {formatSignedNumber(entry.netView)}
          </span>{" "}
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
            className={
              entry.side === "buy" ? "text-success" : "text-destructive"
            }
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
