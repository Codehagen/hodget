/**
 * Demo fixtures for the dashboard surface.
 *
 * Every value here is a hand-picked, DETERMINISTIC mock — no `Math.random`,
 * no `Date.now`, nothing that varies between renders or between server and
 * client. This is what powers the public `/demo` page (mock data, no account)
 * and, for now, the authenticated `/dashboard` until live run data is wired in.
 *
 * Numbers are plausible for a small systematic book: a low-eight-figure equity
 * curve, a handful of concurrent engine runs, single-digit Sharpe ratios.
 * Timestamps are UTC — the engine reports everything in UTC. Currency is USD.
 */

export type RunMode = "backtest" | "paper"
export type RunStatus = "queued" | "running" | "completed" | "failed"

export type DemoRun = {
  id: string
  strategy: string
  mode: RunMode
  status: RunStatus
  /** Realized Sharpe; null while a run is queued/running or on failure. */
  sharpe: number | null
  /** ISO-8601, UTC. */
  createdAt: string
}

export type EquityPoint = {
  /** Short UTC label, e.g. "Apr 14". */
  date: string
  /** Book equity in USD. */
  equity: number
}

export type OverviewStat = {
  label: string
  /** Preformatted display value — the card renders it verbatim in tabular figures. */
  value: string
  hint: string
  delta?: {
    /** Preformatted, e.g. "+4.2%". */
    label: string
    direction: "up" | "down" | "flat"
  }
}

export type StatusSlice = {
  status: RunStatus
  label: string
  count: number
  /** Chart token, resolved by ChartContainer. */
  fill: string
}

export type DashboardData = {
  stats: OverviewStat[]
  equity: EquityPoint[]
  runs: DemoRun[]
  statusBreakdown: StatusSlice[]
}

/* ------------------------------------------------------------------ */
/* Equity curve — deterministic, seeded (no runtime randomness)        */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const CURVE_DAYS = 90
const CURVE_START_EQUITY = 10_000_000
// Fixed epoch: 2026-04-14T00:00:00Z. Pure arithmetic on a constant — deterministic.
const CURVE_START_MS = Date.UTC(2026, 3, 14)
const DAY_MS = 86_400_000

// A tiny linear congruential generator, seeded from a constant. Produces the
// same pseudo-random walk on every machine and render — deterministic, so the
// server and client agree and the page prerenders cleanly.
function buildEquityCurve(): EquityPoint[] {
  let seed = 0x4a3f2b1d
  const nextUnit = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const points: EquityPoint[] = []
  let equity = CURVE_START_EQUITY

  for (let i = 0; i < CURVE_DAYS; i++) {
    // Slight positive drift with realistic daily wobble in ~[-0.9%, +1.1%].
    const dailyReturn = (nextUnit() - 0.42) * 0.02
    equity = equity * (1 + dailyReturn)

    const d = new Date(CURVE_START_MS + i * DAY_MS)
    points.push({
      date: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      equity: Math.round(equity),
    })
  }

  return points
}

const EQUITY_CURVE = buildEquityCurve()

/* ------------------------------------------------------------------ */
/* Runs — realistic engine-run rows                                    */
/* ------------------------------------------------------------------ */

