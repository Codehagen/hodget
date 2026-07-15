# Plan 005 — A simulated live run on the public demo

## Goal

Make the demo actually demonstrate. Today `/demo` is a fully-mocked, statically
prerendered mirror of the dashboard: the "New run" buttons have no handlers and
nothing on the page ever moves. The product's pitch is *watching the engine
think* — a run executing, analyst signals streaming in, decisions being made —
and the demo shows none of it.

This plan wires the "New run" buttons to a **simulated run**: a dialog that
plays back a deterministic, scripted run — status flips, decision days tick by,
analyst signals / risk-gate actions / fills stream into a live feed, and real
result metrics land at the end. Entirely client-side over the existing demo
fixtures. No backend, no database, no API key; the demo pages stay statically
prerendered and the experience can never fail mid-demo.

## Why simulated (not a real engine run)

A real public run endpoint was considered (see "Considered and rejected"). The
deciding factors: production env (`DATABASE_URL`, workflow backend) is not
provisioned yet, a public write endpoint needs rate limiting, and a live demo
must never 500. The demo already discloses "Demo — mock data"; a simulated run
is consistent with that honesty. The dialog's copy says it is a scripted
replay.

## Design

### Event vocabulary mirrors the real wire contract

The simulation's event stream is shaped after the engine's real artifacts — the
`RunEvent` lifecycle (`started → progress → analyst → completed`) plus the
decision detail the ledger actually persists (committee views, gate actions,
fills). Swapping the script for a real `EventSource` on `/api/runs/[id]/events`
later is a data-source change, not a UI rewrite.

### Script derived from fixtures, not invented

`components/dashboard/live-run/simulated-run.ts` builds the script from the
existing fixtures: a completed `earnings-drift` run from `ALL_RUNS` provides
the equity curve (60 trading days) and metrics via `getRunDetail`, and
`DECISIONS_BY_STRATEGY` provides the curated decision days (signals, committee
weights, gates, fills). Because the simulated run **is** one of the fixture
runs, the completion state links to that run's real (static) detail page under
`/demo/runs/[id]` — the simulation feeds into the guided path through the rest
of the demo.

Pacing: the day counter sweeps the curve at ~10 days/s with a progress bar;
the sweep pauses at each decision day while that day's events stream into the
feed one at a time. Total ≈ 8 seconds. A `useSimulatedRun` hook owns the
timeline (single scheduled-timeout walker, cancelled on unmount/close/reset).

### UI

- **`packages/ui/src/components/message-scroller.tsx`** — shadcn's Base UI
  `message-scroller` (added via the shadcn CLI, which adapts it to the house
  conventions): a stick-to-bottom auto-scrolling feed that pins to the newest
  entry while streaming, releases when the user scrolls up, and shows a
  floating jump-to-end button. Dependency: `@shadcn/react`. Chosen over AI
  Elements' `Conversation` because the ui package is already on
  `@base-ui/react` and the CLI output needs no restyling.
- **`components/dashboard/live-run/live-run-dialog.tsx`** — client component
  wrapping the existing "New run" buttons (`DialogTrigger asChild`). Three
  phases:
  1. **Idle** — what will happen, honest "scripted replay of a recorded run"
     framing, Run button.
  2. **Running** — status badge, day counter + date + progress bar, equity so
     far, and the `Conversation` feed of analyst/gate/fill events.
  3. **Done** — metrics (`Stat` primitives: Sharpe, CAGR, max drawdown, hit
     rate, turnover), decision count, "Run again" and "View full run →" (links
     to the fixture run's detail page under the current surface's base path).
- Wire-up: `DashboardView` and `RunsView` wrap their inert "New run" buttons
  with the dialog. Both surfaces (`/demo`, `/dashboard`) get it — the dashboard
  is fixture-backed today too and carries its own "sample data" badge.

### What stays untouched

- No new routes, no `lib/dal` changes, no schema changes.
- Demo pages remain `dynamicParams = false` static prerenders — the dialog
  renders nothing until clicked, and the script is deterministic (no
  `Date.now`/`Math.random` in render paths).

## Steps

1. `packages/ui`: add `conversation.tsx` + `use-stick-to-bottom` dependency.
2. `components/dashboard/live-run/simulated-run.ts`: event/script types,
   fixture-derived script builder, `useSimulatedRun` hook.
3. `components/dashboard/live-run/live-run-dialog.tsx`: the three-phase dialog.
4. Wire the "New run" buttons in `dashboard-view.tsx` and `runs-view.tsx`.
5. Verify: web tests, lint (`--max-warnings 0`), typecheck, and a manual
   click-through on `/demo` (and `/demo/runs`) in dev.

## Considered and rejected

- **A real public run endpoint** (sentinel demo owner, DB-backed rate caps,
  public SSE). The full pipeline exists behind auth and this would exercise it
  honestly — but it depends on prod env that is not provisioned yet, adds a
  public write surface that needs abuse protection, and can fail during a live
  demo. Revisit once env is wired; the dialog's data source is the only seam
  that changes.
- **Rendering simulated runs into the demo runs table.** The tables are
  build-time fixtures; mixing in client-side rows forces the surface dynamic
  and creates two sources of truth. The dialog is the live surface.
- **`setInterval` ticking per day.** A single self-rescheduling timeout walking
  a precomputed script is simpler to cancel and cannot drift or overlap.
