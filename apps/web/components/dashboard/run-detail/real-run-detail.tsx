import Link from "next/link"
import dynamic from "next/dynamic"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { StatBar, StatItem } from "@workspace/ui/components/stat"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import type { RunDetail } from "@/lib/dal"

import type { EquityPoint } from "../demo-data"
import { formatSignedPercent, pnlToneClass } from "../format"
import { metricsFromEngine } from "../live-run/run-source"
import { StatusPill } from "../primitives"

// recharts is heavy; the equity panel loads in its own async chunk, mirroring the
// fixture run-detail view.
const RunEquityChart = dynamic(
  () => import("../run-equity-chart").then((m) => m.RunEquityChart),
  {
    loading: () => (
      <div aria-hidden className="h-72 w-full animate-pulse bg-muted/40" />
    ),
  },
)

/**
 * A focused, DB-backed detail surface for a real run (plan: real runs on
 * /dashboard). Deliberately NOT the full fixture experience — it shows what the
 * run actually persisted: headline metrics, the equity curve, and the per-day
 * decision log — reusing the fixture surfaces' primitives. A pending/failed run
 * shows an honest empty state.
 */
export function RealRunDetailView({
  basePath,
  detail,
}: {
  basePath: string
  detail: RunDetail
}) {
  const { run, result, decisions } = detail

  const equity = parseEquityCurve(result?.equityCurve)
  const metrics = metricsFromEngine(result?.metrics)
  const completed = run.status === "completed" && result != null

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`${basePath}/runs`} />}>
                Runs
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-mono">{run.id}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {run.id}
          </h1>
          <StatusPill status={run.mode} />
          <StatusPill status={run.status} />
        </div>
      </div>

      {!completed ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No results yet</EmptyTitle>
                <EmptyDescription>
                  {run.status === "failed"
                    ? run.error
                      ? `This run failed: ${run.error}`
                      : "This run failed before producing results."
                    : "This run is still queued or executing. Metrics, the equity curve, and the decision log appear once it completes."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          <Kpis equity={equity} metrics={metrics} decisionDays={decisions.length} />

          {equity.length > 0 ? (
            <Card className="gap-0">
              <CardHeader className="pb-2">
                <CardTitle>Portfolio equity</CardTitle>
              </CardHeader>
              <CardContent>
                <RunEquityChart
                  data={equity}
                  totalReturnLabel={totalReturnLabel(equity)}
                  maxDrawdownLabel={
                    metrics ? formatSignedPercent(metrics.maxDrawdown) : "—"
                  }
                />
              </CardContent>
            </Card>
          ) : null}

          <DecisionLog decisions={decisions} />
        </>
      )}
    </div>
  )
}

function Kpis({
  equity,
  metrics,
  decisionDays,
}: {
  equity: EquityPoint[]
  metrics: ReturnType<typeof metricsFromEngine>
  decisionDays: number
}) {
  const totalReturnPct = totalReturnPercent(equity)
  return (
    <StatBar>
      <StatItem
        label="Total return"
        value={formatSignedPercent(totalReturnPct)}
        valueClassName={pnlToneClass(totalReturnPct)}
      />
      <StatItem label="Sharpe" value={metrics ? metrics.sharpe.toFixed(2) : "—"} />
      <StatItem
        label="Max drawdown"
        value={metrics ? formatSignedPercent(metrics.maxDrawdown) : "—"}
        valueClassName="text-destructive"
      />
      <StatItem
        label="Turnover"
        value={metrics ? `${metrics.turnover.toFixed(2)}×` : "—"}
      />
      <StatItem label="Decision days" value={String(decisionDays)} />
    </StatBar>
  )
}

const HEAD =
  "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground"

function DecisionLog({ decisions }: { decisions: RunDetail["decisions"] }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle>Decision log</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {decisions.length === 0 ? (
          <div className="px-4 pb-4 text-xs text-muted-foreground">
            This run recorded no decisions.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${HEAD} pl-4`}>As of</TableHead>
                <TableHead className={`${HEAD} text-right`}>Signals</TableHead>
                <TableHead className={`${HEAD} text-right`}>Orders</TableHead>
                <TableHead className={`${HEAD} text-right`}>Gate actions</TableHead>
                <TableHead className={`${HEAD} pr-4 text-right`}>Fills</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.map((d) => (
                <TableRow key={d.decisionId} className="hover:bg-muted/40">
                  <TableCell className="py-2.5 pl-4 font-mono text-xs text-foreground tabular-nums">
                    {d.asOf.slice(0, 10)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums">
                    {d.signals.length}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums">
                    {d.orders.length}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums">
                    {d.gateActions.length}
                  </TableCell>
                  <TableCell className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums">
                    {d.fills.length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Parsing — result.equityCurve/metrics arrive as untrusted jsonb      */
/* ------------------------------------------------------------------ */

/** Narrow the persisted equity curve (jsonb) to `{ date, equity }[]`. */
function parseEquityCurve(raw: unknown): EquityPoint[] {
  if (!Array.isArray(raw)) return []
  const out: EquityPoint[] = []
  for (const p of raw) {
    if (
      p &&
      typeof p === "object" &&
      typeof (p as { date?: unknown }).date === "string" &&
      typeof (p as { equity?: unknown }).equity === "number"
    ) {
      const point = p as { date: string; equity: number }
      out.push({ date: point.date, equity: point.equity })
    }
  }
  return out
}

function totalReturnPercent(equity: EquityPoint[]): number {
  const first = equity[0]?.equity ?? 0
  const last = equity[equity.length - 1]?.equity ?? first
  return first > 0 ? (last / first - 1) * 100 : 0
}

function totalReturnLabel(equity: EquityPoint[]): string {
  return formatSignedPercent(totalReturnPercent(equity))
}
