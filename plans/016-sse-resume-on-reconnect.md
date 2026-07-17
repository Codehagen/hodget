# Plan 016: Make SSE reconnects resume instead of replaying the whole run, and test the durable route branch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat bb1ee76..HEAD -- apps/web/lib/run-events-sse.ts "apps/web/app/api/runs/[id]/events/route.ts" apps/web/components/dashboard/live-run/real-run.ts apps/web/test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `bb1ee76`, 2026-07-17

## Why this matters

The New-run dialog streams live run progress over Server-Sent Events. The
client deliberately lets the browser's native `EventSource` auto-reconnect on
transient drops (idle proxy timeouts, network blips). But the server emits SSE
frames with **no `id:` field** and never reads the `Last-Event-ID` request
header, and the client reconnect URL carries no `startIndex` — so every
reconnect replays the durable stream **from index 0**. The client's feed
appender has no dedup, so after any mid-run blip the user sees a second "Run
started" marker and every prior day-tick/analyst line duplicated for the rest
of the run. The fix is the standard SSE resume contract: number each frame
with `id:`, honor `Last-Event-ID` on the server, and the browser does the rest
— no client change needed. This plan also adds the missing tests for the
durable route branch (its `startIndex` clamp and fallback behavior currently
have zero coverage).

## Current state

Files:

- `apps/web/lib/run-events-sse.ts` — pure transform from a durable
  `ReadableStream<RunEvent>` to an SSE byte stream. Frames are written as
  `data: <json>\n\n` with no `id:` field (lines 65, 70, 94).
- `apps/web/app/api/runs/[id]/events/route.ts` — the SSE route. Durable branch
  (lines 41–63) parses a `startIndex` **query param** only; it never reads the
  `Last-Event-ID` header. A bare `catch {}` (line 59) falls through to the
  legacy stream.
- `apps/web/components/dashboard/live-run/real-run.ts` — the client hook.
  `openStream` (lines 327–342) creates `EventSource('/api/runs/${runId}/events')`
  and relies on native auto-reconnect; `appendFeed` (lines 105–108) has no
  dedup. **This file needs no change** — native `EventSource` automatically
  sends `Last-Event-ID` on reconnect once the server stamps frame ids.
- `apps/web/test/run-events-sse.test.ts` — unit tests for the transform
  (frame-shape, terminal-close, fallback cases). Mocks `@/lib/dal` to just
  `isTerminal`.
- `apps/web/test/api-auth.test.ts` — route-handler tests; the only events-route
  behavior test exercises the legacy path (mocked runs carry no
  `workflowRunId`). Mocks `@/lib/session` and `@/lib/dal` wholesale (see its
  lines 1–35 for the pattern).

Key excerpts as of `bb1ee76`:

`apps/web/lib/run-events-sse.ts:70` (the frame writer, one of three enqueue sites):

```ts
controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
```

`apps/web/app/api/runs/[id]/events/route.ts:41-49` (durable branch):

```ts
if (run.workflowRunId) {
  try {
    const startIndexParam = new URL(request.url).searchParams.get("startIndex")
    const parsed = startIndexParam !== null ? Number.parseInt(startIndexParam, 10) : 0
    // Clamp to a non-negative integer: a negative startIndex reaches WDK's
    // getReadable where it means "last N", not "from N", and a non-numeric param
    // parses to NaN. Either would silently change replay semantics, so floor to 0.
    const startIndex = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    const source = getRun(run.workflowRunId).getReadable<RunEvent>({ startIndex })
```

`apps/web/components/dashboard/live-run/real-run.ts:334-339` (why reconnects happen silently):

```ts
es.onerror = () => {
  // Native EventSource auto-reconnects on transient drops (idle proxy
  // timeouts, network blips). Only act once the browser has actually given
  // up (readyState CLOSED); otherwise let auto-reconnect proceed.
  if (es.readyState === EVENT_SOURCE_CLOSED) void handleStreamError(epoch)
}
```

Conventions that apply:

- `run-events-sse.ts` is deliberately **pure and runtime-agnostic** (no
  workflow imports) so it unit-tests against a stubbed stream — keep it that
  way; thread the starting index in as an option.
- Comments in this codebase state constraints, not narration — match the
  existing density and style (see the clamp comment above).
