import {
  createConvictionCommittee,
  createPriceBook,
  createTradingCalendar,
  runBacktest,
  type BacktestResult,
  type Committee,
  type CorporateActionEvent,
  type Currency,
  type FixtureDataset,
  type MarketData,
  type Mic,
  type Analyst,
} from "@workspace/engine"

import type { Sql } from "../client.js"
import { PostgresLedger } from "../ledger/postgres-ledger.js"
import { insertResult } from "../queries/results.js"
import { setRunStatus } from "../queries/runs.js"
import type { EngineRun } from "../schema.js"
import { runConfigSchema, type RunConfig } from "./config.js"
import type { RunEmitter } from "./events.js"
import {
  defaultAnalystSource,
  fixtureDataSource,
  instrumentAnalyst,
  type AnalystSource,
  type RunDataSource,
} from "./sources.js"

/**
 * The run executor (plan 002 phase 5a).
 *
 * Given a queued run, it executes the engine backtest in-process over the run's
 * data source (fixture by default), persisting every decision + its fills through
 * a {@link PostgresLedger} and the final result row, transitioning the run's
 * status, and emitting progress to the run's **own** emitter (no shared state, so
 * concurrent runs never cross-talk).
 *
 * Fail-loud is preserved: any throw — including a data-provider outage surfacing
 * as a `DataUnavailableError` from the analyst-facing `MarketData` — marks the run
 * `failed` with the error message persisted, never a silently corrupt result.
 * `executeRun` itself never throws; it records failure and returns, because it is
 * launched as a background task from the request that created the run.
 */

export interface ExecuteRunDeps {
  readonly sql: Sql
  /** The already-inserted, queued run. */
  readonly run: EngineRun
  /** The run's own emitter (register it with the app's RunRegistry before calling). */
  readonly emitter: RunEmitter
  readonly dataSource?: RunDataSource
  readonly analystSource?: AnalystSource
}

export async function executeRun(deps: ExecuteRunDeps): Promise<void> {
  const { sql, run, emitter } = deps
  const dataSource = deps.dataSource ?? fixtureDataSource
  const analystSource = deps.analystSource ?? defaultAnalystSource()

  emitter.emit({ type: "started", runId: run.id, at: new Date().toISOString() })

  try {
    const config = runConfigSchema.parse(run.config)
    await setRunStatus(sql, run.id, { status: "running" })

    const dataset = await dataSource.load()
    const marketData = dataSource.createMarketData(dataset)

    // Per-day progress: the first analyst call at a new decision date emits a tick.
    const seenDays = new Set<string>()
    const panel = config.panel.analysts.map((seat) =>
      instrumentAnalyst(analystSource.resolve(seat.id), (ctx) => {
        const day = ctx.asOf.slice(0, 10)
        if (!seenDays.has(day)) {
          seenDays.add(day)
          emitter.emit({ type: "progress", runId: run.id, asOf: ctx.asOf, day: seenDays.size })
        }
        emitter.emit({
          type: "analyst",
          runId: run.id,
          analystId: seat.id,
          securityId: ctx.securityId,
          asOf: ctx.asOf,
        })
      }),
    )

    const committee = createConvictionCommittee({
      analystWeights: Object.fromEntries(config.panel.analysts.map((a) => [a.id, a.weight])),
    })

    const ledger = new PostgresLedger()
    const result = await runEngineBacktest({ dataset, marketData, config, panel, committee, ledger })

    const completedAt = new Date().toISOString()
    await sql.transaction(async (tx) => {
      await ledger.persist(tx, run.id)
      await insertResult(tx, {
        runId: run.id,
        equityCurve: result.equityCurve,
        metrics: result.metrics,
        diagnostics: result.diagnostics,
        caveats: result.caveats,
      })
      await setRunStatus(tx, run.id, { status: "completed", completedAt })
    })

    emitter.emit({ type: "completed", runId: run.id, at: completedAt })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const at = new Date().toISOString()
    // Guard the failure-recording write itself: executeRun is launched as a
    // fire-and-forget `void executeRun(...)` (see run-registry.ts), so it must
    // never reject — not even when the DB is down while recording the failure.
    // Last resort if the write rejects: the emitter still carries the failed event
    // to any live subscriber, and we log so the dropped persistence is visible.
    try {
      await setRunStatus(sql, run.id, { status: "failed", error: message, completedAt: at })
    } catch (persistError) {
      const persistMessage =
        persistError instanceof Error ? persistError.message : String(persistError)
      console.error(
        `executeRun: failed to persist failure status for run ${run.id}: ${persistMessage}`,
      )
    }
    emitter.emit({ type: "failed", runId: run.id, error: message, at })
  }
}

interface BacktestArgs {
  readonly dataset: FixtureDataset
  readonly marketData: MarketData
  readonly config: RunConfig
  readonly panel: readonly Analyst[]
  readonly committee: Committee
  readonly ledger: PostgresLedger
}

/**
 * Wire a dataset + injected market data into {@link runBacktest}. Mirrors the
 * engine's fixture wiring, but takes the analyst-facing `MarketData` as a separate
 * input (the data-source seam) so accounting still runs on real fixture prices
 * even when the analyst view is swapped — e.g. a throwing view in the failure test.
 */
function runEngineBacktest(args: BacktestArgs): Promise<BacktestResult> {
  const { dataset, marketData, config, panel, committee, ledger } = args
  const baseCurrency: Currency = config.baseCurrency ?? "USD"

  const prices = createPriceBook({
    securities: dataset.securities.map((s) => ({
      securityId: s.securityId,
      mic: s.mic,
      currency: s.currency,
    })),
    prices: dataset.prices,
    fx: dataset.fx,
    baseCurrency,
  })

  return runBacktest({
    panel,
    committee,
    securityIds: config.securityIds ?? dataset.securities.map((s) => s.securityId),
    data: marketData,
    prices,
    calendar: createTradingCalendar(dataset.calendars as Partial<Record<Mic, readonly string[]>>),
    corporateActions: dataset.corporateActions as Readonly<
      Record<string, readonly CorporateActionEvent[]>
    >,
    baseCurrency,
    initialCash: config.initialCash,
    range: config.range ?? { from: dataset.meta.from, to: dataset.meta.to },
    ledger,
  })
}
