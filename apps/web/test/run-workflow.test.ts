import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { assertRunQueued, runExecuteStep, type RunEvent } from "@/lib/dal/run-workflow"
import {
  getRunOutcome,
  insertBacktestRun,
  setupWorkflowTestDb,
  teardownWorkflowTestDb,
} from "@/lib/dal/run-workflow-test-support"

/**
 * Integration test for the durable run workflow's step bodies (plan 004, phase 4)
 * against a PGlite database. Exercises `runExecuteStep` — the real work the
 * durable `executeRunStep` delegates to (executor + stream emitter + per-run
 * analyst source + idempotent persist + stream close) — with a genuine
 * WritableStream, and `assertRunQueued`, the `loadRun` step's guard.
 *
 * The Workflow DevKit's compiler/runtime plumbing (start → durable stream) is not
 * exercised here: its in-process vitest world cannot load this repo's raw-TS
 * workspace packages. That plumbing is proven separately against the Next webpack
 * runtime; this test covers everything the workflow orchestrates.
 */
const QUANT_CONFIG = {
  panel: { analysts: [{ id: "quant.earnings-drift", weight: 1 }] },
  initialCash: { USD: 100_000 },
}

/** A WritableStream that records every RunEvent chunk. */
function eventSink(): { writable: WritableStream<RunEvent>; events: RunEvent[] } {
  const events: RunEvent[] = []
  const writable = new WritableStream<RunEvent>({
    write(chunk) {
      events.push(chunk)
    },
  })
  return { writable, events }
}

beforeEach(async () => {
  await setupWorkflowTestDb()
})

afterEach(async () => {
  await teardownWorkflowTestDb()
})

describe("runExecuteStep — durable step body over PGlite", () => {
  it("persists a completed run and streams ordered RunEvents", async () => {
    const runId = await insertBacktestRun(QUANT_CONFIG)
    const { writable, events } = eventSink()

    await runExecuteStep(runId, writable)

    // Persisted terminal state + result + decision log.
    const outcome = await getRunOutcome(runId)
    expect(outcome.status).toBe("completed")
    expect(outcome.error).toBeNull()
    expect(outcome.hasResult).toBe(true)
    expect(outcome.decisionCount).toBeGreaterThan(0)

    // Streamed events preserve the wire contract: started first, completed last.
    expect(events[0]?.type).toBe("started")
    expect(events.at(-1)?.type).toBe("completed")
    expect(events.map((e) => e.type)).toContain("progress")
  })

  it("is idempotent when the step re-runs for the same run id", async () => {
    const runId = await insertBacktestRun(QUANT_CONFIG)

    await runExecuteStep(runId, eventSink().writable)
    const first = await getRunOutcome(runId)
    await runExecuteStep(runId, eventSink().writable)
    const second = await getRunOutcome(runId)

    expect(second.status).toBe("completed")
    // A retry replaces, not duplicates: the decision count is stable.
    expect(second.decisionCount).toBe(first.decisionCount)
  })
})

describe("assertRunQueued — loadRun step guard", () => {
  it("passes for a freshly queued run", async () => {
    const runId = await insertBacktestRun(QUANT_CONFIG)
    await expect(assertRunQueued(runId)).resolves.toBeUndefined()
  })

  it("throws for an unknown run id", async () => {
    await expect(assertRunQueued("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      /not found/,
    )
  })

  it("throws once the run is no longer queued", async () => {
    const runId = await insertBacktestRun(QUANT_CONFIG)
    // Executing the run transitions it out of "queued".
    await runExecuteStep(runId, eventSink().writable)
    await expect(assertRunQueued(runId)).rejects.toThrow(/expected "queued"/)
  })
})
