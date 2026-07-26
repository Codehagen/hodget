import type { DateRange } from "../data/market-data.js"
import type { BacktestMetrics } from "../backtest/metrics.js"
import type { BacktestResult } from "../backtest/engine.js"

/**
 * Walk-forward validation (plan 002 phase 4).
 *
 * Validation is a **gate, not a report**: a backtest number with no out-of-sample
 * guard is a credibility liability. This is the simplest guard that is hard to
 * game — a **frozen holdout** followed by **sequential walk-forward** windows:
 *
 * - The first `trainFraction` of the trading days is the **in-sample / train**
 *   window. Its metrics are the reference you would have selected the strategy on.
 * - The remainder is split into `testWindows` sequential **out-of-sample** windows,
 *   each run independently. Degradation from train to test — or across the test
 *   windows — is the signal a strategy was overfit to one regime.
 *
 * Heavier machinery (purged/combinatorial CV, PBO) is deliberately deferred to the
 * phase-6 promotion gate. This harness is generic over how a window is run: pass a
 * `run(range)` that executes a backtest over a sub-range (e.g. wrapping
 * `runFixtureBacktest`), so the harness stays decoupled from dataset wiring.
 */

export interface WalkForwardWindow {
  readonly label: string
  readonly kind: "train" | "test"
  readonly range: DateRange
}

export interface WindowOutcome {
  readonly window: WalkForwardWindow
  readonly metrics: BacktestMetrics
  readonly result: BacktestResult
}

/** Aggregate statistics across the out-of-sample (test) windows only. */
export interface AggregateOutOfSample {
  readonly windows: number
  readonly meanTotalReturn: number
  readonly meanSharpe: number
  readonly meanWinRate: number
  /** The single worst drawdown observed across the test windows. */
  readonly worstDrawdown: number
}

export interface WalkForwardReport {
  readonly train: WindowOutcome | null
  readonly test: WindowOutcome[]
  /** Train first, then the test windows in order. */
  readonly windows: WindowOutcome[]
  readonly aggregate: AggregateOutOfSample
}

export interface SplitConfig {
  /** Fraction of days in the in-sample train window. Default 0.5. */
  readonly trainFraction?: number
  /** Number of sequential out-of-sample windows. Default 1 (a frozen holdout). */
  readonly testWindows?: number
}

function sortedUnique(dates: readonly string[]): string[] {
  return [...new Set(dates)].sort()
}

/**
 * Split ordered trading days into one train window and `testWindows` sequential
 * test windows. The train window covers the first `trainFraction` of days; the
 * remainder is chunked as evenly as possible (earlier chunks absorb the remainder).
 */
export function splitWindows(
  dates: readonly string[],
  config: SplitConfig = {},
): WalkForwardWindow[] {
  const days = sortedUnique(dates)
  const trainFraction = config.trainFraction ?? 0.5
  const testWindows = Math.max(1, config.testWindows ?? 1)
  if (days.length < testWindows + 1) {
    throw new Error(`need at least ${testWindows + 1} trading days to split, got ${days.length}`)
  }

  const trainCount = Math.min(days.length - testWindows, Math.max(1, Math.floor(days.length * trainFraction)))
  const windows: WalkForwardWindow[] = [
    { label: "train", kind: "train", range: { from: days[0] as string, to: days[trainCount - 1] as string } },
  ]

  const rest = days.slice(trainCount)
  const base = Math.floor(rest.length / testWindows)
  const extra = rest.length % testWindows
  let offset = 0
  for (let i = 0; i < testWindows; i++) {
    const size = base + (i < extra ? 1 : 0)
    const chunk = rest.slice(offset, offset + size)
    offset += size
    if (chunk.length === 0) continue
    windows.push({
      label: `test-${i + 1}`,
      kind: "test",
      range: { from: chunk[0] as string, to: chunk[chunk.length - 1] as string },
    })
  }
  return windows
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export interface WalkForwardConfig extends SplitConfig {
  /** All trading days spanned by the evaluation, in any order. */
  readonly dates: readonly string[]
  /** Run a backtest over a sub-range and return its result. */
  readonly run: (range: DateRange) => Promise<BacktestResult>
}

/**
 * Run the frozen-holdout + walk-forward evaluation: split the days, run a backtest
 * per window, and report per-window and aggregate out-of-sample metrics.
 */
export async function walkForward(config: WalkForwardConfig): Promise<WalkForwardReport> {
  const windows = splitWindows(config.dates, config)

  const outcomes: WindowOutcome[] = []
  for (const window of windows) {
    const result = await config.run(window.range)
    outcomes.push({ window, metrics: result.metrics, result })
  }

  const train = outcomes.find((o) => o.window.kind === "train") ?? null
  const test = outcomes.filter((o) => o.window.kind === "test")

  const aggregate: AggregateOutOfSample = {
    windows: test.length,
    meanTotalReturn: mean(test.map((o) => o.metrics.totalReturn)),
    meanSharpe: mean(test.map((o) => o.metrics.sharpe)),
    meanWinRate: mean(test.map((o) => o.metrics.winRate)),
    worstDrawdown: test.reduce((worst, o) => Math.max(worst, o.metrics.maxDrawdown), 0),
  }

  return { train, test, windows: outcomes, aggregate }
}