- Web unit tests live in `apps/web/test/`, never under `app/`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter web typecheck` | exit 0 |
| Web tests | `pnpm --filter web test` | all pass |
| Lint | `pnpm --filter web lint` | exit 0 (`--max-warnings 0` is already in the script) |
| Full gate | `pnpm typecheck && pnpm lint && pnpm test` | all green |

## Scope

**In scope** (the only files you should modify):
- `apps/web/lib/run-events-sse.ts`
- `apps/web/app/api/runs/[id]/events/route.ts`
- `apps/web/test/run-events-sse.test.ts`
- `apps/web/test/api-auth.test.ts` (extend) — or a new
  `apps/web/test/run-events-route.test.ts` if the durable-branch tests read
  better standalone
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `apps/web/components/dashboard/live-run/real-run.ts` — the client needs no
  change; native `EventSource` sends `Last-Event-ID` automatically. Do not add
  client-side dedup — the server-side resume makes it unnecessary.
- `apps/web/workflows/execute-run.ts` and `apps/web/lib/dal/run-workflow.ts` —
  event *production* is untouched; this plan only changes delivery framing.
- The legacy in-process path's event semantics (`legacyEventStream`) — it has
  no replay-from-history (live emitter only + terminal replay), so it does not
  duplicate on reconnect. Leave its frames without `id:`.

## Git workflow

- Branch: `advisor/016-sse-resume-on-reconnect`
- Conventional commits, e.g. `fix(web): resume SSE from Last-Event-ID instead of replaying the run`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Stamp frame indices in `sseFromRunEvents`

In `apps/web/lib/run-events-sse.ts`, extend `SseFromRunEventsOptions` with an
optional `startIndex?: number` (default 0) and keep a frame counter starting
there. Write every frame as:

```
id: <index>\ndata: <json>\n\n
```

incrementing per frame. All three enqueue sites get the id: the normal frame
(line 70), the end-without-terminal fallback (line 65), and the error-path
fallback (line 94). The id must equal the durable-stream index of that event
(i.e. the first frame after `getReadable({ startIndex: N })` carries `id: N`),
so a reconnecting client's `Last-Event-ID` maps directly back onto WDK's
`startIndex` semantics. Document that contract in the function's JSDoc.

**Verify**: `pnpm --filter web typecheck` → exit 0.

### Step 2: Honor `Last-Event-ID` in the route

In `apps/web/app/api/runs/[id]/events/route.ts`, compute the resume point as
(in priority order): `Last-Event-ID` header + 1 if present and parseable,
else the `startIndex` query param, else 0 — reusing the existing
finite/non-negative clamp for both sources. Pass the resolved index both to
`getReadable({ startIndex })` and to `sseFromRunEvents` as
`options.startIndex` so frame ids stay aligned with stream indices. Keep the
existing clamp comment and extend it to name the header.

**Verify**: `pnpm --filter web typecheck && pnpm --filter web lint` → exit 0.

### Step 3: Unit tests for the id contract

In `apps/web/test/run-events-sse.test.ts` (model on the existing `drain` /
`frames` helpers), add:

- frames carry sequential `id:` lines starting at `startIndex` (assert exact
  bytes for one frame, e.g. `id: 3\ndata: {...}\n\n`),
- default `startIndex` is 0,
- the end-without-terminal fallback frame carries the next index.

**Verify**: `pnpm --filter web test -- run-events-sse` → all pass, including
the new cases.

### Step 4: Route tests for the durable branch (previously zero coverage)

Extend `apps/web/test/api-auth.test.ts` (or a new
`apps/web/test/run-events-route.test.ts` following the same mock pattern —
mock `@/lib/session`, `@/lib/dal`, and now also `workflow/api`'s `getRun`).
Cover, with a mocked run whose `workflowRunId` is set:

- happy path: `getReadable` called with the clamped index; response frames
  match the stubbed events;
- `Last-Event-ID: 7` header → `getReadable({ startIndex: 8 })`;
- `?startIndex=` table: `-5`, `NaN`/non-numeric, `"3"`, absent → clamped to
  `0 / 0 / 3 / 0` (header absent);
- header takes precedence over the query param;
- `getRun` throwing → falls through to the legacy stream (assert the response
  still returns 200 with the persisted-terminal replay, and — see plan-011
  maintenance notes — this masks durable failures, so also assert nothing
  else broke);
- `onEndWithoutTerminal`: source ends with no terminal → the persisted-status
  fallback frame is emitted.

**Verify**: `pnpm --filter web test` → all pass.

### Step 5: Full gate + index

Run the full gate; update this plan's row in `plans/README.md`.

**Verify**: `pnpm typecheck && pnpm lint && pnpm test` → all green.

## Test plan

Covered by steps 3–4. Structural patterns: `apps/web/test/run-events-sse.test.ts`
for the transform, `apps/web/test/api-auth.test.ts:28-60` for route mocking.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck && pnpm lint && pnpm test` all exit 0
- [ ] `grep -n 'id: ' apps/web/lib/run-events-sse.ts` shows the id-stamped frame writer
- [ ] `grep -in 'last-event-id' "apps/web/app/api/runs/[id]/events/route.ts"` returns a match
- [ ] New tests exist for: frame ids, header precedence, startIndex clamp table, getRun-throws fallback
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts above don't match the live code (drift since `bb1ee76`).
- WDK's `getReadable({ startIndex })` turns out not to be index-addressable
  per event (i.e. the durable stream has no stable per-event index) — the
  id contract in step 1 would then be built on sand.
- Making the tests pass appears to require changing `real-run.ts` or the
  event-producer files listed as out of scope.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The id/startIndex alignment is a cross-file contract between the route and
  `sseFromRunEvents` — a reviewer should check the "first frame after
  `startIndex: N` carries `id: N`" invariant in both places.
- Plan 011's open investigate item (WDK step-retry writing duplicate events
  into the durable stream itself) is *not* fixed by this plan — resume only
  prevents client-reconnect replay. If retry-duplication is later confirmed,
  dedup belongs at the producer, not here.
- If the run dialog ever adds a "resume viewing a running run" entry point
  (opening the stream late by choice), it should pass `?startIndex=0`
  explicitly to request the full replay — that's now the documented meaning.
