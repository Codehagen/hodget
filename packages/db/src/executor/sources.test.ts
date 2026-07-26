import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { FakeLlmClient, toolResult, VALUE_ANALYST_ID } from "@workspace/engine"

import { getPersistedDecisions } from "../queries/reconstruct.js"
import { getResultByRun } from "../queries/results.js"
import { getRunById, insertRun } from "../queries/runs.js"
import { createTestDb, type TestDb } from "../testing/pglite.js"
import { createRunEmitter } from "./events.js"
import { executeRun } from "./run-executor.js"
import { createRunAnalystSource } from "./sources.js"

/** A model client that returns a valid structured verdict for every request. */
function bullishFake(): FakeLlmClient {
  return new FakeLlmClient(() =>
    toolResult({ signal: "bullish", confidence: 70, reasoning: "cheap and growing" }),
  )
}

describe("createRunAnalystSource — resolution", () => {
  it("resolves quant analysts from the engine registry", () => {
    const source = createRunAnalystSource({ llm: bullishFake() })
    const quant = source.resolve("quant.earnings-drift")
    expect(quant.id).toBe("quant.earnings-drift")
    expect(quant.kind).toBe("quant")
  })

  it("builds the value persona per run and memoizes it", () => {
    const source = createRunAnalystSource({ llm: bullishFake() })
    const a = source.resolve(VALUE_ANALYST_ID)
    const b = source.resolve(VALUE_ANALYST_ID)
    expect(a.kind).toBe("llm")
    expect(a).toBe(b) // same instance reused within the run
  })

  it("fails loud on an unknown analyst id", () => {
    const source = createRunAnalystSource({ llm: bullishFake() })
    expect(() => source.resolve("does.not.exist")).toThrow(/unknown analyst id/)
  })

  it("resolves quant analysts with no model client (quant-only needs no API key)", () => {
    // No `llm` provided and (in test) no ANTHROPIC_API_KEY: resolving a quant id
    // must not lazily construct a model client, so it never throws.
    const source = createRunAnalystSource()
    expect(() => source.resolve("quant.earnings-drift")).not.toThrow()
  })
})

describe("createRunAnalystSource — end to end (plan 004 phase 3)", () => {
  let db: TestDb
  beforeEach(async () => {
    db = await createTestDb()
  })
  afterEach(async () => {
    await db.close()
  })

  it("runs an llm.value panel end to end with a FakeLlmClient", async () => {
    const fake = bullishFake()
    const run = await insertRun(db, {
      ownerUserId: "u",
      mode: "backtest",
      config: {
        panel: { analysts: [{ id: VALUE_ANALYST_ID, weight: 1 }] },
        initialCash: { USD: 100_000 },
      },
    })

    await executeRun({
      sql: db,
      run,
      emitter: createRunEmitter(run.id),
      analystSource: createRunAnalystSource({ llm: fake }),
    })

    const finished = await getRunById(db, run.id)
    expect(finished?.status).toBe("completed")
    expect(finished?.error).toBeNull()

    // The persona reached the (fake) model rather than abstaining, and produced a
    // persisted decision log.
    expect(fake.calls.length).toBeGreaterThan(0)
    expect(await getResultByRun(db, run.id)).not.toBeNull()
    expect((await getPersistedDecisions(db, run.id)).length).toBeGreaterThan(0)
  })

  it("leaves a quant-only panel unaffected (no model calls)", async () => {
    const fake = bullishFake()
    const run = await insertRun(db, {
      ownerUserId: "u",
      mode: "backtest",
      config: {
        panel: { analysts: [{ id: "quant.earnings-drift", weight: 1 }] },
        initialCash: { USD: 100_000 },
      },
    })

    await executeRun({
      sql: db,
      run,
      emitter: createRunEmitter(run.id),
      analystSource: createRunAnalystSource({ llm: fake }),
    })

    expect((await getRunById(db, run.id))?.status).toBe("completed")
    expect(fake.calls.length).toBe(0)
  })
})
