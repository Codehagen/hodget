# Plan 011: Run-stream correctness — SSE terminal fallback on error, and no unobservable runs from a failed workflow-id persist

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- apps/web/lib/run-events-sse.ts apps/web/test/run-events-sse.test.ts apps/web/lib/dal/run-registry.ts apps/web/test/run-workflow.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (part 1) / MED (part 2 touches the run-create path)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

Two gaps in the durable-run pipeline:

1. **A mid-stream read error silently drops the terminal frame.** The SSE
   adapter only synthesizes a terminal event (from the run's persisted
   status) when the durable source ends cleanly; if `reader.read()` throws,
   the stream errors out and a client waiting for `completed`/`failed` shows
   a run stuck "running" forever.
2. **`startRun` is non-atomic.** It enqueues the durable workflow, then
   persists the returned `workflowRunId` in a second await. If that UPDATE
   fails, the workflow runs to completion but the run row keeps
   `workflow_run_id = null` — the SSE route then takes the legacy in-process
   path, finds no emitter, and the run is permanently unobservable; the POST
   also 500s, inviting a client retry that creates a duplicate run.

## Current state

`apps/web/lib/run-events-sse.ts:55-84` (`sseFromRunEvents`):

```ts
return new ReadableStream<Uint8Array>({
  async pull(controller) {
    try {
      const { done, value } = await reader.read()
      if (done) {
        if (!sawTerminal) {
          const fallback = await options.onEndWithoutTerminal?.()
          if (fallback) controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`))
        }
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
      if (isTerminal(value)) {
        sawTerminal = true
        await reader.cancel()
        controller.close()
      }
    } catch (error) {
      controller.error(error)   // ← fallback never runs on this path
    }
  },
  ...
