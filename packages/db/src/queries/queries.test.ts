import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createTestDb, type TestDb } from "../testing/pglite.js"
import { getRunById, insertRun, listRunsByOwner, setRunStatus } from "./runs.js"
import { getResultByRun, insertResult } from "./results.js"
import { insertPanelConfig, listPanelConfigsByOwner } from "./panel-configs.js"

let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
})

afterEach(async () => {
  await db.close()
})

describe("engine_runs queries", () => {
  it("inserts a queued run and reads it back with parsed shape", async () => {
    const run = await insertRun(db, {
      ownerUserId: "user-1",
      mode: "backtest",
      config: { panel: { analysts: [{ id: "a", weight: 1 }] } },
    })

    expect(run.status).toBe("queued")
    expect(run.mode).toBe("backtest")
    expect(run.ownerUserId).toBe("user-1")
    expect(run.error).toBeNull()
    expect(run.completedAt).toBeNull()
    expect(typeof run.createdAt).toBe("string")
    expect(run.config).toEqual({ panel: { analysts: [{ id: "a", weight: 1 }] } })

    const fetched = await getRunById(db, run.id)
    expect(fetched).toEqual(run)
  })

  it("transitions status, error and completed_at", async () => {
    const run = await insertRun(db, { ownerUserId: "u", mode: "backtest", config: {} })

    await setRunStatus(db, run.id, { status: "running" })
    expect((await getRunById(db, run.id))?.status).toBe("running")

    await setRunStatus(db, run.id, {
      status: "failed",
      error: "boom",
      completedAt: "2026-01-01T00:00:00.000Z",
    })
    const failed = await getRunById(db, run.id)
    expect(failed?.status).toBe("failed")
    expect(failed?.error).toBe("boom")
    expect(failed?.completedAt).toBe("2026-01-01T00:00:00.000Z")
  })

  it("lists a user's runs newest-first and scopes by owner", async () => {
    await insertRun(db, { ownerUserId: "owner", mode: "backtest", config: {} })
    await insertRun(db, { ownerUserId: "owner", mode: "paper", config: {} })
    await insertRun(db, { ownerUserId: "other", mode: "backtest", config: {} })

    const mine = await listRunsByOwner(db, "owner")
    expect(mine).toHaveLength(2)
    expect(mine.every((r) => r.ownerUserId === "owner")).toBe(true)
  })

  it("returns null for an unknown run id", async () => {
    expect(await getRunById(db, "00000000-0000-0000-0000-000000000000")).toBeNull()
  })
})

describe("engine_results queries", () => {
  it("round-trips a result row", async () => {
    const run = await insertRun(db, { ownerUserId: "u", mode: "backtest", config: {} })
    await insertResult(db, {
      runId: run.id,
      equityCurve: [{ date: "2026-01-01", equity: 100 }],
      metrics: { sharpe: 1.2 },
      diagnostics: { attribution: [] },
      caveats: ["fixed-universe"],
    })

    const result = await getResultByRun(db, run.id)
    expect(result?.equityCurve).toEqual([{ date: "2026-01-01", equity: 100 }])
    expect(result?.metrics).toEqual({ sharpe: 1.2 })
    expect(result?.caveats).toEqual(["fixed-universe"])
  })
})

describe("panel_configs queries", () => {
  it("inserts and lists a user's panels", async () => {
    const created = await insertPanelConfig(db, {
      ownerUserId: "u",
      name: "Value + drift",
      panel: { analysts: [{ id: "llm.value", weight: 2 }, { id: "quant.earnings-drift", weight: 1 }] },
    })
    expect(created.name).toBe("Value + drift")
    expect(created.panel.analysts).toHaveLength(2)

    const list = await listPanelConfigsByOwner(db, "u")
    expect(list).toHaveLength(1)
    expect(list[0]?.panel.analysts[0]?.id).toBe("llm.value")

    expect(await listPanelConfigsByOwner(db, "someone-else")).toHaveLength(0)
  })
})
