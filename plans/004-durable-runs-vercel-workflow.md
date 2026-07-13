# Plan 004 — Durable run execution on Vercel Workflow

## Goal

Replace the in-process, fire-and-forget run execution with durable execution on
the Workflow DevKit (`workflow` npm package, Vercel), and wire the per-run
model-client injection seam so LLM personas can sit on a panel. This retires the
documented single-instance SSE limitation: run events flow through the workflow
run's durable stream instead of a process-local emitter, so the launching
request and the SSE reader no longer need to share a Node process.

Plan 002 sketched `packages/jobs` as a Trigger.dev concern. That decision is
superseded: durable/async execution uses the Workflow DevKit. Scheduled cycles
and cache warming remain future scope; this plan covers request-triggered run
execution only.

## Non-negotiables (carried over)

- Engine stays a framework-free library. Workflow code may import
  `@workspace/db` and `@workspace/engine`; nothing in `packages/engine` or
  `packages/db` may import `workflow` APIs unconditionally — the executor must
  keep working in vitest and scripts without a workflow runtime.
- The `RunEvent` wire contract (`started | progress | analyst | completed |
  failed`, `isTerminal`) is preserved byte-for-byte on the SSE surface.
- Fail-loud semantics unchanged: a failed run records `failed` status with the
  error; `executeRun` never rejects.
- DAL remains the only authorization boundary; the workflow trigger and SSE
  routes keep the existing session/ownership guards.
- All 269 existing tests stay green; goldens untouched.

## Architecture

- **Workflow definitions live in `apps/web/workflows/`** (default). The WDK
  compiler runs via `withWorkflow` in `next.config.ts`; directives
  (`"use workflow"` / `"use step"`) must be seen by that compiler. Phase 0
  verifies whether directive files can instead live in a raw-TS workspace
  package (`packages/jobs`) under `transpilePackages` + webpack; if yes, move
  them there and keep `apps/web/workflows/` as thin re-exports. If no, they
  stay in the app and `packages/jobs` is not created in this plan.
- **One workflow, coarse steps.** `executeRunWorkflow(runId: string)`:
  - Step `loadRun`: fetch the run row, assert status `queued`.
  - Step `executeRun`: call the existing `executeRun` from `@workspace/db`
    with a **stream-backed emitter** — a `RunEmitter` implementation whose
    `emit` writes `RunEvent`s to `getWritable()` (steps have full Node access,
    so the existing executor runs unmodified inside the step). The backtest is
    deterministic, so a step retry recomputes identical results.
  - Serialization note: only `runId` crosses the workflow/step boundary;
    `Sql`, emitters, and analysts are constructed inside the step.
- **Idempotent persistence.** A retried `executeRun` step must not
  double-insert. Inside the existing atomic persist transaction, delete
  decisions/fills/result rows for the `runId` before inserting (idempotent
  replace keyed by run id). Same guard applies to the `failed` status write.
- **Run ↔ workflow linkage.** New migration adds `workflow_run_id text` to the
  runs table, written when the workflow is started. The SSE route uses it to
  attach to the durable stream.
- **Trigger.** `launchRun` in `apps/web/lib/dal/run-registry.ts` is replaced by
  `startRunWorkflow(run)`: `start(executeRunWorkflow, [run.id])` from
  `workflow/api`, then persist `workflow_run_id`. Keep an explicit in-process
  fallback (`RUN_EXECUTION=inline`) used by web tests and available for local
  dev without a workflow backend; default is `workflow`.
- **SSE route.** `GET /api/runs/[id]/events`:
  - Run has `workflow_run_id` → `getRun(id).getReadable({ startIndex })`,
    transform each `RunEvent` chunk to `data: <json>\n\n`, close on terminal
    event or abort. `startIndex` comes from a query param (default 0) so late
    subscribers replay from the beginning — strictly better than today's
    terminal-only replay.
  - No `workflow_run_id` (inline mode / legacy rows) → existing registry +
    `replayTerminal` path unchanged.
- **Per-run model-client injection (checkpoint item 3).** Provide
  `createRunAnalystSource(config)` (in `packages/db` executor, next to
  `defaultAnalystSource`): resolves quant ids via the engine registry, and
  `llm.value` via `createValueAnalyst({ llm, cache, model })` with a
  per-run `AnthropicLlmClient` (API key from env at construction, never
  module-global) and a fresh `PromptCache`. The workflow step passes it as
  `ExecuteRunDeps.analystSource`. Unknown ids keep failing loud. Tests use
  `FakeLlmClient`.

## Phases

### Phase 0 — Spike (kill-or-adjust)

Install `workflow` + `@workflow/next` (+ `@workflow/vitest` dev), wrap
`next.config.ts` with `withWorkflow`, add a trivial hello workflow, and verify:
`pnpm --filter web build` (webpack + extensionAlias) still compiles, `npx
workflow health` passes in dev, and a workflow step can import `@workspace/db`
raw-TS sources. Also test the directive-in-workspace-package question above.
If WDK cannot coexist with the webpack/raw-TS setup, stop and report — do not
work around it silently.

### Phase 1 — Durable executor path

Stream-backed `RunEmitter` adapter; `executeRunWorkflow` with the two steps;
idempotent persist guard + migration for `workflow_run_id`. Unit tests: steps
are plain functions without the compiler — test the adapter and idempotent
persist against PGlite (run `executeRun` twice with the same run id, assert
single result row / no duplicate decisions).

### Phase 2 — API rewiring

`startRunWorkflow` trigger with `RUN_EXECUTION` mode switch; SSE route reading
the durable stream with `startIndex` replay; inline fallback preserved. Web
tests run in inline mode and stay green; new tests cover the SSE transform
(event shapes preserved, terminal close) with a stubbed readable.

### Phase 3 — Model-client injection

`createRunAnalystSource`; panel configs naming `llm.value` execute end-to-end
in a PGlite test with `FakeLlmClient`; quant-only configs unaffected. Document
the seam replacing the current "documented seam" comment.

### Phase 4 — Integration tests + docs

`@workflow/vitest` integration test (separate vitest config, not in the default
`test` task if it needs long timeouts): start `executeRunWorkflow` against
PGlite, await `run.returnValue`, assert persisted status and streamed events.
Update the single-instance-limitation comments (`run-registry.ts`,
`events.ts`) and the runs API docs to describe the durable path.

Deployment verification: the generated `/.well-known/workflow/v1/**` routes run
step bodies without an app-level session check, so confirm that
`/.well-known/workflow/**` is not externally invocable (platform gating). App-level
ownership still holds — runIds only enter workflows via `createRun` (requireSession)
and reads stay behind `getOwnedRun` — but the platform gate is the trust boundary
for the step endpoints themselves (see `lib/dal/run-workflow.ts`).

## Out of scope

Scheduled cycles, cache warming, tracked migration runner, dashboard UI (plan
002 phase 5b, blocked on the design playbook), live/paper promotion changes.
