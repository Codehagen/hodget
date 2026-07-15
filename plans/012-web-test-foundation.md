# Plan 012: Component-test foundation — jsdom harness, simulated-run tests, and a ui test script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- apps/web/vitest.config.mts apps/web/vitest.config.ts apps/web/components/dashboard/live-run apps/web/components/dashboard/ask packages/ui/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (purely additive)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

There is not a single component test in the repo (`*.test.tsx` → zero
matches). The public demo's flagship interaction — the simulated run replay,
a self-rescheduling `setTimeout` walker with cancellation — is untested, as
is the Ask conversation script. `packages/ui`, the shared component library,
has no `test` script at all, so `pnpm test` silently skips it. This plan
stands up the minimal harness and seeds it with the highest-value tests, so
later work (including other plans in this series) has somewhere to put
component tests.

## Current state

- `apps/web/vitest.config.mts` — `environment: "node"`,
  `include: ["test/**/*.test.ts"]` (note: `.ts`, excludes `.tsx`), aliases
  `server-only` → `test/stubs/server-only.ts` and `@` → the app root, and
  sets `env: { RUN_EXECUTION: "inline" }`. (If the file is `.ts` not `.mts`,
  adjust — check `ls apps/web/vitest.config.*`.)
- `apps/web/components/dashboard/live-run/simulated-run.ts` — exports
  `SIMULATED_RUN_ID`, types, and `useSimulatedRun`. Internals: `buildScript`
  (module-private, pure — takes a `RunDetail` from
  `../demo-data`'s `getRunDetail`, returns timed steps) and a
  self-rescheduling timeout walker inside `start()`; `reset()` cancels via
  `clearTimeout`; a `useEffect` returns the cancel function.
- `apps/web/components/dashboard/ask/demo-conversation.ts` — exports
  `createDemoConversation()` returning an `AiSdkChat` (from
  `@shadcn/helpers/ai-sdk`) with 4 user/assistant exchanges; deterministic
  (`now` pinned).
- `packages/ui/package.json` — scripts are `lint`, `format` (check exact
  set), `typecheck`. No `test`. No vitest dependency.
- Turbo: `turbo.json` has a `test` task (`dependsOn: ["^build"]`,
  `cache: false`) — a package exposing a `test` script is automatically
  included in `pnpm test` at root.

Conventions: tests in `apps/web` live in `apps/web/test/` (NOT colocated —
Next must not see them as routes); packages colocate tests next to sources.
Deterministic fixtures — never `Date.now()`/`Math.random()` in assertions.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Web tests | `pnpm turbo run test --filter=web` | all pass |
| ui tests | `pnpm turbo run test --filter=@workspace/ui` | all pass |
| Root | `pnpm test` | all packages pass |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- `apps/web/vitest.config.mts` (or `.ts`) — extend, don't rewrite
- `apps/web/package.json` (devDeps: `@testing-library/react`,
  `@testing-library/user-event`, `jsdom` — check whether `@vitejs/plugin-react`
  is needed for tsx transforms under vitest; add if compilation fails without it)
- `apps/web/test/simulated-run.test.ts` (create)
- `apps/web/test/demo-conversation.test.ts` (create)
- `apps/web/test/live-run-dialog.test.tsx` (create)
- `packages/ui/package.json`, `packages/ui/vitest.config.ts` (create),
  `packages/ui/src/components/marker.test.tsx` (create)

**Out of scope**:
- Rewriting existing tests; CI config (plan 014); E2E (plan 013).
- Testing chart components (recharts + jsdom is a tarpit — explicitly out).
- Any change to the components under test.

## Git workflow

- Branch: `advisor/012-web-test-foundation`
- Conventional commits (`test(web): …`, `test(ui): …`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Teach the web vitest config about tsx + jsdom

Extend the config: `include: ["test/**/*.test.{ts,tsx}"]` and per-file
environment via docblock rather than globally (keeps the existing node tests
untouched): component tests start with

```ts
// @vitest-environment jsdom
```

Add the devDependencies (`pnpm add -D @testing-library/react
@testing-library/user-event jsdom --filter web`).

**Verify**: `pnpm turbo run test --filter=web` → existing 59+ tests still
pass (node env untouched).

### Step 2: Test the simulated-run script and walker

`apps/web/test/simulated-run.test.ts` (node env is fine — the hook test needs
jsdom, so split: pure-script assertions here, hook test in the tsx file if
needed). `buildScript` is not exported — export it from `simulated-run.ts`
(pure function, safe) or test through the hook; PREFER exporting it with a
`/** exported for tests */` note, matching the repo's explicitness.

Cases:
1. Script starts with a `queued` patch and a `started` lifecycle entry, ends
   with a `completed` patch whose feed gains the "Run completed" entry.
2. Progress steps cover every day 1..N of the fixture curve exactly once,
   monotonically.
3. Each decision day from the fixture contributes: one `day` feed entry +
   per-security (one `signal` per signal, one `committee`, one `gate`, one
   `fill` or `no-order`).
4. With `vi.useFakeTimers()`: rendering a probe component that calls
   `useSimulatedRun().start()` (use `renderHook` from
   `@testing-library/react`) and advancing timers to the end reaches
   `status: "completed"`; calling `reset()` mid-flight then advancing all
   timers leaves state at `INITIAL` (no further patches — proves the pending
   timeout was cancelled). This one needs `// @vitest-environment jsdom`.

### Step 3: Test the Ask conversation script

`apps/web/test/demo-conversation.test.ts`: build the chat, `chat.get()` the
messages, assert: 4 user turns each followed by an assistant turn; first and
third assistant turns contain a `tool-lookup_decision` part whose output
security matches (MSFT / NVDA); every assistant turn starts with a
`reasoning` part; the fourth assistant turn contains a `data-run_card` part
with `runId: "run_8c41ca"`. (Consult `chat.get()`'s shape at runtime — it
returns `UIMessage[]`.)

### Step 4: One component smoke test

`apps/web/test/live-run-dialog.test.tsx` (`// @vitest-environment jsdom`):
render `<LiveRunDialog basePath="/demo" trigger={<button>New run</button>} />`,
`userEvent.click` the trigger, assert the dialog copy ("scripted replay")
appears; click "Start run" with fake timers, advance ~2s, assert the feed
shows "Run started". Do not assert exact pacing. If the base-ui dialog needs
a portal container or `ResizeObserver` polyfill under jsdom, add the standard
polyfill in a `test/setup.ts` wired via the vitest config `setupFiles`.

### Step 5: Give packages/ui a test script

Add vitest + jsdom + @testing-library/react to `packages/ui` devDeps, a
minimal `vitest.config.ts` (jsdom, include `src/**/*.test.tsx`), and
`"test": "vitest run"` in scripts. Seed with
`src/components/marker.test.tsx`: renders `Marker variant="separator"` with
`MarkerContent`, asserts `data-slot="marker"` and `data-variant="separator"`
land in the DOM, and the default variant omits the separator pseudos class
(assert `className` contains/omits the cva variant marker).

**Verify**: `pnpm turbo run test --filter=@workspace/ui` → passes;
`pnpm test` at root now includes the ui package.

## Test plan

This plan IS the test plan; total new tests ≥ 10 across 4 files.

## Done criteria

- [ ] `pnpm test` at root: all packages pass, including `@workspace/ui`
- [ ] `find apps/web/test packages/ui/src -name "*.test.tsx" | wc -l` ≥ 2
- [ ] Walker-cancellation case (Step 2, case 4) exists and passes
- [ ] Existing 59 web tests still pass unmodified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The vitest config filename/shape differs materially from the excerpt.
- tsx transforms fail under vitest after adding `@vitejs/plugin-react`
  (report the error; do not switch the whole suite to jsdom).
- The base-ui Dialog cannot render under jsdom after the standard
  ResizeObserver/matchMedia polyfills (drop Step 4 to a `it.todo`, report,
  and continue — the other steps stand alone).

## Maintenance notes

- The `// @vitest-environment jsdom` docblock convention keeps node tests
  fast; document it in a comment at the top of the vitest config.
- When plans 010/011 land, their touched components should gain tests here.
- Deferred: broader component coverage of the dashboard views — this plan
  builds the harness, not the coverage.
