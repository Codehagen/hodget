import { getWritable } from "workflow"

import { assertRunQueued, runExecuteStep, type RunEvent } from "@/lib/dal/run-workflow"

/**
 * Durable run execution on the Workflow DevKit (plan 004).
 *
 * The workflow function is pure orchestration — no Node access, no data logic. It
 * only stitches two coarse steps together; every side effect lives in a step, and
 * the steps delegate all `@workspace/db` work to `lib/dal/run-workflow` so the DAL
 * import boundary holds. Only the `runId` string crosses the workflow/step
 * boundary; the `Sql` handle, emitter, and analysts are constructed inside steps.
 */
export async function executeRunWorkflow(runId: string): Promise<void> {
  "use workflow"

  await loadRunStep(runId)
  await executeRunStep(runId)
}

/** Step: fetch the run row and assert it is queued. */
async function loadRunStep(runId: string): Promise<void> {
  "use step"
  await assertRunQueued(runId)
}

/**
 * Step: execute the backtest, streaming RunEvents to the run's durable writable.
 * `getWritable()` must be called inside a step (it needs the workflow runtime);
 * the executor and stream adapter run unmodified with full Node access here.
 */
async function executeRunStep(runId: string): Promise<void> {
  "use step"
  await runExecuteStep(runId, getWritable<RunEvent>())
}
