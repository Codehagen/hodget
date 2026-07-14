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
  { id: "run_8c41d0", strategy: "earnings-drift", mode: "paper", status: "running", sharpe: null, createdAt: "2026-07-13T06:12:00.000Z" },
  { id: "run_8c41cf", strategy: "value-panel", mode: "backtest", status: "completed", sharpe: 1.57, createdAt: "2026-07-13T05:40:00.000Z" },
  { id: "run_8c41ce", strategy: "momentum-carry", mode: "backtest", status: "completed", sharpe: 2.18, createdAt: "2026-07-12T22:05:00.000Z" },
  { id: "run_8c41cd", strategy: "mean-reversion-etf", mode: "paper", status: "queued", sharpe: null, createdAt: "2026-07-12T21:18:00.000Z" },
  { id: "run_8c41cc", strategy: "ose-energy", mode: "backtest", status: "completed", sharpe: 1.38, createdAt: "2026-07-12T17:47:00.000Z" },
  { id: "run_8c41cb", strategy: "momentum-carry", mode: "paper", status: "failed", sharpe: null, createdAt: "2026-07-12T14:33:00.000Z" },
  { id: "run_8c41ca", strategy: "earnings-drift", mode: "backtest", status: "completed", sharpe: 1.94, createdAt: "2026-07-12T11:09:00.000Z" },
  { id: "run_8c41c9", strategy: "mean-reversion-etf", mode: "backtest", status: "completed", sharpe: 1.12, createdAt: "2026-07-12T08:52:00.000Z" },
  { id: "run_8c41c8", strategy: "value-panel", mode: "backtest", status: "completed", sharpe: 1.41, createdAt: "2026-07-11T23:26:00.000Z" },
  { id: "run_8c41c7", strategy: "momentum-carry", mode: "paper", status: "completed", sharpe: 1.71, createdAt: "2026-07-11T19:04:00.000Z" },
  { id: "run_8c41c6", strategy: "ose-energy", mode: "paper", status: "running", sharpe: null, createdAt: "2026-07-11T15:20:00.000Z" },
  { id: "run_8c41c5", strategy: "earnings-drift", mode: "backtest", status: "completed", sharpe: 1.28, createdAt: "2026-07-11T10:03:00.000Z" },
  { id: "run_8c41c4", strategy: "mean-reversion-etf", mode: "paper", status: "completed", sharpe: 0.74, createdAt: "2026-07-10T22:41:00.000Z" },
  { id: "run_8c41c3", strategy: "value-panel", mode: "paper", status: "completed", sharpe: 1.06, createdAt: "2026-07-10T18:15:00.000Z" },
  { id: "run_8c41c2", strategy: "momentum-carry", mode: "backtest", status: "completed", sharpe: 1.42, createdAt: "2026-07-10T13:52:00.000Z" },
  { id: "run_8c41c1", strategy: "ose-energy", mode: "backtest", status: "completed", sharpe: 0.92, createdAt: "2026-07-10T09:30:00.000Z" },
  { id: "run_8c41c0", strategy: "earnings-drift", mode: "paper", status: "completed", sharpe: 1.63, createdAt: "2026-07-09T21:14:00.000Z" },
  { id: "run_8c41bf", strategy: "mean-reversion-etf", mode: "backtest", status: "failed", sharpe: null, createdAt: "2026-07-09T16:48:00.000Z" },
  { id: "run_8c41be", strategy: "value-panel", mode: "backtest", status: "completed", sharpe: 0.88, createdAt: "2026-07-09T12:05:00.000Z" },
  { id: "run_8c41bd", strategy: "momentum-carry", mode: "paper", status: "completed", sharpe: -0.19, createdAt: "2026-07-09T08:33:00.000Z" },
  { id: "run_8c41bc", strategy: "ose-energy", mode: "paper", status: "completed", sharpe: 1.15, createdAt: "2026-07-08T20:22:00.000Z" },
  { id: "run_8c41bb", strategy: "earnings-drift", mode: "backtest", status: "completed", sharpe: 1.77, createdAt: "2026-07-08T14:09:00.000Z" },
  { id: "run_8c41ba", strategy: "mean-reversion-etf", mode: "backtest", status: "completed", sharpe: 0.61, createdAt: "2026-07-08T10:41:00.000Z" },
  { id: "run_8c41b9", strategy: "value-panel", mode: "paper", status: "queued", sharpe: null, createdAt: "2026-07-08T07:55:00.000Z" },
  { id: "run_8c41b8", strategy: "momentum-carry", mode: "backtest", status: "completed", sharpe: 1.33, createdAt: "2026-07-07T19:30:00.000Z" },
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
    hint: "Across 5 strategies",
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

/** The full run log — every fixture run, newest first. */
export const ALL_RUNS: DemoRun[] = RUNS

/* ================================================================== */
/* Deterministic seeding                                              */
/*                                                                    */
/* Every derived series below is seeded from a constant or from a     */
/* fixture string (a run id) — never from Date.now()/Math.random() —  */
/* so server and client render byte-identical output and every page   */
/* prerenders cleanly.                                                 */
/* ================================================================== */

// FNV-1a hash → a stable positive 31-bit seed for a string.
function seedFromString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % 0x7fffffff || 1
}

