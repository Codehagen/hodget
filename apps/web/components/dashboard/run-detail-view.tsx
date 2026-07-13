import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownRight01Icon,
  ArrowLeft01Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Scissor01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineIcon,
  TimelineItem,
  TimelineTime,
} from "@workspace/ui/components/timeline"

import type {
  Fill,
  GateAction,
  RunDetail,
  SecurityDecision,
  SignalRow,
} from "./demo-data"
import { analystName } from "./demo-data"
import { AnalystKindBadge, CaveatBanner, ConvictionBar } from "./primitives"
import { RunEquityChart } from "./run-equity-chart"
import { RunModeBadge, RunStatusBadge } from "./runs-table"

/* ---- formatting ---- */

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
})

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

function signedPct(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`
}

/* ---- metric tiles ---- */

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

function MetricsRow({ metrics }: { metrics: RunDetail["metrics"] }) {
  if (!metrics) return null
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <MetricTile label="Sharpe" value={metrics.sharpe.toFixed(2)} />
      <MetricTile label="CAGR" value={signedPct(metrics.cagr)} />
      <MetricTile
        label="Max drawdown"
        value={signedPct(metrics.maxDrawdown)}
      />
      <MetricTile label="Hit rate" value={`${metrics.hitRate.toFixed(0)}%`} />
      <MetricTile label="Turnover" value={`${metrics.turnover.toFixed(2)}×`} />
    </div>
  )
}

/* ---- decisions ---- */

function SignalLine({ signal }: { signal: SignalRow }) {
  return (
    <div className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <AnalystKindBadge kind={signal.kind} />
        <span className="font-mono text-xs font-medium text-foreground">
          {analystName(signal.analystId)}
        </span>
        <ConvictionBar value={signal.conviction} className="ml-auto" />
        <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {signal.horizonDays}d
        </span>
      </div>
      <p className="text-xs/relaxed text-muted-foreground">{signal.thesis}</p>
    </div>
  )
}

const GATE_META: Record<
  GateAction["kind"],
  { icon: typeof Scissor01Icon; className: string }
> = {
  clip: { icon: Scissor01Icon, className: "text-chart-4" },
  veto: { icon: Cancel01Icon, className: "text-destructive" },
  pass: { icon: CheckmarkCircle02Icon, className: "text-chart-2" },
}

function GateRow({ gate }: { gate: GateAction }) {
  const meta = GATE_META[gate.kind]
  return (
    <div className="flex items-center gap-2 text-xs">
      <HugeiconsIcon
        icon={meta.icon}
        size={14}
        className={cn("shrink-0", meta.className)}
      />
      <span className="font-medium text-muted-foreground">Risk gate</span>
      <span className={cn("font-medium", meta.className)}>{gate.label}</span>
    </div>
  )
}

const usd = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const qtyFmt = new Intl.NumberFormat("en-US")

function FillRow({ fill }: { fill: Fill }) {
  const buy = fill.side === "buy"
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <HugeiconsIcon
        icon={buy ? ArrowUpRight01Icon : ArrowDownRight01Icon}
        size={14}
        className={cn("shrink-0", buy ? "text-chart-2" : "text-chart-5")}
      />
      <span className="font-medium text-muted-foreground">Fill</span>
      <span
        className={cn(
          "font-mono font-medium tabular-nums",
          buy ? "text-chart-2" : "text-chart-5"
        )}
      >
        {buy ? "Buy" : "Sell"} {qtyFmt.format(fill.qty)}
      </span>
      <span className="font-mono text-muted-foreground tabular-nums">
        @ {usd.format(fill.price)}
      </span>
      <span className="text-muted-foreground">· {fill.session}</span>
    </div>
  )
}

function DecisionCard({ decision }: { decision: SecurityDecision }) {
  const { committee } = decision
  const long = committee.targetWeight >= 0
  return (
    <div className="flex flex-col gap-3 border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">
          {decision.security}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Net view{" "}
            <span
              className={cn(
                "font-mono font-medium tabular-nums",
                committee.netView >= 0 ? "text-chart-2" : "text-chart-5"
              )}
            >
              {committee.netView > 0 ? "+" : ""}
              {committee.netView.toFixed(2)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Target{" "}
            <span
              className={cn(
                "font-mono font-medium tabular-nums",
                long ? "text-chart-2" : "text-chart-5"
              )}
            >
              {signedPct(committee.targetWeight)}
            </span>
          </span>
        </div>
      </div>

      <div className="divide-y divide-border border-y border-border">
        {decision.signals.map((signal) => (
          <SignalLine key={signal.analystId} signal={signal} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <GateRow gate={decision.gate} />
        {decision.fill ? (
          <FillRow fill={decision.fill} />
        ) : (
          <span className="text-xs text-muted-foreground">
            No fill — order did not clear the gate.
          </span>
        )}
      </div>
    </div>
  )
}

function DecisionsTimeline({ decisions }: { decisions: RunDetail["decisions"] }) {
  return (
    <Timeline>
      {decisions.map((day) => (
        <TimelineItem key={day.date}>
          <TimelineConnector />
          <TimelineIcon>
            <HugeiconsIcon icon={Calendar03Icon} size={14} />
          </TimelineIcon>
          <TimelineContent className="gap-3">
            <TimelineTime>{shortDate.format(new Date(day.date))}</TimelineTime>
            <div className="flex flex-col gap-3">
              {day.securities.map((security) => (
                <DecisionCard key={security.security} decision={security} />
              ))}
            </div>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  )
}

/* ---- view ---- */

export function RunDetailView({
  basePath,
  detail,
}: {
  basePath: string
  detail: RunDetail
}) {
  const { run, strategy, metrics, equity, decisions, completedAt, durationSeconds } =
    detail
  const completed = run.status === "completed"

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <Link
          href={`${basePath}/runs`}
          className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
          All runs
        </Link>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
              {run.id}
            </h1>
            <RunModeBadge mode={run.mode} />
            <RunStatusBadge status={run.status} />
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Strategy</dt>
              <dd className="font-mono font-medium text-foreground">
                {strategy.name}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Created (UTC)</dt>
              <dd className="font-mono text-foreground tabular-nums">
                {dateTime.format(new Date(run.createdAt))}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Completed (UTC)</dt>
              <dd className="font-mono text-foreground tabular-nums">
                {completedAt ? dateTime.format(new Date(completedAt)) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="font-mono text-foreground tabular-nums">
                {durationSeconds != null ? formatDuration(durationSeconds) : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <CaveatBanner>
        Fixed-universe case study — results assume today&rsquo;s universe
        membership. Point-in-time data governs what each signal could see, but
        survivorship in the universe itself is not modeled.
      </CaveatBanner>

      {completed ? (
        <>
          <MetricsRow metrics={metrics} />

          <Card>
            <CardHeader>
              <CardTitle>Equity curve</CardTitle>
              <CardDescription>
                Book equity over the run window (USD)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RunEquityChart data={equity} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decisions</CardTitle>
              <CardDescription>
                Per day, per security: analyst signals → committee view → risk
                gate → fill.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DecisionsTimeline decisions={decisions} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No results yet</EmptyTitle>
                <EmptyDescription>
                  {run.status === "failed"
                    ? "This run failed before producing metrics or fills. Decisions and the equity curve are only available for completed runs."
                    : "This run is still in the queue or executing. Metrics, the equity curve, and the decision log appear once it completes."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