const RUNS: DemoRun[] = [
  {
    id: "run_8c41d0",
    strategy: "earnings-drift",
    mode: "paper",
    status: "running",
    sharpe: null,
    createdAt: "2026-07-13T06:12:00.000Z",
  },
  {
    id: "run_8c41cf",
    strategy: "value-panel",
    mode: "backtest",
    status: "completed",
    sharpe: 1.94,
    createdAt: "2026-07-13T05:40:00.000Z",
  },
  {
    id: "run_8c41ce",
    strategy: "momentum-carry",
    mode: "backtest",
    status: "completed",
    sharpe: 2.18,
    createdAt: "2026-07-12T22:05:00.000Z",
  },
  {
    id: "run_8c41cd",
    strategy: "mean-reversion-etf",
    mode: "paper",
    status: "queued",
    sharpe: null,
    createdAt: "2026-07-12T21:18:00.000Z",
  },
  {
    id: "run_8c41cc",
    strategy: "quality-defensive",
    mode: "backtest",
    status: "completed",
    sharpe: 1.12,
    createdAt: "2026-07-12T17:47:00.000Z",
  },
  {
    id: "run_8c41cb",
    strategy: "vol-target-macro",
    mode: "paper",
    status: "failed",
    sharpe: null,
    createdAt: "2026-07-12T14:33:00.000Z",
  },
  {
    id: "run_8c41ca",
    strategy: "pairs-sector-neutral",
    mode: "backtest",
    status: "completed",
    sharpe: 1.57,
    createdAt: "2026-07-12T11:09:00.000Z",
  },
  {
    id: "run_8c41c9",
    strategy: "breakout-smallcap",
    mode: "backtest",
    status: "completed",
    sharpe: 0.83,
    createdAt: "2026-07-12T08:52:00.000Z",
  },
  {
    id: "run_8c41c8",
    strategy: "earnings-drift",
    mode: "backtest",
    status: "completed",
    sharpe: 1.41,
    createdAt: "2026-07-11T23:26:00.000Z",
  },
  {
    id: "run_8c41c7",
    strategy: "momentum-carry",
    mode: "paper",
    status: "completed",
    sharpe: -0.19,
    createdAt: "2026-07-11T19:04:00.000Z",
  },
]

/* ------------------------------------------------------------------ */
/* Derived aggregates — computed from the fixtures above so the stat   */
/* cards, donut and curve never drift out of sync with each other.     */
/* ------------------------------------------------------------------ */

const usdCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
  currency: "USD",
  style: "currency",
})

const lastEquity = EQUITY_CURVE[EQUITY_CURVE.length - 1]!.equity
const firstEquity = EQUITY_CURVE[0]!.equity
const totalReturnPct = ((lastEquity - firstEquity) / firstEquity) * 100

const openPositions = 34
const activeRuns = RUNS.filter(
  (r) => r.status === "running" || r.status === "queued"
).length
const bestSharpe = RUNS.reduce(
  (best, r) => (r.sharpe != null && r.sharpe > best ? r.sharpe : best),
  0
)

const STATS: OverviewStat[] = [
  {
    label: "Total equity",
    value: usdCompact.format(lastEquity),
    hint: "Mark-to-market, USD",
    delta: {
      label: `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%`,
      direction: totalReturnPct >= 0 ? "up" : "down",
    },
  },
  {
    label: "Open positions",
    value: String(openPositions),
    hint: "Across 8 strategies",
  },
  {
    label: "Active runs",
    value: String(activeRuns),
    hint: "Running or queued",
  },
  {
    label: "Best Sharpe",
    value: bestSharpe.toFixed(2),
    hint: "momentum-carry · backtest",
  },
]

// Categorical breakdown of every run's status. Colors follow the house chart
// guidance: chart-1 / chart-3 / chart-5 plus muted-foreground for the "other"
// (failed) slice — never five bespoke tokens without direct labels.
const STATUS_BREAKDOWN: StatusSlice[] = [
  {
    status: "completed",
    label: "Completed",
    count: RUNS.filter((r) => r.status === "completed").length,
    fill: "var(--chart-5)",
  },
  {
    status: "running",
    label: "Running",
    count: RUNS.filter((r) => r.status === "running").length,
    fill: "var(--chart-3)",
  },
  {
    status: "queued",
    label: "Queued",
    count: RUNS.filter((r) => r.status === "queued").length,
    fill: "var(--chart-1)",
  },
  {
    status: "failed",
    label: "Failed",
    count: RUNS.filter((r) => r.status === "failed").length,
    fill: "var(--muted-foreground)",
  },
]

/** The single demo dataset consumed by the dashboard view. */
export const DEMO_DASHBOARD: DashboardData = {
  stats: STATS,
  equity: EQUITY_CURVE,
  runs: RUNS,
  statusBreakdown: STATUS_BREAKDOWN,
}