// Same LCG shape as buildEquityCurve — a seeded uniform stream in [0, 1).
function lcg(seed: number): () => number {
  let state = seed & 0x7fffffff || 1
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

/* ================================================================== */
/* Analysts — the roster that emits signals                          */
/* ================================================================== */

export type AnalystKind = "quant" | "llm"

export type AnalystSignal = {
  /** Ticker as displayed (may carry an exchange suffix, e.g. EQNR.OL). */
  security: string
  /** Conviction in [-1, 1]. Sign is direction, magnitude is strength. */
  conviction: number
  horizonDays: number
  thesis: string
  /** ISO date (date-only stamp ⇒ acts on the next trading day). */
  date: string
}

export type Analyst = {
  id: string
  kind: AnalystKind
  name: string
  /** One-line description of the method. */
  method: string
  stats: {
    signalsEmitted: number
    /** 0..100, share of signals that were directionally right. */
    hitRate: number
    /** 0..100, average absolute conviction rendered as a score. */
    avgConviction: number
  }
  recentSignals: AnalystSignal[]
}

export const ANALYSTS: Analyst[] = [
  {
    id: "quant.earnings-drift",
    kind: "quant",
    name: "Earnings drift",
    method:
      "Ranks names by standardized earnings surprise, then drifts into the post-announcement window before the market fully reprices.",
    stats: { signalsEmitted: 412, hitRate: 58, avgConviction: 64 },
    recentSignals: [
      {
        security: "NVDA",
        conviction: 0.82,
        horizonDays: 20,
        thesis:
          "+11% revenue beat with raised guidance; drift historically runs three weeks past the print.",
        date: "2026-07-12",
      },
      {
        security: "AAPL",
        conviction: 0.34,
        horizonDays: 15,
        thesis:
          "Modest services beat, hardware in line — a small, decaying long tilt.",
        date: "2026-07-11",
      },
      {
        security: "MSFT",
        conviction: -0.21,
        horizonDays: 15,
        thesis:
          "Azure decelerated versus consensus; fade the initial pop.",
        date: "2026-07-10",
      },
    ],
  },
  {
    id: "llm.value",
    kind: "llm",
    name: "Value",
    method:
      "Reads filings and call transcripts to judge whether price has dislocated from a conservative estimate of intrinsic value.",
    stats: { signalsEmitted: 268, hitRate: 54, avgConviction: 71 },
    recentSignals: [
      {
        security: "JPM",
        conviction: 0.61,
        horizonDays: 60,
        thesis:
          "Trades below tangible book while ROTCE stays mid-teens; buyback pace adds a floor.",
        date: "2026-07-13",
      },
      {
        security: "PFE",
        conviction: 0.28,
        horizonDays: 90,
        thesis:
          "Pipeline optionality under-priced, but patent-cliff overhang caps conviction.",
        date: "2026-07-11",
      },
      {
        security: "KO",
        conviction: -0.12,
        horizonDays: 60,
        thesis:
          "Defensive premium looks full versus organic growth; trim.",
        date: "2026-07-09",
      },
    ],
  },
  {
    id: "quant.mean-reversion",
    kind: "quant",
    name: "Mean reversion",
    method:
      "Fades short-horizon dislocations against a rolling volatility band, sized inversely to realized vol.",
    stats: { signalsEmitted: 903, hitRate: 52, avgConviction: 43 },
    recentSignals: [
      {
        security: "XLE",
        conviction: 0.47,
        horizonDays: 5,
        thesis:
          "Two-sigma washout on no fundamental news; band snap-back setup.",
        date: "2026-07-12",
      },
      {
        security: "SPY",
        conviction: -0.33,
        horizonDays: 3,
        thesis:
          "Stretched above the upper band into a low-liquidity session.",
        date: "2026-07-11",
      },
      {
        security: "XLK",
        conviction: 0.19,
        horizonDays: 5,
        thesis:
          "Mild oversold, but trend is up — a small counter-trend clip.",
        date: "2026-07-10",
      },
    ],
  },
  {
    id: "llm.macro",
    kind: "llm",
    name: "Macro",
    method:
      "Synthesizes macro releases and central-bank language into directional cross-asset and single-name energy views.",
    stats: { signalsEmitted: 187, hitRate: 49, avgConviction: 66 },
    recentSignals: [
      {
        security: "EQNR.OL",
        conviction: 0.55,
        horizonDays: 30,
        thesis:
          "Tightening Brent backwardation plus resilient European gas demand supports the majors.",
        date: "2026-07-12",
      },
      {
        security: "AKRBP.OL",
        conviction: 0.41,
        horizonDays: 30,
        thesis:
          "High-torque to Brent with a covered dividend; leveraged read on the same view.",
        date: "2026-07-10",
      },
      {
        security: "VAR.OL",
        conviction: -0.24,
        horizonDays: 20,
        thesis:
          "Cost inflation on the development book offsets the price tailwind.",
        date: "2026-07-08",
      },
    ],
  },
]

const ANALYST_NAME: Record<string, string> = Object.fromEntries(
  ANALYSTS.map((a) => [a.id, a.name])
)

export function analystName(id: string): string {
  return ANALYST_NAME[id] ?? id
}

/* ================================================================== */
/* Strategies — panel configs (committee lineups over a universe)    */
/* ================================================================== */

export type StrategyLineup = { analystId: string; weight: number }

export type Strategy = {
  id: string
  name: string
  /** Current panel version, e.g. "v3.2.1". */
  version: string
  description: string
  universeLabel: string
  /** Primary market identifier code for the universe. */
  universeMic: string
  lineup: StrategyLineup[]
}

export type StrategyWithStats = Strategy & {
  runCount: number
  bestSharpe: number | null
  lastRunStatus: RunStatus | null
}

const STRATEGIES: Strategy[] = [
  {
    id: "earnings-drift",
    name: "Earnings drift",
    version: "v2.4.0",
    description:
      "Post-earnings announcement drift on US large-cap technology, held through the reaction window.",
    universeLabel: "US large-cap tech",
    universeMic: "XNAS",
    lineup: [
      { analystId: "quant.earnings-drift", weight: 0.6 },
      { analystId: "llm.value", weight: 0.4 },
    ],
  },
  {
    id: "value-panel",
    name: "Value panel",
    version: "v3.2.1",
    description:
      "Fundamental value with an LLM thesis review on US large-cap financials and staples.",
    universeLabel: "US large-cap value",
    universeMic: "XNYS",
    lineup: [
      { analystId: "llm.value", weight: 0.55 },
      { analystId: "quant.mean-reversion", weight: 0.45 },
    ],
  },
  {
    id: "momentum-carry",
    name: "Momentum carry",
    version: "v1.8.3",
    description:
      "Cross-sectional momentum with a carry tilt across US and international large caps.",
    universeLabel: "Global large-cap",
    universeMic: "XNAS",
    lineup: [
      { analystId: "quant.earnings-drift", weight: 0.35 },
      { analystId: "llm.macro", weight: 0.65 },
    ],
  },
  {
    id: "mean-reversion-etf",
    name: "Mean reversion ETF",
    version: "v2.0.2",
    description:
      "Short-horizon mean reversion on liquid US sector and index ETFs, vol-scaled.",
    universeLabel: "US sector ETFs",
    universeMic: "ARCX",
    lineup: [
      { analystId: "quant.mean-reversion", weight: 0.7 },
      { analystId: "llm.value", weight: 0.3 },
    ],
  },
  {
    id: "ose-energy",
    name: "Oslo energy",
    version: "v1.1.0",
    description:
      "Macro-driven long/short on Oslo Børs energy names, routed through EODHD point-in-time data.",
    universeLabel: "OSE energy",
    universeMic: "XOSL",
    lineup: [
      { analystId: "llm.macro", weight: 0.5 },
      { analystId: "quant.earnings-drift", weight: 0.5 },
    ],
  },
]

const STRATEGY_BY_ID: Record<string, Strategy> = Object.fromEntries(
  STRATEGIES.map((s) => [s.id, s])
)

/** Strategies with run aggregates derived from the RUNS log — always in sync. */
export const STRATEGIES_WITH_STATS: StrategyWithStats[] = STRATEGIES.map(
  (strategy) => {
    const runs = RUNS.filter((r) => r.strategy === strategy.id)
    const sharpes = runs
      .map((r) => r.sharpe)
      .filter((s): s is number => s != null)
    // RUNS is authored newest-first, so the first match is the latest run.
    const latest = runs[0] ?? null
    return {
      ...strategy,
      runCount: runs.length,
      bestSharpe: sharpes.length ? Math.max(...sharpes) : null,
      lastRunStatus: latest?.status ?? null,
    }
  }
)

/* ================================================================== */
/* Run detail — per-run equity curve, metrics, and decisions          */
/* ================================================================== */

export type RunMetrics = {
  sharpe: number
  cagr: number
  maxDrawdown: number
  hitRate: number
  turnover: number
}

export type SignalRow = {
  analystId: string
  kind: AnalystKind
  conviction: number
  horizonDays: number
  thesis: string
}

export type GateAction = {
  kind: "clip" | "veto" | "pass"
  label: string
}

export type Fill = {
  side: "buy" | "sell"
  qty: number
  price: number
  /** Human label for the settlement session, e.g. "Next session · Jul 13". */
  session: string
}

export type SecurityDecision = {
  security: string
  signals: SignalRow[]
  committee: {
    /** Net conviction-weighted view in [-1, 1]. */
    netView: number
    /** Target portfolio weight in percent (signed). */
    targetWeight: number
  }
  gate: GateAction
  fill: Fill | null
}

export type DecisionDay = {
  date: string
  securities: SecurityDecision[]
}

export type RunDetail = {
  run: DemoRun
  strategy: StrategyWithStats
  metrics: RunMetrics | null
  equity: EquityPoint[]
  decisions: DecisionDay[]
  /** ISO-8601 completion time; null unless the run completed. */
  completedAt: string | null
  /** Wall-clock run duration in seconds; null unless completed. */
  durationSeconds: number | null
}

const ANALYST_KIND: Record<string, AnalystKind> = Object.fromEntries(
  ANALYSTS.map((a) => [a.id, a.kind])
)

// A per-run equity curve, seeded from the run id so it is stable per run but
// distinct across runs. Drift leans on the run's realized Sharpe.
function buildRunCurve(run: DemoRun): EquityPoint[] {
  const next = lcg(seedFromString(run.id))
  const days = 60
  const drift = ((run.sharpe ?? 0.4) * 0.01) / Math.sqrt(252)
  const points: EquityPoint[] = []
  let equity = CURVE_START_EQUITY
  for (let i = 0; i < days; i++) {
    const shock = (next() - 0.5) * 0.02
    equity = equity * (1 + drift + shock)
    const d = new Date(CURVE_START_MS + i * DAY_MS)
    points.push({
      date: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      equity: Math.round(equity),
    })
  }
  return points
}

function buildRunMetrics(run: DemoRun, curve: EquityPoint[]): RunMetrics {
  const first = curve[0]!.equity
  const last = curve[curve.length - 1]!.equity
  const totalReturn = last / first
  const cagr = (Math.pow(totalReturn, 252 / curve.length) - 1) * 100

  let peak = curve[0]!.equity
  let maxDrawdown = 0
  let up = 0
  for (let i = 0; i < curve.length; i++) {
    const e = curve[i]!.equity
    if (e > peak) peak = e
    const dd = (e - peak) / peak
    if (dd < maxDrawdown) maxDrawdown = dd
    if (i > 0 && e >= curve[i - 1]!.equity) up++
  }

  const next = lcg(seedFromString(`${run.id}:turnover`))
  const turnover = 0.6 + next() * 1.9

  return {
    sharpe: run.sharpe ?? 0,
    cagr,
    maxDrawdown: maxDrawdown * 100,
    hitRate: (up / (curve.length - 1)) * 100,
    turnover,
  }
}

function sig(
  analystId: string,
  conviction: number,
  horizonDays: number,
  thesis: string
): SignalRow {
  return {
    analystId,
    kind: ANALYST_KIND[analystId] ?? "quant",
    conviction,
    horizonDays,
    thesis,
  }
}

// Curated decision days per strategy. Every run of a strategy shows the same
// committee walkthrough — the analysts, universe, and gates are properties of
// the panel, not of the individual run.
const DECISIONS_BY_STRATEGY: Record<string, DecisionDay[]> = {
  "earnings-drift": [
    {
      date: "2026-07-08",
      securities: [
        {
          security: "NVDA",
          signals: [
            sig(
              "quant.earnings-drift",
              0.82,
              20,
              "+11% revenue beat, guidance raised; drift window still open."
            ),
            sig(
              "llm.value",
              0.18,
              20,
              "Rich on forward earnings, but momentum thesis dominates here."
            ),
          ],
          committee: { netView: 0.56, targetWeight: 8 },
          gate: {
            kind: "clip",
            label: "Clipped 8% → 5% (max single-name position)",
          },
          fill: {
            side: "buy",
            qty: 1_240,
            price: 168.42,
            session: "Next session · Jul 9",
          },
        },
        {
          security: "AAPL",
          signals: [
            sig(
              "quant.earnings-drift",
              0.34,
              15,
              "Services beat, hardware in line; small decaying tilt."
            ),
            sig(
              "llm.value",
              0.22,
              30,
              "Fair value with a modest buyback floor."
            ),
          ],
          committee: { netView: 0.29, targetWeight: 3.2 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "buy",
            qty: 820,
            price: 213.07,
            session: "Next session · Jul 9",
          },
        },
      ],
    },
    {
      date: "2026-07-09",
      securities: [
        {
          security: "MSFT",
          signals: [
            sig(
              "quant.earnings-drift",
              -0.21,
              15,
              "Azure decelerated vs consensus; fade the initial pop."
            ),
            sig(
              "llm.value",
              0.05,
              45,
              "Long-term compounder — declines to press the short."
            ),
          ],
          committee: { netView: -0.11, targetWeight: -1.4 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "sell",
            qty: 340,
            price: 471.9,
            session: "Next session · Jul 10",
          },
        },
      ],
    },
    {
      date: "2026-07-10",
      securities: [
        {
          security: "NVDA",
          signals: [
            sig(
              "quant.earnings-drift",
              0.61,
              12,
              "Drift decaying but positive; hold the reduced clip."
            ),
            sig("llm.value", -0.1, 20, "Valuation drag grows as price runs."),
          ],
          committee: { netView: 0.33, targetWeight: 5 },
          gate: { kind: "pass", label: "Held at cap" },
          fill: null,
        },
      ],
    },
  ],
  "value-panel": [
    {
      date: "2026-07-09",
      securities: [
        {
          security: "JPM",
          signals: [
            sig(
              "llm.value",
              0.61,
              60,
              "Below tangible book with mid-teens ROTCE; buyback adds a floor."
            ),
            sig(
              "quant.mean-reversion",
              0.22,
              5,
              "Oversold into the print; minor tactical add."
            ),
          ],
          committee: { netView: 0.44, targetWeight: 6.5 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "buy",
            qty: 2_100,
            price: 214.6,
            session: "Next session · Jul 10",
          },
        },
        {
          security: "KO",
          signals: [
            sig(
              "llm.value",
              -0.12,
              60,
              "Defensive premium looks full versus organic growth."
            ),
            sig(
              "quant.mean-reversion",
              -0.28,
              4,
              "Stretched above the upper band; fade."
            ),
          ],
          committee: { netView: -0.19, targetWeight: -2.1 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "sell",
            qty: 900,
            price: 71.15,
            session: "Next session · Jul 10",
          },
        },
      ],
    },
    {
      date: "2026-07-10",
      securities: [
        {
          security: "PFE",
          signals: [
            sig(
              "llm.value",
              0.28,
              90,
              "Pipeline optionality under-priced; patent cliff caps conviction."
            ),
            sig("quant.mean-reversion", 0.09, 6, "Mild oversold, low signal."),
          ],
          committee: { netView: 0.2, targetWeight: 2.4 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "buy",
            qty: 3_400,
            price: 28.44,
            session: "Next session · Jul 13",
          },
        },
      ],
    },
  ],
  "momentum-carry": [
    {
      date: "2026-07-08",
      securities: [
        {
          security: "NVDA",
          signals: [
            sig(
              "quant.earnings-drift",
              0.7,
              20,
              "Top-decile 6-month momentum with positive carry."
            ),
            sig(
              "llm.macro",
              0.4,
              30,
              "AI-capex cycle intact; supportive macro backdrop."
            ),
          ],
          committee: { netView: 0.51, targetWeight: 7 },
          gate: {
            kind: "clip",
            label: "Clipped 7% → 5% (max single-name position)",
          },
          fill: {
            side: "buy",
            qty: 980,
            price: 168.42,
            session: "Next session · Jul 9",
          },
        },
      ],
    },
    {
      date: "2026-07-09",
      securities: [
        {
          security: "TSM",
          signals: [
            sig(
              "quant.earnings-drift",
              0.45,
              20,
              "Momentum positive, foundry utilization rising."
            ),
            sig(
              "llm.macro",
              0.33,
              30,
              "Taiwan risk premium elevated but carry compensates."
            ),
          ],
          committee: { netView: 0.4, targetWeight: 4.5 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "buy",
            qty: 1_450,
            price: 191.2,
            session: "Next session · Jul 10",
          },
        },
        {
          security: "ASML.AS",
          signals: [
            sig(
              "quant.earnings-drift",
              -0.3,
              20,
              "Momentum rolled over after the guide-down."
            ),
            sig(
              "llm.macro",
              -0.18,
              30,
              "Order timing pushes right; negative carry near term.",
            ),
          ],
          committee: { netView: -0.26, targetWeight: -3 },
          gate: {
            kind: "veto",
            label: "Vetoed — FX + settlement gate (EUR line unfunded this cycle)",
          },
          fill: null,
        },
      ],
    },
  ],
  "mean-reversion-etf": [
    {
      date: "2026-07-09",
      securities: [
        {
          security: "XLE",
          signals: [
            sig(
              "quant.mean-reversion",
              0.47,
              5,
              "Two-sigma washout on no fundamental news; snap-back setup."
            ),
            sig("llm.value", 0.12, 30, "Sector cheap on normalized margins."),
          ],
          committee: { netView: 0.36, targetWeight: 4 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "buy",
            qty: 5_200,
            price: 92.31,
            session: "Next session · Jul 10",
          },
        },
        {
          security: "SPY",
          signals: [
            sig(
              "quant.mean-reversion",
              -0.33,
              3,
              "Stretched above the upper band into a thin session."
            ),
            sig("llm.value", -0.05, 30, "Index rich but declines to press."),
          ],
          committee: { netView: -0.25, targetWeight: -3.5 },
          gate: {
            kind: "clip",
            label: "Clipped -3.5% → -2% (gross exposure gate)",
          },
          fill: {
            side: "sell",
            qty: 1_100,
            price: 612.8,
            session: "Next session · Jul 10",
          },
        },
      ],
    },
    {
      date: "2026-07-10",
      securities: [
        {
          security: "XLK",
          signals: [
            sig(
              "quant.mean-reversion",
              0.19,
              5,
              "Mild oversold, but trend is up — small counter-trend clip."
            ),
            sig("llm.value", -0.08, 30, "Fully valued; low weight."),
          ],
          committee: { netView: 0.09, targetWeight: 1.2 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "buy",
            qty: 2_000,
            price: 258.4,
            session: "Next session · Jul 13",
          },
        },
      ],
    },
  ],
  "ose-energy": [
    {
      date: "2026-07-08",
      securities: [
        {
          security: "EQNR.OL",
          signals: [
            sig(
              "llm.macro",
              0.55,
              30,
              "Tightening Brent backwardation and resilient EU gas demand."
            ),
            sig(
              "quant.earnings-drift",
              0.29,
              20,
              "Positive revision drift after the trading update."
            ),
          ],
          committee: { netView: 0.42, targetWeight: 5.5 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "buy",
            qty: 14_000,
            price: 272.4,
            session: "Next session · Jul 9 (OSE)",
          },
        },
        {
          security: "AKRBP.OL",
          signals: [
            sig(
              "llm.macro",
              0.41,
              30,
              "High torque to Brent with a covered dividend."
            ),
            sig(
              "quant.earnings-drift",
              0.15,
              20,
              "Momentum positive but liquidity thinner."
            ),
          ],
          committee: { netView: 0.28, targetWeight: 3.8 },
          gate: {
            kind: "veto",
            label: "Vetoed — liquidity gate (order > 12% of 20-day ADV)",
          },
          fill: null,
        },
      ],
    },
    {
      date: "2026-07-09",
      securities: [
        {
          security: "VAR.OL",
          signals: [
            sig(
              "llm.macro",
              -0.24,
              20,
              "Cost inflation on the development book offsets price tailwind."
            ),
            sig(
              "quant.earnings-drift",
              -0.11,
              20,
              "Estimate revisions flat to lower."
            ),
          ],
          committee: { netView: -0.18, targetWeight: -2.2 },
          gate: { kind: "pass", label: "Within limits" },
          fill: {
            side: "sell",
            qty: 6_500,
            price: 41.9,
            session: "Next session · Jul 10 (OSE)",
          },
        },
      ],
    },
  ],
}

/** Look up a run by id, or `undefined` if it is not a fixture run. */
export function getRunById(id: string): DemoRun | undefined {
  return RUNS.find((r) => r.id === id)
}

/**
 * Assemble the full detail payload for a run: header run, its strategy (with
 * aggregates), realized metrics + equity curve for completed runs, and the
 * committee decision walkthrough for its strategy. Returns `undefined` for an
 * unknown id so the route can `notFound()`.
 */
export function getRunDetail(id: string): RunDetail | undefined {
  const run = getRunById(id)
  if (!run) return undefined

  const strategy =
    STRATEGIES_WITH_STATS.find((s) => s.id === run.strategy) ??
    ({
      ...(STRATEGY_BY_ID[run.strategy] ?? {
        id: run.strategy,
        name: run.strategy,
        version: "v1.0.0",
        description: "",
        universeLabel: "—",
        universeMic: "—",
        lineup: [],
      }),
      runCount: 0,
      bestSharpe: null,
      lastRunStatus: null,
    } satisfies StrategyWithStats)

  const isCompleted = run.status === "completed"
  const curve = isCompleted ? buildRunCurve(run) : []
  const metrics = isCompleted ? buildRunMetrics(run, curve) : null
  const decisions = isCompleted
    ? DECISIONS_BY_STRATEGY[run.strategy] ?? []
    : []

  // Seeded wall-clock duration (~40s–20min), so completedAt is stable per run.
  let durationSeconds: number | null = null
  let completedAt: string | null = null
  if (isCompleted) {
    const next = lcg(seedFromString(`${run.id}:duration`))
    durationSeconds = Math.round(40 + next() * 1_160)
    completedAt = new Date(
      new Date(run.createdAt).getTime() + durationSeconds * 1000
    ).toISOString()
  }

  return {
    run,
    strategy,
    metrics,
    equity: curve,
    decisions,
    completedAt,
    durationSeconds,
  }
}

/* ================================================================== */
/* Data layer — providers, point-in-time policy, coverage            */
/* ================================================================== */

export type CoverageState = "covered" | "covered-empty" | "not-covered" | "partial"

export type Provider = {
  name: string
  /** Short routing label, e.g. "US equities". */
  role: string
  description: string
  /** MIC codes routed to this provider. */
  mics: string[]
  datasets: string[]
}

export const PROVIDERS: Provider[] = [
  {
    name: "Financial Datasets",
    role: "US equities",
    description:
      "Prices, fundamentals, and analyst estimates for US-listed equities and ETFs.",
    mics: ["XNAS", "XNYS", "ARCX"],
    datasets: ["Prices", "Fundamentals", "Estimates", "Corporate actions"],
  },
  {
    name: "EODHD",
    role: "International + FX",
    description:
      "Oslo Børs, international exchanges, and FX. Routed whenever the MIC is outside the US venues.",
    mics: ["XOSL", "XAMS", "XETR", "FX"],
    datasets: ["Prices", "Fundamentals", "Corporate actions", "FX"],
  },
]

export type PitPolicyPoint = { title: string; body: string }

export const PIT_POLICY: PitPolicyPoint[] = [
  {
    title: "knownAt ≤ asOf",
    body: "A datapoint is only visible to a run once its knownAt timestamp is at or before the run's asOf. Nothing from the future leaks in.",
  },
  {
    title: "Date-only ⇒ next trading day",
    body: "A date-only stamp (no time) is treated as known at the next trading day's open, never intraday of the same session.",
  },
  {
    title: "No lookahead, ever",
    body: "Restatements and late-arriving fundamentals keep their original knownAt, so a backtest sees exactly what was knowable then.",
  },
]

export type CoverageRow = {
  ticker: string
  mic: string
  provider: string
  prices: CoverageState
  fundamentals: CoverageState
  estimates: CoverageState
}

export const COVERAGE: CoverageRow[] = [
  { ticker: "AAPL", mic: "XNAS", provider: "Financial Datasets", prices: "covered", fundamentals: "covered", estimates: "covered" },
  { ticker: "MSFT", mic: "XNAS", provider: "Financial Datasets", prices: "covered", fundamentals: "covered", estimates: "covered" },
  { ticker: "NVDA", mic: "XNAS", provider: "Financial Datasets", prices: "covered", fundamentals: "covered", estimates: "covered" },
  { ticker: "JPM", mic: "XNYS", provider: "Financial Datasets", prices: "covered", fundamentals: "covered", estimates: "covered" },
  { ticker: "XLE", mic: "ARCX", provider: "Financial Datasets", prices: "covered", fundamentals: "covered-empty", estimates: "not-covered" },
  { ticker: "SPY", mic: "ARCX", provider: "Financial Datasets", prices: "covered", fundamentals: "covered-empty", estimates: "not-covered" },
  { ticker: "EQNR.OL", mic: "XOSL", provider: "EODHD", prices: "covered", fundamentals: "covered", estimates: "covered-empty" },
  { ticker: "AKRBP.OL", mic: "XOSL", provider: "EODHD", prices: "covered", fundamentals: "covered", estimates: "covered-empty" },
  { ticker: "VAR.OL", mic: "XOSL", provider: "EODHD", prices: "covered", fundamentals: "covered-empty", estimates: "not-covered" },
  { ticker: "ASML.AS", mic: "XAMS", provider: "EODHD", prices: "covered", fundamentals: "covered", estimates: "covered" },
]

export type CorporateAction = {
  ticker: string
  mic: string
  type: "split" | "dividend"
  detail: string
  exDate: string
}

export const CORPORATE_ACTIONS: CorporateAction[] = [
  { ticker: "AAPL", mic: "XNAS", type: "split", detail: "4-for-1 forward split", exDate: "2026-06-09" },
  { ticker: "JPM", mic: "XNYS", type: "dividend", detail: "$1.40 quarterly cash dividend", exDate: "2026-07-05" },
  { ticker: "EQNR.OL", mic: "XOSL", type: "dividend", detail: "NOK 3.60 ordinary + extraordinary", exDate: "2026-06-27" },
]

/* ================================================================== */
/* UI REFRESH v2 fixtures                                             */
/* ================================================================== */

// Shared small unions
export type StageState = "complete" | "active" | "pending"
export type PipelineStage = { id: string; label: string; state: StageState; caption?: string; index?: number }
export type DecisionResult = "passed" | "clipped" | "vetoed"
export type StrategyTag = "fundamental" | "quant" | "macro" | "event"
export type ValueTone = "positive" | "negative" | "neutral" | "muted"

// KPI strip
export type Kpi = { label: string; value: string; delta?: { label: string; direction: "up" | "down" | "flat" }; tone?: ValueTone }

export const FUND_KPIS: Kpi[] = [
  { label: "NAV", value: "$10.42M" },
  { label: "Day P&L", value: "+$84.2K", delta: { label: "+0.81%", direction: "up" }, tone: "positive" },
  { label: "YTD", value: "+4.20%", tone: "positive" },
  { label: "Gross", value: "156.3%" },
  { label: "Net", value: "+38.6%", tone: "positive" },
  { label: "Cash", value: "9.9%" },
  { label: "Drawdown", value: "-4.2%", tone: "negative" },
]

export const DASHBOARD_KPIS: Kpi[] = [
  { label: "Portfolio equity", value: "$10.42M", delta: { label: "+4.2%", direction: "up" }, tone: "positive" },
  { label: "Net exposure", value: "+38.6%", tone: "positive" },
  { label: "Open positions", value: "34" },
  { label: "Risk utilization", value: "62%" },
]

// Positions & contribution (Fund monitor)
export type PositionSide = "long" | "short" | "cash"
export type Position = {
  security: string
  strategyTag: StrategyTag | null
  side: PositionSide
  marketValue: number
  marketValueLabel: string
  weightPct: number
  dayPnl: number
  dayPnlLabel: string
  contributionBp: number
  conviction: number | null
  riskFlag: boolean
}
export const POSITIONS: Position[] = [
  { security: "NVDA", strategyTag: "fundamental", side: "long", marketValue: 3_210_000, marketValueLabel: "$3.21M", weightPct: 30.8, dayPnl: 52_100, dayPnlLabel: "+$52.1K", contributionBp: 49, conviction: 0.62, riskFlag: false },
  { security: "AAPL", strategyTag: "quant", side: "long", marketValue: 2_250_000, marketValueLabel: "$2.25M", weightPct: 21.6, dayPnl: 22_700, dayPnlLabel: "+$22.7K", contributionBp: 21, conviction: 0.28, riskFlag: true },
  { security: "EQNR", strategyTag: "macro", side: "short", marketValue: -1_740_000, marketValueLabel: "-$1.74M", weightPct: 16.7, dayPnl: -8_300, dayPnlLabel: "-$8.3K", contributionBp: -8, conviction: -0.44, riskFlag: true },
  { security: "DNB", strategyTag: "event", side: "long", marketValue: 1_280_000, marketValueLabel: "$1.28M", weightPct: 12.3, dayPnl: 7_600, dayPnlLabel: "+$7.6K", contributionBp: 7, conviction: 0.15, riskFlag: false },
  { security: "MSFT", strategyTag: "fundamental", side: "long", marketValue: 1_050_000, marketValueLabel: "$1.05M", weightPct: 10.1, dayPnl: 6_300, dayPnlLabel: "+$6.3K", contributionBp: 6, conviction: 0.20, riskFlag: false },
  { security: "CASH", strategyTag: null, side: "cash", marketValue: 1_030_000, marketValueLabel: "$1.03M", weightPct: 9.9, dayPnl: 3_800, dayPnlLabel: "+$3.8K", contributionBp: 4, conviction: null, riskFlag: false },
]
export const POSITIONS_TOTALS = { gross: "156.3%", net: "38.6%", dayPnl: "+$84.2K" }

// Attribution
export type AttributionRow = { key: string; label: string; bp: number }
export const ATTRIBUTION_BY_STRATEGY: AttributionRow[] = [
  { key: "earnings-drift", label: "earnings-drift", bp: 32 },
  { key: "value-panel", label: "value-panel", bp: 21 },
  { key: "momentum-carry", label: "momentum-carry", bp: -9 },
  { key: "ose-energy", label: "ose-energy", bp: -4 },
]
export const ATTRIBUTION_BY_SECURITY: AttributionRow[] = [
  { key: "NVDA", label: "NVDA", bp: 49 },
  { key: "AAPL", label: "AAPL", bp: 21 },
  { key: "DNB", label: "DNB", bp: 7 },
  { key: "MSFT", label: "MSFT", bp: 6 },
  { key: "EQNR", label: "EQNR", bp: -8 },
]
export const ATTRIBUTION_TOTAL_BP = 40

// Risk limits (Fund monitor Risk card)
export type RiskLimit = { metric: string; limitLabel: string; currentLabel: string; utilizationPct: number; status: "ok" | "watch" | "breach" }
export const RISK_LIMITS: RiskLimit[] = [
  { metric: "Position", limitLabel: "80%", currentLabel: "71%", utilizationPct: 71, status: "ok" },
  { metric: "Gross", limitLabel: "160%", currentLabel: "98%", utilizationPct: 98, status: "ok" },
  { metric: "Volatility (30d)", limitLabel: "80%", currentLabel: "62%", utilizationPct: 62, status: "ok" },
  { metric: "Correlation", limitLabel: "90%", currentLabel: "86%", utilizationPct: 86, status: "watch" },
]
export const RISK_STRESS = { label: "Stress (Global Recession)", value: "-7.8%" }

// Attention feed (Fund monitor)
export type AttentionSeverity = "action" | "review" | "healthy"
export type AttentionItem = { id: string; severity: AttentionSeverity; title: string; subtitle?: string; scope: string; time: string }
export const ATTENTION_ITEMS: AttentionItem[] = [
  { id: "att_1", severity: "action", title: "Correlation limit watch (86% / 90% limit)", subtitle: "Global tech factor", scope: "Cross-portfolio", time: "14:27" },
  { id: "att_2", severity: "action", title: "Stale data coverage (Europe macro)", subtitle: "8 datasets > 24h", scope: "Macro", time: "13:58" },
  { id: "att_3", severity: "review", title: "Committee decision clipped by risk", subtitle: "Position size reduced", scope: "EQNR", time: "13:21" },
  { id: "att_4", severity: "review", title: "Committee decision clipped by risk", subtitle: "Position size reduced", scope: "AAPL", time: "12:47" },
]
export const ATTENTION_COUNTS = { action: 2, review: 2, healthy: 0 }

// Engine operations (Fund monitor)
export const ENGINE_OPS = {
  lastCycle: "Completed 14:18",
  running: 1,
  queued: 1,
  failed: 0,
  activeRun: { id: "run_8c41d0", stage: "Analysts", progressPct: 68 },
}

// Recent decisions (Dashboard + Fund monitor)
export type RecentDecision = { id: string; time: string; security: string; committeeView: string; target: string; gate: string; result: DecisionResult; note: string }
export const RECENT_DECISIONS: RecentDecision[] = [
  { id: "rd_1", time: "2025-05-15 14:18:07", security: "NVDA", committeeView: "Strong buy — upside to estimates; catalysts intact", target: "+2.75% (8.5% max)", gate: "Passed", result: "passed", note: "Earnings beat; AI demand inflection; backlog strength" },
  { id: "rd_2", time: "2025-05-15 13:52:31", security: "AAPL", committeeView: "Buy — services strength offsets macro softness", target: "+1.90% (6.0% max)", gate: "Passed", result: "passed", note: "Services mix expansion; wearables recovery" },
  { id: "rd_3", time: "2025-05-15 13:21:44", security: "EQNR", committeeView: "Hold — momentum fading; event risk ahead", target: "0.00% (4.0% max)", gate: "Clipped", result: "clipped", note: "Event risk (tax/permit); momentum rollover" },
  { id: "rd_4", time: "2025-05-15 12:47:16", security: "DNB", committeeView: "Reduce — credit spreads widening", target: "-1.20% (3.0% max)", gate: "Passed", result: "passed", note: "Spreads widening; NIM pressure" },
  { id: "rd_5", time: "2025-05-15 11:33:02", security: "MSFT", committeeView: "Buy — AI demand supports growth re-acceleration", target: "+2.10% (7.0% max)", gate: "Vetoed (Concentration)", result: "vetoed", note: "Concentration risk; factor crowding" },
]

// Active run (Dashboard)
export type ActiveRunAnalyst = { name: string; type: StrategyTag; focus: string; conviction: number; status: string }
export const ACTIVE_RUN = {
  id: "run_8c41d0",
  status: "running" as const,
  strategy: "earnings-drift",
  stages: [
    { id: "data", label: "Data", state: "complete", caption: "Complete", index: 1 },
    { id: "analysts", label: "Analysts", state: "active", caption: "Processing", index: 2 },
    { id: "committee", label: "Committee", state: "pending", caption: "Pending", index: 3 },
    { id: "risk", label: "Risk", state: "pending", caption: "Pending", index: 4 },
    { id: "fills", label: "Fills", state: "pending", caption: "Pending", index: 5 },
  ] as PipelineStage[],
  analysts: [
    { name: "Erik Lund", type: "fundamental", focus: "NVDA", conviction: 0.72, status: "Analyzing" },
    { name: "Maria Skogli", type: "quant", focus: "AAPL", conviction: 0.35, status: "Reviewing" },
    { name: "Jonas Bakke", type: "macro", focus: "EQNR", conviction: -0.28, status: "Analyzing" },
    { name: "Thea Nilsen", type: "event", focus: "DNB", conviction: 0.15, status: "Gathering data" },
  ] as ActiveRunAnalyst[],
}

// Risk snapshot + allocation (Dashboard)
export type RiskCheck = { label: string; status: "passed" | "watch" | "failed" }
export const RISK_SNAPSHOT = {
  metrics: [
    { label: "Gross exposure", value: "156.3%", tone: "neutral" as ValueTone },
    { label: "Max position", value: "8.7%", tone: "neutral" as ValueTone },
    { label: "Drawdown (YTD)", value: "-4.2%", tone: "negative" as ValueTone },
    { label: "Volatility budget (30d)", value: "12.4% / 20.0%", tone: "neutral" as ValueTone },
  ],
  checks: [
    { label: "Concentration (Top 5 < 40%)", status: "passed" },
    { label: "Gross exposure (< 160%)", status: "passed" },
    { label: "Correlation (Avg. > 0.60)", status: "watch" },
  ] as RiskCheck[],
}
export type AllocationRow = { label: string; pct: number; tone?: ValueTone }
export const ALLOCATION: AllocationRow[] = [
  { label: "US equities", pct: 68.5 },
  { label: "Oslo equities", pct: 21.6 },
  { label: "Cash", pct: 9.9, tone: "muted" },
]

// Runs page — richer history + summary + inspector
export type RunUniverse = "US Equities" | "Global Equities"
export type RunHistoryRow = {
  id: string
  strategy: string
  mode: RunMode
  status: RunStatus
  progressPct: number | null
  universe: RunUniverse
  startedAt: string
  durationLabel: string | null
  sharpe: number | null
  returnPct: number | null
}
export const RUN_HISTORY: RunHistoryRow[] = [
  { id: "run_8c41d0", strategy: "earnings-drift", mode: "paper", status: "running", progressPct: 68, universe: "US Equities", startedAt: "2025-05-15 14:18:07", durationLabel: "00:12:41", sharpe: 1.21, returnPct: 1.82 },
  { id: "run_8c41cf", strategy: "value-panel", mode: "backtest", status: "completed", progressPct: 100, universe: "US Equities", startedAt: "2025-05-15 13:52:31", durationLabel: "02:43:19", sharpe: 1.37, returnPct: 6.52 },
  { id: "run_8c41ce", strategy: "momentum-carry", mode: "backtest", status: "completed", progressPct: 100, universe: "US Equities", startedAt: "2025-05-15 13:21:44", durationLabel: "01:58:02", sharpe: 1.05, returnPct: 4.18 },
  { id: "run_8c41cd", strategy: "mean-reversion-etf", mode: "paper", status: "queued", progressPct: null, universe: "US Equities", startedAt: "2025-05-15 13:05:12", durationLabel: null, sharpe: null, returnPct: null },
  { id: "run_8c41cb", strategy: "momentum-carry", mode: "paper", status: "failed", progressPct: null, universe: "US Equities", startedAt: "2025-05-15 12:47:16", durationLabel: "00:03:22", sharpe: null, returnPct: null },
  { id: "run_8c41ca", strategy: "earnings-drift", mode: "backtest", status: "completed", progressPct: 100, universe: "US Equities", startedAt: "2025-05-15 11:33:02", durationLabel: "02:10:58", sharpe: 0.98, returnPct: 3.29 },
  { id: "run_8c41c9", strategy: "mean-reversion-etf", mode: "paper", status: "completed", progressPct: 100, universe: "US Equities", startedAt: "2025-05-15 10:15:39", durationLabel: "01:42:11", sharpe: 0.87, returnPct: 2.41 },
  { id: "run_8c41c8", strategy: "value-panel", mode: "backtest", status: "completed", progressPct: 100, universe: "US Equities", startedAt: "2025-05-15 09:03:27", durationLabel: "01:35:44", sharpe: 0.76, returnPct: 1.63 },
  { id: "run_8c41c7", strategy: "momentum-carry", mode: "paper", status: "failed", progressPct: null, universe: "US Equities", startedAt: "2025-05-14 18:41:10", durationLabel: "00:02:48", sharpe: null, returnPct: null },
  { id: "run_8c41c6", strategy: "ose-energy", mode: "backtest", status: "completed", progressPct: 100, universe: "Global Equities", startedAt: "2025-05-14 16:22:05", durationLabel: "03:18:59", sharpe: 1.12, returnPct: 5.74 },
]
export const RUN_HISTORY_TOTAL = 48
export const RUNS_SUMMARY = {
  running: { count: 2, latest: { id: "run_8c41d0", strategy: "earnings-drift", progressPct: 68 } },
  queued: { count: 1, latest: { id: "run_8c41cd", strategy: "mean-reversion-etf", note: "waiting" } },
  failed: { count: 1, latest: { id: "run_8c41cb", strategy: "momentum-carry", note: "error" } },
}
export type RunInspector = {
  id: string
  status: RunStatus
  strategy: string
  mode: RunMode
  universe: RunUniverse
  startedAt: string
  durationLabel: string | null
  progressPct: number | null
  sharpe: number | null
  returnPct: number | null
  stages: PipelineStage[]
  lastEvent: { label: string; time: string }
}
export const RUN_INSPECTOR: RunInspector = {
  id: "run_8c41d0",
  status: "running",
  strategy: "earnings-drift",
  mode: "paper",
  universe: "US Equities",
  startedAt: "2025-05-15 14:18:07 UTC",
  durationLabel: "00:12:41",
  progressPct: 68,
  sharpe: null,
  returnPct: null,
  stages: [
    { id: "data", label: "Data", state: "complete", index: 1 },
    { id: "analysts", label: "Analysts", state: "active", caption: "Processing", index: 2 },
    { id: "committee", label: "Committee", state: "pending", caption: "Pending", index: 3 },
    { id: "risk", label: "Risk", state: "pending", caption: "Pending", index: 4 },
    { id: "fills", label: "Fills", state: "pending", caption: "Pending", index: 5 },
  ],
  lastEvent: { label: "Analyst model evaluation started", time: "2025-05-15 14:18:08 UTC" },
}

// Run detail (run-detail.png) — evidence, decision log, selected trace. The run
// header, stage rail, and KPI strip are derived per-run from getRunDetail() in
// run-detail-view.tsx, so no static header fixture lives here.
export type RunEvidenceComponent = { component: string; version: string; verified: boolean }
export const RUN_EVIDENCE: RunEvidenceComponent[] = [
  { component: "Data snapshot", version: "ds_9a7e52b1", verified: true },
  { component: "Analyst prompt", version: "prompt_v7f4a2c1", verified: true },
  { component: "Model", version: "model_v2.14.0", verified: true },
  { component: "Risk policy", version: "risk_v1.8.2", verified: true },
  { component: "Execution assumptions", version: "exec_v1.5.1", verified: true },
]
export type DecisionLogRow = {
  id: string
  date: string
  time: string
  ticker: string
  agreement: number[]
  committeeView: number
  targetWeight: number
  riskGate: DecisionResult
  nextSessionFill: string
  decisionId: string
}
export const DECISION_LOG: DecisionLogRow[] = [
  { id: "dl_1", date: "2025-05-15", time: "13:52:31", ticker: "NVDA", agreement: [0.82, 0.61, 0.2, -0.14], committeeView: 0.53, targetWeight: 6.00, riskGate: "clipped", nextSessionFill: "BUY 412 @ $184.20", decisionId: "dec_c12f8b7a" },
  { id: "dl_2", date: "2025-05-15", time: "13:52:31", ticker: "AAPL", agreement: [0.6, 0.4, 0.15, -0.5], committeeView: 0.41, targetWeight: 5.50, riskGate: "passed", nextSessionFill: "BUY 286 @ $189.44", decisionId: "dec_e88a3d21" },
  { id: "dl_3", date: "2025-05-15", time: "13:52:31", ticker: "EQNR", agreement: [0.5, 0.3, 0.1, -0.2], committeeView: 0.22, targetWeight: 4.00, riskGate: "passed", nextSessionFill: "BUY 530 @ $210.77", decisionId: "dec_6b7d1e54" },
  { id: "dl_4", date: "2025-05-15", time: "13:52:31", ticker: "DNB", agreement: [-0.3, -0.1, 0.1, -0.2], committeeView: -0.08, targetWeight: 0.00, riskGate: "passed", nextSessionFill: "No trade", decisionId: "dec_b91e4c33" },
  { id: "dl_5", date: "2025-05-14", time: "16:22:05", ticker: "NVDA", agreement: [0.85, 0.6, 0.3, -0.1], committeeView: 0.61, targetWeight: 8.50, riskGate: "clipped", nextSessionFill: "BUY 430 @ $178.11", decisionId: "dec_4e7f9b12" },
  { id: "dl_6", date: "2025-05-14", time: "16:22:05", ticker: "AAPL", agreement: [0.55, 0.4, 0.2, -0.3], committeeView: 0.38, targetWeight: 5.00, riskGate: "passed", nextSessionFill: "BUY 255 @ $183.02", decisionId: "dec_2d4a6c88" },
  { id: "dl_7", date: "2025-05-14", time: "16:22:05", ticker: "EQNR", agreement: [0.45, 0.25, 0.1, -0.2], committeeView: 0.19, targetWeight: 3.00, riskGate: "passed", nextSessionFill: "BUY 480 @ $204.33", decisionId: "dec_8c1e2b77" },
  { id: "dl_8", date: "2025-05-14", time: "16:22:05", ticker: "DNB", agreement: [-0.4, -0.2, 0.05, -0.1], committeeView: -0.05, targetWeight: 0.00, riskGate: "passed", nextSessionFill: "No trade", decisionId: "dec_a9b0d1aa" },
]
export type DecisionTraceSignal = { name: string; value: number; thesis: string }
export type DecisionTraceStage = {
  index: number
  title: string
  value?: string
  meta?: string
  status: string
  tone: ValueTone | "warning"
  signals?: DecisionTraceSignal[]
  agreement?: number[]
  target?: string
}
export type DecisionTrace = {
  id: string
  ticker: string
  timestamp: string
  stages: DecisionTraceStage[]
}
// Per-ticker narrative for a decision trace: the three committee signal theses
// (Value / Earnings drift / Macro) and the one-line committee summary.
const DECISION_NOTES: Record<
  string,
  { signals: [string, string, string]; committee: string }
> = {
  NVDA: {
    signals: [
      "Undervalued vs peers; robust FCF and margin expansion.",
      "Upward estimate revisions; improving guidance quality.",
      "Rate pressure on multiples; growth slowdown risk.",
    ],
    committee: "Strong buy — upside to estimates; catalysts intact.",
  },
  AAPL: {
    signals: [
      "Trades near fair value with a durable services mix.",
      "Steady positive revisions after the print.",
      "Consumer softness is a modest headwind.",
    ],
    committee: "Buy — services strength offsets macro softness.",
  },
  EQNR: {
    signals: [
      "Cash returns and buyback underpin the valuation.",
      "Positive revisions on firmer Brent.",
      "Energy tailwind from tighter supply.",
    ],
    committee: "Buy — cash returns and a supportive macro backdrop.",
  },
  DNB: {
    signals: [
      "Cheap on book, but the credit cycle is turning.",
      "Estimate revisions flat to lower.",
      "Rate-sensitive; spreads widening.",
    ],
    committee: "Reduce — credit spreads widening; hold flat this cycle.",
  },
}

function signedTrace(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`
}

/** Next calendar day of an ISO date (YYYY-MM-DD), pure and deterministic. */
function nextTradingDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Derive a full decision trace from a decision-log row, so the trace body can
// never disagree with the row's header (ticker, committee view, risk gate,
// target weight, fill). A Clipped row shows a Clipped risk gate with matching
// target weights; a "No trade" row shows no fill.
function buildDecisionTrace(row: DecisionLogRow): DecisionTrace {
  const notes = DECISION_NOTES[row.ticker] ?? {
    signals: ["—", "—", "—"] as [string, string, string],
    committee: "Committee view recorded.",
  }
  const [aValue = 0, aDrift = 0, , aMacro = 0] = row.agreement
  const bullish = row.committeeView >= 0.15
  const noTrade = row.nextSessionFill === "No trade"

  const gate: DecisionTraceStage =
    row.riskGate === "clipped"
      ? {
          index: 4,
          title: "Risk gate",
          value: "Clipped",
          meta: "Concentration limit: gross exposure would exceed the single-name cap.",
          target: `${(row.targetWeight + 2.5).toFixed(2)}% → ${row.targetWeight.toFixed(2)}%`,
          status: "Clipped",
          tone: "warning",
        }
      : noTrade
        ? {
            index: 4,
            title: "Risk gate",
            value: "No position",
            meta: "Committee view below the entry threshold.",
            status: "Passed",
            tone: "muted",
          }
        : {
            index: 4,
            title: "Risk gate",
            value: "Passed",
            meta: "Within concentration and gross-exposure limits.",
            target: `${row.targetWeight.toFixed(2)}%`,
            status: "Passed",
            tone: "positive",
          }

  const execution: DecisionTraceStage = noTrade
    ? {
        index: 5,
        title: "Execution (next session)",
        value: "No trade",
        meta: "No order — target weight is flat.",
        status: "No fill",
        tone: "muted",
      }
    : {
        index: 5,
        title: "Execution (next session)",
        value: row.nextSessionFill,
        meta: `Next-session open (${nextTradingDay(row.date)})`,
        status: "Executed",
        tone: "positive",
      }

  return {
    id: row.decisionId,
    ticker: row.ticker,
    timestamp: `${row.date} ${row.time} UTC`,
    stages: [
      {
        index: 1,
        title: "Data snapshot",
        value: "ds_9a7e52b1",
        meta: `Known-at cutoff: ${row.date} 13:50:00 UTC`,
        status: "Verified",
        tone: "positive",
      },
      {
        index: 2,
        title: "Analyst signals",
        meta: "value-panel@v3.2.1",
        status: "",
        tone: "neutral",
        signals: [
          { name: "Value", value: aValue, thesis: notes.signals[0] },
          { name: "Earnings drift", value: aDrift, thesis: notes.signals[1] },
          { name: "Macro", value: aMacro, thesis: notes.signals[2] },
        ],
        agreement: row.agreement,
      },
      {
        index: 3,
        title: "Committee net view",
        value: signedTrace(row.committeeView),
        meta: notes.committee,
        status: bullish ? "Approved" : "Held flat",
        tone: bullish ? "positive" : "muted",
      },
      gate,
      execution,
    ],
  }
}

/** Decision trace per decision id, derived from and consistent with DECISION_LOG. */
export const DECISION_TRACES: Record<string, DecisionTrace> = Object.fromEntries(
  DECISION_LOG.map((row) => [row.decisionId, buildDecisionTrace(row)])
)

/** The trace for a decision id, falling back to the first decision. */
export function getDecisionTrace(decisionId: string): DecisionTrace {
  return DECISION_TRACES[decisionId] ?? buildDecisionTrace(DECISION_LOG[0]!)
}

// Strategies page (strategies.png)
export type StrategyReadiness = "paper-ready" | "live" | "draft" | "archived"
export type StrategyRegistryRow = { id: string; name: string; version: string; readiness: StrategyReadiness; lastValidated: string; sharpe12m: number }
export const STRATEGY_REGISTRY: StrategyRegistryRow[] = [
  { id: "value-panel", name: "value-panel", version: "v3.2.1", readiness: "paper-ready", lastValidated: "2025-05-15", sharpe12m: 1.37 },
  { id: "earnings-drift", name: "earnings-drift", version: "v2.4.0", readiness: "live", lastValidated: "2025-05-15", sharpe12m: 1.21 },
  { id: "momentum-carry", name: "momentum-carry", version: "v1.8.3", readiness: "draft", lastValidated: "2025-05-12", sharpe12m: 0.98 },
  { id: "ose-energy", name: "ose-energy", version: "v1.1.0", readiness: "draft", lastValidated: "2025-05-09", sharpe12m: 0.72 },
  { id: "mean-reversion", name: "mean-reversion", version: "v2.0.2", readiness: "paper-ready", lastValidated: "2025-05-08", sharpe12m: 0.76 },
]
export const STRATEGY_TABS = { active: 4, draft: 2, archived: 1 }
export type StrategyBuildStage = { stage: string; title: string; caption: string; version: string }
export type PanelSeat = { signal: string; weight: number; notes: string }
export type PromotionGate = { gate: string; criteria: string; status: DecisionResult | "blocked"; details: string }
export type StrategyDetail = {
  id: string
  version: string
  readiness: StrategyReadiness
  description: string
  stages: StrategyBuildStage[]
  decisionSystem: {
    panel: PanelSeat[]
    universe: { coverage: string; markets: string; baseCurrency: string }
    construction: { mode: string; weighting: string; rebalance: string }
    risk: { maxPosition: string; grossExposureLimit: string; volatilityTarget: string }
  }
  promotionEvidence: PromotionGate[]
  nextRequirement: string
  versionHistory: string[]
}

/**
 * Per-strategy detail, keyed by the registry id the Strategies page selects on.
 * Each entry stays consistent with its STRATEGY_REGISTRY row (version, readiness,
 * 12-month Sharpe) so the inspector body never contradicts the selected row.
 */
export const STRATEGY_DETAILS: Record<string, StrategyDetail> = {
  "value-panel": {
    id: "value-panel",
    version: "v3.2.1",
    readiness: "paper-ready",
    description: "Blends valuation, earnings drift, and macro context across US and Oslo equities.",
    stages: [
      { stage: "Stage 1", title: "Panel", caption: "4 signals", version: "v3.2.1" },
      { stage: "Stage 2", title: "Universe", caption: "42 securities", version: "v3.1.0" },
      { stage: "Stage 3", title: "Construction", caption: "Long-only, weekly", version: "v2.7.0" },
      { stage: "Stage 4", title: "Risk", caption: "Vol target 12%", version: "v2.4.0" },
      { stage: "Stage 5", title: "Promotion", caption: "Backtest passed", version: "v1.3.0" },
    ],
    decisionSystem: {
      panel: [
        { signal: "Value LLM", weight: 0.35, notes: "Cross-sectional value score" },
        { signal: "Earnings drift", weight: 0.40, notes: "Surprise & revisions momentum" },
        { signal: "Quality quant", weight: 0.15, notes: "ROIC, leverage, accruals" },
        { signal: "Macro context", weight: 0.10, notes: "Rates, growth, liquidity regime" },
      ],
      universe: { coverage: "42 securities", markets: "XNAS, XNYS, XOSL", baseCurrency: "USD" },
      construction: { mode: "Long-only", weighting: "Conviction weighted", rebalance: "Weekly (Friday close)" },
      risk: { maxPosition: "8.5%", grossExposureLimit: "160%", volatilityTarget: "12%" },
    },
    promotionEvidence: [
      { gate: "Backtest", criteria: "Sharpe ≥ 0.80", status: "passed", details: "1.37" },
      { gate: "Walk-forward", criteria: "OOS Sharpe ≥ 0.60", status: "passed", details: "0.98" },
      { gate: "Paper observation", criteria: "Min 30 days", status: "passed", details: "43 / 60 days" },
      { gate: "Live", criteria: "Live risk review", status: "blocked", details: "Risk review pending" },
    ],
    nextRequirement: "Complete live risk review to enable launch.",
    versionHistory: ["v3.2.1", "v3.2.0", "v3.1.0", "v3.0.0"],
  },
  "earnings-drift": {
    id: "earnings-drift",
    version: "v2.4.0",
    readiness: "live",
    description: "Post-earnings drift on US large-cap technology, held through the reaction window.",
    stages: [
      { stage: "Stage 1", title: "Panel", caption: "4 signals", version: "v2.4.0" },
      { stage: "Stage 2", title: "Universe", caption: "38 securities", version: "v2.2.0" },
      { stage: "Stage 3", title: "Construction", caption: "Long/short, event-driven", version: "v2.1.0" },
      { stage: "Stage 4", title: "Risk", caption: "Vol target 10%", version: "v2.0.0" },
      { stage: "Stage 5", title: "Promotion", caption: "Live", version: "v1.6.0" },
    ],
    decisionSystem: {
      panel: [
        { signal: "Earnings drift", weight: 0.50, notes: "Standardized surprise & drift window" },
        { signal: "Value LLM", weight: 0.25, notes: "Guards against expensive beats" },
        { signal: "Quality quant", weight: 0.15, notes: "Accrual quality, balance-sheet strength" },
        { signal: "Macro context", weight: 0.10, notes: "Rates & risk-appetite regime" },
      ],
      universe: { coverage: "38 securities", markets: "XNAS", baseCurrency: "USD" },
      construction: { mode: "Long/short", weighting: "Surprise weighted", rebalance: "Event-driven (per print)" },
      risk: { maxPosition: "6.0%", grossExposureLimit: "150%", volatilityTarget: "10%" },
    },
    promotionEvidence: [
      { gate: "Backtest", criteria: "Sharpe ≥ 0.80", status: "passed", details: "1.21" },
      { gate: "Walk-forward", criteria: "OOS Sharpe ≥ 0.60", status: "passed", details: "1.02" },
      { gate: "Paper observation", criteria: "Min 30 days", status: "passed", details: "60 / 60 days" },
      { gate: "Live", criteria: "Live risk review", status: "passed", details: "Approved 2025-05-01" },
    ],
    nextRequirement: "Live and trading — next walk-forward refresh due 2025-06-15.",
    versionHistory: ["v2.4.0", "v2.3.0", "v2.2.1", "v2.1.0"],
  },
  "momentum-carry": {
    id: "momentum-carry",
    version: "v1.8.3",
    readiness: "draft",
    description: "Cross-sectional momentum with a carry tilt across US and international large caps.",
    stages: [
      { stage: "Stage 1", title: "Panel", caption: "4 signals", version: "v1.8.3" },
      { stage: "Stage 2", title: "Universe", caption: "120 securities", version: "v1.6.0" },
      { stage: "Stage 3", title: "Construction", caption: "Long/short, monthly", version: "v1.4.0" },
      { stage: "Stage 4", title: "Risk", caption: "Vol target 14%", version: "v1.3.0" },
      { stage: "Stage 5", title: "Promotion", caption: "Draft", version: "v1.0.0" },
    ],
    decisionSystem: {
      panel: [
        { signal: "Momentum", weight: 0.45, notes: "12-1 cross-sectional momentum" },
        { signal: "Earnings drift", weight: 0.25, notes: "Revisions confirm the trend" },
        { signal: "Macro context", weight: 0.20, notes: "Carry & risk-regime tilt" },
        { signal: "Quality quant", weight: 0.10, notes: "Down-weights junk rallies" },
      ],
      universe: { coverage: "120 securities", markets: "XNAS, XNYS, XETR", baseCurrency: "USD" },
      construction: { mode: "Long/short", weighting: "Rank weighted", rebalance: "Monthly (month-end)" },
      risk: { maxPosition: "5.0%", grossExposureLimit: "200%", volatilityTarget: "14%" },
    },
    promotionEvidence: [
      { gate: "Backtest", criteria: "Sharpe ≥ 0.80", status: "passed", details: "0.98" },
      { gate: "Walk-forward", criteria: "OOS Sharpe ≥ 0.60", status: "passed", details: "0.71" },
      { gate: "Paper observation", criteria: "Min 30 days", status: "blocked", details: "0 / 30 days" },
      { gate: "Live", criteria: "Live risk review", status: "blocked", details: "Not started" },
    ],
    nextRequirement: "Start a 30-day paper observation before promotion.",
    versionHistory: ["v1.8.3", "v1.8.2", "v1.8.0", "v1.7.0"],
  },
  "ose-energy": {
    id: "ose-energy",
    version: "v1.1.0",
    readiness: "draft",
    description: "Macro-driven long/short on Oslo Børs energy names, routed through point-in-time data.",
    stages: [
      { stage: "Stage 1", title: "Panel", caption: "4 signals", version: "v1.1.0" },
      { stage: "Stage 2", title: "Universe", caption: "14 securities", version: "v1.0.2" },
      { stage: "Stage 3", title: "Construction", caption: "Long/short, weekly", version: "v1.0.1" },
      { stage: "Stage 4", title: "Risk", caption: "Vol target 16%", version: "v1.0.0" },
      { stage: "Stage 5", title: "Promotion", caption: "Draft", version: "v1.0.0" },
    ],
    decisionSystem: {
      panel: [
        { signal: "Macro context", weight: 0.45, notes: "Brent term structure & gas demand" },
        { signal: "Value LLM", weight: 0.25, notes: "Reserve-based valuation" },
        { signal: "Earnings drift", weight: 0.20, notes: "Trading-update revisions" },
        { signal: "Sentiment", weight: 0.10, notes: "News & filing tone" },
      ],
      universe: { coverage: "14 securities", markets: "XOSL", baseCurrency: "NOK" },
      construction: { mode: "Long/short", weighting: "Conviction weighted", rebalance: "Weekly (Friday close)" },
      risk: { maxPosition: "10.0%", grossExposureLimit: "140%", volatilityTarget: "16%" },
    },
    promotionEvidence: [
      { gate: "Backtest", criteria: "Sharpe ≥ 0.80", status: "passed", details: "0.72" },
      { gate: "Walk-forward", criteria: "OOS Sharpe ≥ 0.60", status: "blocked", details: "0.44 (below bar)" },
      { gate: "Paper observation", criteria: "Min 30 days", status: "blocked", details: "Not started" },
      { gate: "Live", criteria: "Live risk review", status: "blocked", details: "Not started" },
    ],
    nextRequirement: "Improve out-of-sample Sharpe above 0.60 to clear walk-forward.",
    versionHistory: ["v1.1.0", "v1.0.2", "v1.0.0"],
  },
  "mean-reversion": {
    id: "mean-reversion",
    version: "v2.0.2",
    readiness: "paper-ready",
    description: "Short-horizon mean reversion on liquid US sector and index ETFs, vol-scaled.",
    stages: [
      { stage: "Stage 1", title: "Panel", caption: "4 signals", version: "v2.0.2" },
      { stage: "Stage 2", title: "Universe", caption: "24 securities", version: "v1.9.0" },
      { stage: "Stage 3", title: "Construction", caption: "Long/short, daily", version: "v1.8.0" },
      { stage: "Stage 4", title: "Risk", caption: "Vol target 11%", version: "v1.7.0" },
      { stage: "Stage 5", title: "Promotion", caption: "Backtest passed", version: "v1.2.0" },
    ],
    decisionSystem: {
      panel: [
        { signal: "Mean reversion", weight: 0.55, notes: "Band dislocation, vol-scaled" },
        { signal: "Quality quant", weight: 0.20, notes: "Liquidity & spread filter" },
        { signal: "Value LLM", weight: 0.15, notes: "Anchors against value trap" },
        { signal: "Sentiment", weight: 0.10, notes: "Fades headline-driven spikes" },
      ],
      universe: { coverage: "24 securities", markets: "ARCX", baseCurrency: "USD" },
      construction: { mode: "Long/short", weighting: "Inverse-vol weighted", rebalance: "Daily (close)" },
      risk: { maxPosition: "4.0%", grossExposureLimit: "180%", volatilityTarget: "11%" },
    },
    promotionEvidence: [
      { gate: "Backtest", criteria: "Sharpe ≥ 0.80", status: "passed", details: "0.76" },
      { gate: "Walk-forward", criteria: "OOS Sharpe ≥ 0.60", status: "passed", details: "0.63" },
      { gate: "Paper observation", criteria: "Min 30 days", status: "passed", details: "31 / 60 days" },
      { gate: "Live", criteria: "Live risk review", status: "blocked", details: "Risk review pending" },
    ],
    nextRequirement: "Complete live risk review to enable launch.",
    versionHistory: ["v2.0.2", "v2.0.1", "v2.0.0", "v1.9.0"],
  },
}

/** The strategy detail for a registry id, falling back to the flagship panel. */
export function getStrategyDetail(id: string): StrategyDetail {
  return STRATEGY_DETAILS[id] ?? STRATEGY_DETAILS["value-panel"]!
}

export type ValidationHistoryRow = { run: string; period: string; snapshot: string; sharpe: number; maxDrawdown: string; gate: string; result: DecisionResult }

/** Per-strategy validation history, keyed by registry id. */
export const VALIDATION_HISTORY_BY_STRATEGY: Record<string, ValidationHistoryRow[]> = {
  "value-panel": [
    { run: "run_8c41cf", period: "2025-02-15 → 2025-05-15 (OOS)", snapshot: "snapshot_2025-05-15_1200", sharpe: 1.37, maxDrawdown: "-8.4%", gate: "Backtest", result: "passed" },
    { run: "run_8c41c8", period: "2024-11-15 → 2025-02-14 (OOS)", snapshot: "snapshot_2025-02-14_1200", sharpe: 0.98, maxDrawdown: "-9.1%", gate: "Walk-forward", result: "passed" },
    { run: "run_8c41be", period: "2024-08-15 → 2024-11-14 (OOS)", snapshot: "snapshot_2024-11-14_1200", sharpe: 1.05, maxDrawdown: "-7.6%", gate: "Walk-forward", result: "passed" },
    { run: "run_8c41c3", period: "2024-05-15 → 2024-08-14 (OOS)", snapshot: "snapshot_2024-08-14_1200", sharpe: 0.87, maxDrawdown: "-10.2%", gate: "Walk-forward", result: "passed" },
  ],
  "earnings-drift": [
    { run: "run_8c41ca", period: "2025-02-15 → 2025-05-15 (OOS)", snapshot: "snapshot_2025-05-15_1200", sharpe: 1.21, maxDrawdown: "-6.9%", gate: "Backtest", result: "passed" },
    { run: "run_8c41c5", period: "2024-11-15 → 2025-02-14 (OOS)", snapshot: "snapshot_2025-02-14_1200", sharpe: 1.02, maxDrawdown: "-7.4%", gate: "Walk-forward", result: "passed" },
    { run: "run_8c41c0", period: "2024-08-15 → 2024-11-14 (OOS)", snapshot: "snapshot_2024-11-14_1200", sharpe: 0.94, maxDrawdown: "-8.1%", gate: "Walk-forward", result: "passed" },
    { run: "run_8c41bb", period: "2024-05-15 → 2024-08-14 (OOS)", snapshot: "snapshot_2024-08-14_1200", sharpe: 1.10, maxDrawdown: "-6.2%", gate: "Live", result: "passed" },
  ],
  "momentum-carry": [
    { run: "run_8c41ce", period: "2025-02-15 → 2025-05-15 (OOS)", snapshot: "snapshot_2025-05-15_1200", sharpe: 0.98, maxDrawdown: "-11.3%", gate: "Backtest", result: "passed" },
    { run: "run_8c41c2", period: "2024-11-15 → 2025-02-14 (OOS)", snapshot: "snapshot_2025-02-14_1200", sharpe: 0.71, maxDrawdown: "-13.0%", gate: "Walk-forward", result: "passed" },
    { run: "run_8c41b8", period: "2024-08-15 → 2024-11-14 (OOS)", snapshot: "snapshot_2024-11-14_1200", sharpe: 0.58, maxDrawdown: "-14.7%", gate: "Walk-forward", result: "clipped" },
  ],
  "ose-energy": [
    { run: "run_8c41cc", period: "2025-02-15 → 2025-05-15 (OOS)", snapshot: "snapshot_2025-05-15_1200", sharpe: 0.72, maxDrawdown: "-12.6%", gate: "Backtest", result: "passed" },
    { run: "run_8c41c1", period: "2024-11-15 → 2025-02-14 (OOS)", snapshot: "snapshot_2025-02-14_1200", sharpe: 0.44, maxDrawdown: "-15.9%", gate: "Walk-forward", result: "vetoed" },
    { run: "run_8c41bc", period: "2024-08-15 → 2024-11-14 (OOS)", snapshot: "snapshot_2024-11-14_1200", sharpe: 0.61, maxDrawdown: "-13.4%", gate: "Walk-forward", result: "passed" },
  ],
  "mean-reversion": [
    { run: "run_8c41c9", period: "2025-02-15 → 2025-05-15 (OOS)", snapshot: "snapshot_2025-05-15_1200", sharpe: 0.76, maxDrawdown: "-5.8%", gate: "Backtest", result: "passed" },
    { run: "run_8c41ba", period: "2024-11-15 → 2025-02-14 (OOS)", snapshot: "snapshot_2025-02-14_1200", sharpe: 0.63, maxDrawdown: "-6.4%", gate: "Walk-forward", result: "passed" },
    { run: "run_8c41c4", period: "2024-08-15 → 2024-11-14 (OOS)", snapshot: "snapshot_2024-11-14_1200", sharpe: 0.69, maxDrawdown: "-6.0%", gate: "Walk-forward", result: "passed" },
  ],
}

/** The validation history for a registry id, falling back to an empty list. */
export function getValidationHistory(id: string): ValidationHistoryRow[] {
  return VALIDATION_HISTORY_BY_STRATEGY[id] ?? []
}

// Analysts page (analysts.png)
export type AnalystHealth = "healthy" | "degraded"
export type AnalystRegistryRow = { id: string; name: string; kind: AnalystKind; version: string; health: AnalystHealth; ic90d: number; abstainPct: number }
export const ANALYST_REGISTRY: AnalystRegistryRow[] = [
  { id: "earnings-drift", name: "Earnings drift", kind: "quant", version: "v2.4.0", health: "healthy", ic90d: 0.112, abstainPct: 6.2 },
  { id: "value", name: "Value", kind: "llm", version: "v3.2.1", health: "healthy", ic90d: 0.083, abstainPct: 8.4 },
  { id: "quality", name: "Quality", kind: "quant", version: "v1.6.0", health: "healthy", ic90d: 0.067, abstainPct: 5.1 },
  { id: "macro-context", name: "Macro context", kind: "llm", version: "v2.1.0", health: "degraded", ic90d: 0.028, abstainPct: 22.3 },
  { id: "insider-activity", name: "Insider activity", kind: "quant", version: "v1.3.2", health: "healthy", ic90d: 0.041, abstainPct: 10.7 },
  { id: "sentiment", name: "Sentiment", kind: "llm", version: "v1.8.0", health: "healthy", ic90d: 0.055, abstainPct: 12.6 },
]
export const ANALYST_TABS = { active: 6, degraded: 1, abstentionRate: "8.4%", signalsThisMonth: 1_284 }
export type OperationalHealthRow = { label: string; value: string; status: "verified" | "healthy" | "attention" }
export type AnalystDetail = {
  id: string
  name: string
  handle: string
  version: string
  kind: AnalystKind
  health: AnalystHealth
  description: string
  io: { input: string; method: string; output: string; failure: string }
  behavior: { ic: string; hitRate: string; avgConviction: string; coverage: string }
  // Avg outcome (realized return, %) by conviction decile 1 (Low) .. 10 (High)
  behaviorDeciles: number[]
  operational: OperationalHealthRow[]
  lastRefreshed: string
}

/**
 * Per-analyst detail, keyed by the registry id the Analysts page selects on.
 * Each entry stays consistent with its ANALYST_REGISTRY row (kind, version,
 * health, 90-day IC) — a degraded analyst shows degraded operational health.
 */
export const ANALYST_DETAILS: Record<string, AnalystDetail> = {
  "earnings-drift": {
    id: "earnings-drift",
    name: "Earnings drift",
    handle: "quant.earnings-drift",
    version: "v2.4.0",
    kind: "quant",
    health: "healthy",
    description: "Ranks names by standardized earnings surprise and drifts into the post-announcement window.",
    io: { input: "PIT estimates & prints", method: "Surprise z-score", output: "Conviction + drift horizon", failure: "Abstain on stale estimates" },
    behavior: { ic: "0.112", hitRate: "60.4%", avgConviction: "0.58", coverage: "93.8%" },
    behaviorDeciles: [-1.1, -0.8, -0.5, -0.1, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8],
    operational: [
      { label: "Spec version", value: "quant.earnings-drift.v2.4.0", status: "verified" },
      { label: "Estimator", value: "surprise-zscore-v6", status: "healthy" },
      { label: "Median latency", value: "0.21s", status: "healthy" },
      { label: "Cost per signal", value: "$0.0002", status: "healthy" },
      { label: "Compute success", value: "100.0%", status: "healthy" },
      { label: "Data coverage", value: "93.8%", status: "healthy" },
    ],
    lastRefreshed: "2025-05-15 14:18:07 UTC",
  },
  value: {
    id: "value",
    name: "Value",
    handle: "llm.value",
    version: "v3.2.1",
    kind: "llm",
    health: "healthy",
    description: "Forms a valuation view from point-in-time fundamentals and preserves a written thesis.",
    io: { input: "PIT fundamentals", method: "Value checklist", output: "Conviction + thesis", failure: "Abstain, never neutral" },
    behavior: { ic: "0.083", hitRate: "57.8%", avgConviction: "0.46", coverage: "91.6%" },
    behaviorDeciles: [-0.9, -0.7, -0.4, 0.05, 0.2, 0.45, 0.6, 0.8, 1.0, 1.2],
    operational: [
      { label: "Prompt version", value: "prompt.value.v3.2.1", status: "verified" },
      { label: "Model", value: "gpt-4o-2024-08-06", status: "healthy" },
      { label: "Median latency", value: "1.82s", status: "healthy" },
      { label: "Cost per signal", value: "$0.0041", status: "healthy" },
      { label: "Parse success", value: "99.6%", status: "healthy" },
      { label: "Data coverage", value: "92.3%", status: "attention" },
    ],
    lastRefreshed: "2025-05-15 14:18:07 UTC",
  },
  quality: {
    id: "quality",
    name: "Quality",
    handle: "quant.quality",
    version: "v1.6.0",
    kind: "quant",
    health: "healthy",
    description: "Scores balance-sheet quality — ROIC, leverage, and accruals — from point-in-time fundamentals.",
    io: { input: "PIT fundamentals", method: "Quality composite", output: "Conviction score", failure: "Abstain on missing filings" },
    behavior: { ic: "0.067", hitRate: "55.9%", avgConviction: "0.41", coverage: "94.9%" },
    behaviorDeciles: [-0.6, -0.4, -0.2, 0.0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.95],
    operational: [
      { label: "Spec version", value: "quant.quality.v1.6.0", status: "verified" },
      { label: "Estimator", value: "quality-composite-v3", status: "healthy" },
      { label: "Median latency", value: "0.18s", status: "healthy" },
      { label: "Cost per signal", value: "$0.0002", status: "healthy" },
      { label: "Compute success", value: "100.0%", status: "healthy" },
      { label: "Data coverage", value: "94.9%", status: "healthy" },
    ],
    lastRefreshed: "2025-05-15 14:18:07 UTC",
  },
  "macro-context": {
    id: "macro-context",
    name: "Macro context",
    handle: "llm.macro-context",
    version: "v2.1.0",
    kind: "llm",
    health: "degraded",
    description: "Synthesizes macro releases and central-bank language into a cross-asset and single-name view.",
    io: { input: "Macro releases & speeches", method: "Regime synthesis", output: "Conviction + regime tag", failure: "Abstain on stale feeds" },
    behavior: { ic: "0.028", hitRate: "50.7%", avgConviction: "0.52", coverage: "77.7%" },
    behaviorDeciles: [-0.3, -0.35, -0.1, 0.05, -0.05, 0.2, 0.1, 0.3, 0.25, 0.4],
    operational: [
      { label: "Prompt version", value: "prompt.macro-context.v2.1.0", status: "verified" },
      { label: "Model", value: "gpt-4o-2024-08-06", status: "healthy" },
      { label: "Median latency", value: "3.94s", status: "attention" },
      { label: "Cost per signal", value: "$0.0068", status: "healthy" },
      { label: "Parse success", value: "94.1%", status: "attention" },
      { label: "Data coverage", value: "77.7%", status: "attention" },
    ],
    lastRefreshed: "2025-05-15 13:58:02 UTC",
  },
  "insider-activity": {
    id: "insider-activity",
    name: "Insider activity",
    handle: "quant.insider-activity",
    version: "v1.3.2",
    kind: "quant",
    health: "healthy",
    description: "Reads point-in-time insider filings for cluster buying and selling pressure.",
    io: { input: "PIT insider filings", method: "Cluster & size score", output: "Conviction score", failure: "Abstain on thin filings" },
    behavior: { ic: "0.041", hitRate: "53.4%", avgConviction: "0.38", coverage: "89.3%" },
    behaviorDeciles: [-0.5, -0.3, -0.15, 0.0, 0.1, 0.25, 0.35, 0.5, 0.6, 0.75],
    operational: [
      { label: "Spec version", value: "quant.insider-activity.v1.3.2", status: "verified" },
      { label: "Estimator", value: "insider-cluster-v2", status: "healthy" },
      { label: "Median latency", value: "0.24s", status: "healthy" },
      { label: "Cost per signal", value: "$0.0003", status: "healthy" },
      { label: "Compute success", value: "99.9%", status: "healthy" },
      { label: "Data coverage", value: "89.3%", status: "attention" },
    ],
    lastRefreshed: "2025-05-15 14:18:07 UTC",
  },
  sentiment: {
    id: "sentiment",
    name: "Sentiment",
    handle: "llm.sentiment",
    version: "v1.8.0",
    kind: "llm",
    health: "healthy",
    description: "Scores news and filing tone into a short-horizon sentiment view with a written rationale.",
    io: { input: "News & filings", method: "Tone classification", output: "Conviction + rationale", failure: "Abstain on low volume" },
    behavior: { ic: "0.055", hitRate: "54.6%", avgConviction: "0.44", coverage: "87.4%" },
    behaviorDeciles: [-0.7, -0.45, -0.25, -0.05, 0.1, 0.3, 0.45, 0.55, 0.7, 0.85],
    operational: [
      { label: "Prompt version", value: "prompt.sentiment.v1.8.0", status: "verified" },
      { label: "Model", value: "gpt-4o-mini-2024-07-18", status: "healthy" },
      { label: "Median latency", value: "0.96s", status: "healthy" },
      { label: "Cost per signal", value: "$0.0009", status: "healthy" },
      { label: "Parse success", value: "99.2%", status: "healthy" },
      { label: "Data coverage", value: "87.4%", status: "attention" },
    ],
    lastRefreshed: "2025-05-15 14:18:07 UTC",
  },
}

/** The analyst detail for a registry id, falling back to the Value analyst. */
export function getAnalystDetail(id: string): AnalystDetail {
  return ANALYST_DETAILS[id] ?? ANALYST_DETAILS["value"]!
}
export type AnalystRecentSignalRow = { time: string; security: string; asOfCutoff: string; conviction: number; horizon: string; thesis: string; outcome: string; run: string }
export const ANALYST_RECENT_SIGNALS: AnalystRecentSignalRow[] = [
  { time: "2025-05-15 14:12:31", security: "NVDA", asOfCutoff: "2025-05-14", conviction: 0.82, horizon: "10d", thesis: "Strong upside; GPUs supply tight, margin expansion.", outcome: "+5.6%", run: "run_8c41cf" },
  { time: "2025-05-15 13:52:31", security: "AAPL", asOfCutoff: "2025-05-14", conviction: 0.34, horizon: "10d", thesis: "Services strength offsets macro softness.", outcome: "+1.1%", run: "run_8c41c9" },
  { time: "2025-05-15 13:21:44", security: "EQNR", asOfCutoff: "2025-05-14", conviction: -0.28, horizon: "10d", thesis: "Hold; momentum fading; event risk ahead.", outcome: "-0.4%", run: "run_8c41c7" },
  { time: "2025-05-15 12:47:16", security: "DNB", asOfCutoff: "2025-05-14", conviction: 0.15, horizon: "10d", thesis: "Reduce; credit spreads widening.", outcome: "-0.2%", run: "run_8c41c5" },
  { time: "2025-05-15 11:33:02", security: "MSFT", asOfCutoff: "2025-05-14", conviction: -0.21, horizon: "10d", thesis: "AI demand supports growth re-acceleration.", outcome: "-1.0%", run: "run_8c41c1" },
]
export type CommitteeUsageRow = { strategy: string; weight: number; since: string; ic90d: number }
export const COMMITTEE_USAGE: CommitteeUsageRow[] = [
  { strategy: "value-panel", weight: 0.35, since: "2025-05-15", ic90d: 0.083 },
  { strategy: "earnings-drift", weight: 0.20, since: "2025-05-15", ic90d: 0.071 },
  { strategy: "momentum-carry", weight: 0.15, since: "2025-05-12", ic90d: 0.032 },
]
export const COMMITTEE_DISAGREEMENT = { correlation: 0.42, rating: "Good" }

// Data page (data.png)
export const DATA_KPIS = [
  { label: "Sources healthy", value: "2/2", status: "ok" as const },
  { label: "Coverage", value: "98.7%", status: "ok" as const },
  { label: "Freshness", value: "14m", status: "ok" as const },
  { label: "PIT violations", value: "0", status: "ok" as const },
]
export const DATA_LAST_CHECKED = "2025-05-15 14:32:18 UTC"
export type CoverageMatrixRow = { domain: string; us: CoverageState; norway: CoverageState; historicalDepth: string; freshness: string; source: string }
export const COVERAGE_MATRIX: CoverageMatrixRow[] = [
  { domain: "Prices", us: "covered", norway: "covered", historicalDepth: "10y", freshness: "12m", source: "US primary" },
  { domain: "Fundamentals", us: "covered", norway: "covered", historicalDepth: "20y", freshness: "14m", source: "US primary" },
  { domain: "Earnings", us: "covered", norway: "covered", historicalDepth: "15y", freshness: "14m", source: "US primary" },
  { domain: "News", us: "covered", norway: "partial", historicalDepth: "3y", freshness: "38m", source: "International primary" },
  { domain: "Insider trades", us: "covered", norway: "partial", historicalDepth: "10y", freshness: "1h 5m", source: "US primary" },
  { domain: "FX", us: "covered", norway: "covered", historicalDepth: "15y", freshness: "4m", source: "FX feed" },
  { domain: "Corporate actions", us: "covered", norway: "covered", historicalDepth: "20y", freshness: "6m", source: "US primary" },
]
export type RoutingRow = { exchange: string; routesTo: string; status: "healthy" | "degraded"; p95Latency: string; lastSync: string }
export const ROUTING_HEALTH: RoutingRow[] = [
  { exchange: "XNAS", routesTo: "US primary", status: "healthy", p95Latency: "132ms", lastSync: "2025-05-15 14:27:18 UTC" },
  { exchange: "XNYS", routesTo: "US primary", status: "healthy", p95Latency: "118ms", lastSync: "2025-05-15 14:27:05 UTC" },
  { exchange: "XOSL", routesTo: "International primary", status: "healthy", p95Latency: "164ms", lastSync: "2025-05-15 14:26:52 UTC" },
  { exchange: "NOKUSD", routesTo: "FX feed", status: "healthy", p95Latency: "94ms", lastSync: "2025-05-15 14:27:31 UTC" },
]
export const DATA_INCIDENTS = {
  warnings: 1,
  incidents: 0,
  items: [{ label: "News coverage partial for XOSL", since: "2025-05-15 13:52:31 UTC" }],
}
export type PitFlowStep = { title: string; body: string }
export const PIT_FLOW: PitFlowStep[] = [
  { title: "Provider observation", body: "Raw event timestamps from sources" },
  { title: "knownAt normalization", body: "Map to knownAt (first know time)" },
  { title: "cutoff filter", body: "knownAt ≤ decision cutoff" },
  { title: "immutable snapshot", body: "Append-only, content-addressed (no updates, only new snapshots)" },
  { title: "analyst context", body: "Strategies, signals, and backtests consume snapshot" },
]
export const PIT_RULES = [
  { label: "Rule", value: "knownAt ≤ decision cutoff" },
  { label: "Date-only fallback", value: "visible next trading day" },
  { label: "Fail-loud behavior", value: "Outage throws; genuine absence returns empty." },
]
export type DataSnapshotRow = { id: string; createdUtc: string; coverage: string; rows: number; hash: string; usedByRuns: number; verified: boolean }
export const DATA_SNAPSHOTS: DataSnapshotRow[] = [
  { id: "snapshot_2025-05-15_1200", createdUtc: "2025-05-15 12:00:00", coverage: "98.7%", rows: 842_134_512, hash: "9f4c2b7e1a3d8f9c2b6e8a3b7f1c9d2e8a46c6d7e8f9012a3b4c5d6e7f89012", usedByRuns: 12, verified: true },
  { id: "snapshot_2025-05-15_0900", createdUtc: "2025-05-15 09:00:00", coverage: "98.6%", rows: 841_002_341, hash: "7a1b3c9d2e4f8a6b1c3d5e7f9a0b2c4d6e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b", usedByRuns: 8, verified: true },
  { id: "snapshot_2025-05-14_1700", createdUtc: "2025-05-14 17:00:00", coverage: "98.5%", rows: 839_221_117, hash: "3c9d5e7f1a2b4c6d8e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d", usedByRuns: 16, verified: true },
  { id: "snapshot_2025-05-14_1200", createdUtc: "2025-05-14 12:00:00", coverage: "98.5%", rows: 837_948_221, hash: "1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a", usedByRuns: 10, verified: true },
  { id: "snapshot_2025-05-13_1200", createdUtc: "2025-05-13 12:00:00", coverage: "98.2%", rows: 834_556_102, hash: "0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c", usedByRuns: 7, verified: true },
]
export const DATA_SNAPSHOTS_TOTAL = 24
export type DataQualityCheck = { check: string; status: "passed" | "drift"; lastChecked: string }
export const DATA_QUALITY_CHECKS: DataQualityCheck[] = [
  { check: "Filing timestamp present", status: "passed", lastChecked: "2025-05-15 14:32:18" },
  { check: "No future-known facts", status: "passed", lastChecked: "2025-05-15 14:32:18" },
  { check: "FX every trading day", status: "passed", lastChecked: "2025-05-15 14:32:18" },
  { check: "Corporate actions balanced", status: "passed", lastChecked: "2025-05-15 14:32:18" },
  { check: "Symbol routing valid", status: "passed", lastChecked: "2025-05-15 14:32:18" },
  { check: "Historical drift", status: "drift", lastChecked: "2025-05-15 14:32:18" },
]
export type RetentionRow = { label: string; note: string; retention: string; license: string }
export const DATA_RETENTION: RetentionRow[] = [
  { label: "Public synthetic fixtures", note: "Synthetic datasets for tests and demos.", retention: "90 days", license: "Internal use only" },
  { label: "Private source cache", note: "Normalized source data and snapshots.", retention: "7 years", license: "Internal use only" },
]