```

`apps/web/lib/dal/run-registry.ts:49-57`:

```ts
export async function startRun(run: EngineRun): Promise<void> {
  if (process.env.RUN_EXECUTION === "inline") {
    launchRunInline(run)
    return
  }
  const { runId } = await start(executeRunWorkflow, [run.id])
  await setRunWorkflowId(getDb(), run.id, runId)   // ← failure orphans the stream
}
```

`createRun` (`apps/web/lib/dal/runs.ts:27-38`) awaits `startRun` before
returning; `setRunStatus` is available from `@workspace/db` (see its use in
`packages/db/src/executor/run-executor.ts`).

Existing test exemplars:
- `apps/web/test/run-events-sse.test.ts` — unit-tests `sseFromRunEvents`
  against a stubbed `ReadableStream<RunEvent>`; follow its helpers for
  reading SSE frames.
- `apps/web/test/run-workflow.test.ts` — mocks the workflow seam; follow its
  mocking style for `startRun` tests. The vitest config aliases `server-only`
  to a stub and forces `RUN_EXECUTION=inline` via env — note your tests for
  the durable path must explicitly unset/override that env within the test.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Web tests | `pnpm turbo run test --filter=web` | all pass |
| Typecheck | `pnpm turbo run typecheck --filter=web` | exit 0 |
| Lint | `cd apps/web && pnpm lint` | exit 0 (post plan 007) |

## Scope

**In scope**:
- `apps/web/lib/run-events-sse.ts`
- `apps/web/lib/dal/run-registry.ts`
- `apps/web/test/run-events-sse.test.ts`, `apps/web/test/run-workflow.test.ts`
  (or a new `apps/web/test/run-registry.test.ts`)

**Out of scope**:
- `apps/web/app/api/runs/[id]/events/route.ts` — its construction-time
  try/catch is correct as is.
- `packages/db` — no schema or query changes.
- A client idempotency-key protocol on `POST /api/runs` (real design work;
  recorded in Maintenance notes as deferred).
- The workflow definition (`apps/web/workflows/execute-run.ts`).

## Git workflow

- Branch: `advisor/011-run-stream-correctness`
- Conventional commits, one per part (`fix(web): …`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Terminal fallback on the SSE error path

In `sseFromRunEvents`, replace the `catch` block with logic that tries the
fallback before giving up:

```ts
} catch (error) {
  // A durable-stream read error must not strand the client without a
  // terminal frame: fall back to the run's persisted status, exactly like
  // the clean end-of-stream path. Only if that also fails does the stream
  // error out.
  if (!sawTerminal) {
    try {
      const fallback = await options.onEndWithoutTerminal?.()
      if (fallback) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`))
        controller.close()
        return
      }
    } catch {
      // fall through to controller.error below
    }
  }
  controller.error(error)
}
```

Note: if the fallback returns `null` (run not terminal yet), the stream still
errors — the client's EventSource auto-reconnect then re-attaches, which is
the correct behavior for a transient mid-run failure.

**Verify**: `pnpm turbo run test --filter=web -- run-events-sse` → existing
tests pass plus the new ones from the Test plan.

### Step 2: Make a failed workflow-id persist non-fatal and the run non-stuck

In `startRun`, wrap the persist:

```ts
const { runId } = await start(executeRunWorkflow, [run.id])
try {
  await setRunWorkflowId(getDb(), run.id, runId)
} catch (error) {
  // The workflow is already enqueued; without workflow_run_id the run's
  // stream is unreachable and a thrown error would 500 the POST and invite
  // a duplicate-run retry. One retry, then mark the run failed so it is
  // never silently unobservable.
  try {
    await setRunWorkflowId(getDb(), run.id, runId)
  } catch {
    await setRunStatus(getDb(), run.id, {
      status: "failed",
      error: "failed to record workflow id; run execution may proceed unobserved",
      completedAt: new Date().toISOString(),
    })
    throw error
  }
}
```

Import `setRunStatus` from `@workspace/db` alongside the existing imports.
(The executor will still transition the run when it completes — a
`failed → completed` overwrite is acceptable and self-healing; note this in
the code comment.)

**Verify**: `pnpm turbo run typecheck --filter=web` → exit 0; new tests pass.

## Test plan

In `apps/web/test/run-events-sse.test.ts` (model after existing cases):
1. Source stream that emits one `progress` event then **errors**: with an
   `onEndWithoutTerminal` returning a `completed` event → client receives
   progress + completed frames and the stream closes cleanly (no error).
2. Same, but fallback returns `null` → stream errors (assert rejection when
   reading), no terminal frame.
3. Source emits `completed` then errors on next read → no double terminal
   (existing `sawTerminal` short-circuit — stream already closed).

In `apps/web/test/run-workflow.test.ts` or a new `run-registry.test.ts`
(mock `workflow/api`'s `start` and `@workspace/db`'s `setRunWorkflowId`/
`setRunStatus` following the file's existing mock style):
4. `setRunWorkflowId` fails once then succeeds → `startRun` resolves, status
   untouched.
5. Fails twice → `startRun` rejects AND `setRunStatus` was called with
   `status: "failed"`.

**Verification**: `pnpm turbo run test --filter=web` → all pass, ≥5 new tests.

## Done criteria

- [ ] `sseFromRunEvents`'s catch path attempts `onEndWithoutTerminal` before
      `controller.error`
- [ ] `startRun` retries the workflow-id persist once and marks the run
      failed on persistent failure
- [ ] `pnpm turbo run test --filter=web` exits 0 with the 5 new tests
- [ ] typecheck + lint exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The excerpts don't match the live code.
- `setRunStatus` is not exported from `@workspace/db` (check
  `packages/db/src/index.ts`; if missing, STOP — exporting it is a one-line
  change but confirms the plan's assumption was wrong).
- Test 3 shows a double-terminal frame — the `sawTerminal` model is wrong;
  report rather than patching around it.

## Maintenance notes

- Deferred: a client-supplied idempotency key on `POST /api/runs` would close
  the duplicate-run-on-retry window completely; revisit when a real client
  (not fixtures) drives run creation.
- Deferred: audit finding CORRECTNESS-04 (whether WDK's `getWritable` resets
  on step retry, which could double lifecycle frames for replaying
  subscribers) — an *investigation*, not a fix; check WDK docs/source before
  building dedup.
- Reviewer focus: the `failed → completed` self-heal comment in `startRun`
  must survive review; without it the overwrite looks like a bug.
