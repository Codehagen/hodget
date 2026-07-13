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

export type CoverageState = "covered" | "covered-empty" | "not-covered"

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
