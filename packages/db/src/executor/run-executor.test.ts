import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataUnavailableError, type MarketData } from "@workspace/engine"

import type { Sql } from "../client.js"
import { getPersistedDecisions } from "../queries/reconstruct.js"
import { listFillRowsByRun } from "../queries/fills.js"
import { getResultByRun } from "../queries/results.js"
import { getRunById, insertRun } from "../queries/runs.js"
import { createTestDb, type TestDb } from "../testing/pglite.js"
import { runConfigSchema } from "./config.js"
import { createRunEmitter, type RunEvent } from "./events.js"
import { executeRun } from "./run-executor.js"
import { fixtureDataSource, type RunDataSource } from "./sources.js"

const BACKTEST_CONFIG = {
  panel: { analysts: [{ id: "quant.earnings-drift", weight: 1 }] },
  initialCash: { USD: 100_000 },
}

let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
})

afterEach(async () => {
  await db.close()
})

function collectEvents(runId: string): { events: RunEvent[]; emitter: ReturnType<typeof createRunEmitter> } {
  const emitter = createRunEmitter(runId)
  const events: RunEvent[] = []
  emitter.subscribe((e) => events.push(e))
  return { events, emitter }
}

describe("executeRun — happy path", () => {
  it("runs the fixture backtest, persists it, and reports progress", async () => {
    // Sanity: the config is a valid run request.
    expect(() => runConfigSchema.parse(BACKTEST_CONFIG)).not.toThrow()

    const run = await insertRun(db, {
      ownerUserId: "u",
      mode: "backtest",
      config: BACKTEST_CONFIG,
    })
    const { events, emitter } = collectEvents(run.id)

    await executeRun({ sql: db, run, emitter })

    // Run marked completed with a completion timestamp and no error.
    const finished = await getRunById(db, run.id)
    expect(finished?.status).toBe("completed")
    expect(finished?.error).toBeNull()
    expect(finished?.completedAt).toBeTruthy()

    // Result row persisted with the fixed-universe caveat.
    const result = await getResultByRun(db, run.id)
    expect(result).not.toBeNull()
    expect(Array.isArray(result?.equityCurve)).toBe(true)
    expect((result?.equityCurve as unknown[]).length).toBeGreaterThan(0)
    expect(JSON.stringify(result?.caveats)).toContain("fixed-universe")

    // Decision log reconstructable, and every fill links to a real decision.
    const decisions = await getPersistedDecisions(db, run.id)
    expect(decisions.length).toBeGreaterThan(0)
    const decisionIds = new Set(decisions.map((d) => d.decisionId))
    const fills = await listFillRowsByRun(db, run.id)
    for (const fill of fills) expect(decisionIds.has(fill.decisionId)).toBe(true)

    // Progress events emitted in order: started → progress/analyst → completed.
    const types = events.map((e) => e.type)
    expect(types[0]).toBe("started")
    expect(types.at(-1)).toBe("completed")
    expect(types).toContain("progress")
    expect(types).toContain("analyst")
  })
})

// A data source whose analyst-facing MarketData is a poisoned transport: every
// method throws, exactly as a provider outage would, forcing the failure path.
const throwingSource: RunDataSource = {
  load: fixtureDataSource.load,
  createMarketData: () =>
    new Proxy({} as MarketData, {
      get: () => () => {
        throw new DataUnavailableError("provider down")
      },
    }),
}

describe("executeRun — failure path (fail-loud preserved)", () => {
  it("marks the run failed and persists the error when the data provider throws", async () => {
    const run = await insertRun(db, {
      ownerUserId: "u",
      mode: "backtest",
      config: BACKTEST_CONFIG,
    })
    const { events, emitter } = collectEvents(run.id)

    // The executor swallows the throw (it is a background task) but records failure.
    await expect(
      executeRun({ sql: db, run, emitter, dataSource: throwingSource }),
    ).resolves.toBeUndefined()

    const finished = await getRunById(db, run.id)
    expect(finished?.status).toBe("failed")
    expect(finished?.error).toContain("provider down")
    expect(finished?.completedAt).toBeTruthy()

    // No result row for a failed run; failure event emitted last.
    expect(await getResultByRun(db, run.id)).toBeNull()
    expect(events.at(-1)?.type).toBe("failed")
  })

  it("never rejects even when the DB write recording the failure itself rejects", async () => {
    const run = await insertRun(db, {
      ownerUserId: "u",
      mode: "backtest",
      config: BACKTEST_CONFIG,
    })
    const { events, emitter } = collectEvents(run.id)

    // An Sql handle that rejects the terminal "failed" status write (its status
    // param is bound as $2), so the failure-recording write itself fails. The
    // earlier "running" write and reads still go to the real pglite db.
    const failingSql: Sql = {
      query: (text, params) =>
        params?.[1] === "failed"
          ? Promise.reject(new Error("db down while recording failure"))
          : db.query(text, params),
      transaction: (fn) => db.transaction(fn),
    }

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    // executeRun is fire-and-forget in the app; it must resolve, not reject, even
    // though it could not persist the failure.
    await expect(
      executeRun({ sql: failingSql, run, emitter, dataSource: throwingSource }),
    ).resolves.toBeUndefined()

    // The failed event still reached the live subscriber, and the dropped write
    // was logged as a last resort.
    expect(events.at(-1)?.type).toBe("failed")
    expect(consoleError).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })
})
