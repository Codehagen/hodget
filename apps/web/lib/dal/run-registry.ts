import "server-only"

import {
  createRunAnalystSource,
  createRunEmitter,
  executeRun,
  RunRegistry,
  setRunStatus,
  setRunWorkflowId,
  type EngineRun,
} from "@workspace/db"
import { start } from "workflow/api"

import { executeRunWorkflow } from "@/workflows/execute-run"

import { getDb } from "./db"

/**
 * Starting a run's execution (plan 004).
 *
 * Default: durable execution on the Workflow DevKit — `start()` enqueues
 * {@link executeRunWorkflow}, and the returned workflow run id is persisted so the
 * SSE route can attach to that run's durable event stream. This retires the
 * single-instance SSE limitation: the launching request and the SSE reader no
 * longer need to share a Node process, because progress flows through the durable
 * stream, not a process-local emitter.
 *
 * Fallback (`RUN_EXECUTION=inline`): the original in-process path — one emitter
 * per run in the registry below, executed fire-and-forget. Kept for local dev
 * without a workflow backend and for the web test suite. The registry is only used
 * by the inline path; the durable path never touches it.
 */
export const runRegistry = new RunRegistry()

/**
 * Inline execution: register a per-run emitter (so concurrent runs never
 * cross-talk) and execute in-process after the POST responds. `executeRun` records
 * its own failure and never throws, so nothing here can reject unhandled.
 */
function launchRunInline(run: EngineRun): void {
  const emitter = createRunEmitter(run.id)
  runRegistry.register(emitter)
  void executeRun({ sql: getDb(), run, emitter, analystSource: createRunAnalystSource() }).finally(
    () => {
      runRegistry.unregister(run.id)
    },
  )
}

/** Start a queued run: durable workflow by default, in-process when inline. */
export async function startRun(run: EngineRun): Promise<void> {
  if (process.env.RUN_EXECUTION === "inline") {
    launchRunInline(run)
    return
  }
  const { runId } = await start(executeRunWorkflow, [run.id])
  try {
    await setRunWorkflowId(getDb(), run.id, runId)
  } catch (error) {
    // The workflow is already enqueued; without workflow_run_id the run's
    // durable stream is unreachable, and letting this throw would 500 the
    // POST and invite a duplicate-run retry. One retry, then mark the run
    // failed so it is never silently unobservable. The executor still
    // transitions the run when it finishes — a failed → completed overwrite
    // is acceptable and self-healing.
    try {
      await setRunWorkflowId(getDb(), run.id, runId)
    } catch {
      await setRunStatus(getDb(), run.id, {
        status: "failed",
        error:
          "failed to record workflow id; run execution may proceed unobserved",
        completedAt: new Date().toISOString(),
      })
      throw error
    }
  }
}
