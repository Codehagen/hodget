import "server-only"

import { createRunEmitter, executeRun, RunRegistry, type EngineRun } from "@workspace/db"

import { getDb } from "./db"

/**
 * App-level wiring for the in-process run executor (plan 002 phase 5a).
 *
 * Each run gets its OWN emitter (so concurrent runs never cross-talk — the
 * guarantee proven in the db package's event tests); this registry is only a
 * runId → live-emitter lookup so the SSE route can find a running run's channel.
 * A run absent from the registry has finished, and callers fall back to its
 * persisted status.
 *
 * Single-instance assumption: the launching request and the SSE request must land
 * on the same server process for live streaming. That holds for a single Node
 * server and is acceptable for phase 5a; durable, cross-instance progress is a
 * `packages/jobs` (Trigger.dev) concern in a later phase. See the report's open
 * risks.
 */
export const runRegistry = new RunRegistry()

/** Launch a queued run in the background and stream its progress via the registry. */
export function launchRun(run: EngineRun): void {
  const emitter = createRunEmitter(run.id)
  runRegistry.register(emitter)
  // Fire-and-forget: the run executes after the POST responds. executeRun records
  // its own failure and never throws, so nothing here can reject unhandled.
  void executeRun({ sql: getDb(), run, emitter }).finally(() => {
    runRegistry.unregister(run.id)
  })
}
