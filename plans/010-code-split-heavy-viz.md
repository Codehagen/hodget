# Plan 010: Code-split the heavy viz libraries and make DashboardView a server component

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- apps/web/components/landing/canvas-reveal.tsx apps/web/components/dashboard/dashboard-view.tsx apps/web/components/dashboard/equity-chart.tsx apps/web/components/dashboard/run-equity-chart.tsx apps/web/components/dashboard/analysts apps/web/app/page.tsx apps/web/app/demo/page.tsx apps/web/app/dashboard/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (dynamic imports) / MED (server-ifying DashboardView — do it last, verify per step)
- **Depends on**: none (007 recommended first so lint is a usable gate)
- **Category**: perf
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

Nothing in the app is code-split (`grep -rn "next/dynamic" apps/web` → zero
matches). Concretely: the marketing landing page (`/`) statically pulls
`@xyflow/react` (~100KB+ gz + CSS) for a decision-map canvas that sits below
the fold; every dashboard/demo route that shows a chart pulls the full
recharts barrel; and `DashboardView` is a client component for the sake of
one `usePathname()` call and one `useState`, dragging seven otherwise-server
cards and their 102KB fixture module into the client bundle. First-load JS on
the most latency-sensitive routes pays for all of it.

## Current state

- `apps/web/app/page.tsx:13` — imports `CanvasReveal`.
- `apps/web/components/landing/canvas-reveal.tsx:1,8` — `"use client"`;
  statically imports `DecisionCanvas`; holds a `revealed` IntersectionObserver
  state that currently only gates the entrance *animation*:
  ```ts
  import { DecisionCanvas } from "@/components/dashboard/decision-map/decision-canvas"
  ```
- `apps/web/components/dashboard/decision-map/decision-flow.tsx:3,13` —
  imports `@xyflow/react` and its `base.css` (reached via `DecisionCanvas`).
- `apps/web/components/dashboard/equity-chart.tsx:1` — `"use client"`,
  `import { Area, AreaChart, ... } from "recharts"`; used by
  `fund-monitor/what-changed-card.tsx`. Similar barrels in
  `run-equity-chart.tsx:1-12` and `analysts/signal-behavior-chart.tsx:3`.
- `apps/web/components/dashboard/dashboard-view.tsx:1,54-58`:
  ```ts
  "use client"
  ...
  const pathname = usePathname()
  const basePath = pathname?.startsWith("/demo") ? "/demo" : "/dashboard"
  const [portfolio, setPortfolio] = React.useState<string>(PORTFOLIOS[0])
  ```
  Interactive pieces: the portfolio `Select`, the Refresh icon button, and
  `LiveRunDialog` (already its own client component). The seven cards it
  renders (`WhatChangedCard`, `AttentionPanel`, `PositionsCard`, `RiskCard`,
  `EngineOpsCard`, `RecentDecisionsCard`, `SystemTrustCard`) have no
  `"use client"` of their own.
- Callers: `apps/web/app/demo/page.tsx` renders `<DashboardView data={DEMO_DASHBOARD} />`;
  `apps/web/app/dashboard/page.tsx` the same plus a `notice` prop.

Conventions: Design.md §7 recharts contract (`isAnimationActive` from
`useChartAnimation` + chart root keyed on it) must survive untouched inside
the chart components; only the import boundary changes. Skeleton fallbacks
use `@workspace/ui/components/skeleton`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build with route sizes | `cd apps/web && pnpm build` | exit 0; note "First Load JS" per route |
| Typecheck | `pnpm turbo run typecheck --filter=web` | exit 0 |
| Tests | `pnpm turbo run test --filter=web` | all pass |
| Lint | `cd apps/web && pnpm lint` | exit 0 (after plan 007) |

Record the "First Load JS" for `/`, `/demo`, `/demo/decisions` from a build
BEFORE any change — the done criteria compare against it.

## Scope

**In scope**:
- `apps/web/components/landing/canvas-reveal.tsx`
- `apps/web/components/dashboard/fund-monitor/what-changed-card.tsx` (chart import only)
- `apps/web/components/dashboard/run-detail-view.tsx` / wherever `RunEquityChart` is imported (find with grep)
- `apps/web/components/dashboard/analysts/analysts-view.tsx` or wherever `SignalBehaviorChart` is imported
- `apps/web/components/dashboard/decision-map/decisions-view.tsx` (canvas import only)
- `apps/web/components/dashboard/dashboard-view.tsx` (+ a new small client component for its header controls)
- `apps/web/app/demo/page.tsx`, `apps/web/app/dashboard/page.tsx` (pass `basePath`)

**Out of scope**:
- The internals of any chart or canvas component (the recharts contract, the
  React Flow config) — only their import sites change.
- `demo-data.ts` restructuring (separate finding, not selected).
- The `/playbook` gallery.

## Git workflow

- Branch: `advisor/010-code-split-heavy-viz`
- One commit per step; conventional commits (`perf(web): …`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the baseline

`cd apps/web && pnpm build` and copy the route table (at minimum `/`,
`/demo`, `/demo/decisions`, `/demo/runs/[id]`) into the PR description /
report.

### Step 2: Lazy-load the decision canvas on the landing page

In `canvas-reveal.tsx`, replace the static `DecisionCanvas` import with:

```ts
import dynamic from "next/dynamic"

const DecisionCanvas = dynamic(
  () => import("@/components/dashboard/decision-map/decision-canvas").then(m => m.DecisionCanvas),
  { ssr: false, loading: () => <div className="h-[420px] w-full animate-pulse bg-muted/40" aria-hidden /> },
)
```

Match the placeholder height to whatever height the canvas container already
uses in this file (read it; do not guess). The component's existing
IntersectionObserver `revealed` state keeps working unchanged — with
`ssr:false` the chunk loads on the client after hydration, off the critical
path.

**Verify**: `pnpm build` → `/` First Load JS drops materially (expect ≥80KB);
`@xyflow` no longer appears in the `/` route's chunk list.

### Step 3: Lazy-load the three recharts components at their import sites

For each import site found via:
`grep -rn "from \"./equity-chart\"\|from \"../equity-chart\"\|RunEquityChart\|SignalBehaviorChart" apps/web/components --include='*.tsx'`

replace the static import with a `next/dynamic` import (same pattern as
Step 2, `ssr: false`, skeleton sized to the chart's rendered height). The
decision canvas import inside `decisions-view.tsx` gets the same treatment.
Keep prop types by importing types with `import type`.

**Verify**: `pnpm build` → exit 0; `/demo` and `/demo/decisions` First Load
JS reduced vs baseline. Click through `/demo` and `/demo/decisions` in a
browser/dev server: charts and canvas appear (after a skeleton flash), no
hydration errors in the console.

### Step 4: Make DashboardView a server component

1. Create `apps/web/components/dashboard/dashboard-header-controls.tsx`
   (`"use client"`): the portfolio `Select` + its `useState`, the Refresh
   button, and the `LiveRunDialog` wrapper with its trigger button — exactly
   the JSX currently in DashboardView's header actions div. Props:
   `{ basePath: string }`.
2. In `dashboard-view.tsx`: remove `"use client"`, `usePathname`, and the
   `useState`; add `basePath: string` to its props; render
   `<DashboardHeaderControls basePath={basePath} />` where the controls were.
3. Update both callers to pass `basePath="/demo"` / `basePath="/dashboard"`.
4. Check each of the seven cards still compiles as a server component (they
   should — none has hooks). If one fails because of a hook, leave THAT card
   as a client leaf (add `"use client"` to it) rather than reverting the view.

**Verify**:
- `pnpm turbo run typecheck --filter=web` → exit 0
- `pnpm build` → `/demo` First Load JS drops again vs Step 3
- Load `/demo`: portfolio select works, New run dialog opens and replays,
  theme toggle unaffected.

### Step 5: Full verification

`pnpm turbo run typecheck test --filter=web && cd apps/web && pnpm lint && pnpm build`
→ all green. Record the final route table next to the Step 1 baseline.

## Test plan

No new unit tests (import-boundary refactor). The manual gate is the
click-through in Steps 3-4 plus the build-size table. If the repo's headless
browse tooling is available, screenshot `/demo` before/after for the PR.

## Done criteria

- [ ] `grep -rn "next/dynamic" apps/web/components | wc -l` ≥ 5
- [ ] `/` First Load JS reduced ≥ 60KB vs recorded baseline
- [ ] `/demo` First Load JS reduced vs baseline (charts + client-tree savings)
- [ ] `grep -n '"use client"' apps/web/components/dashboard/dashboard-view.tsx` → no match
- [ ] typecheck, tests, lint, build all exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- A dynamically-imported chart renders blank after the skeleton (suspect the
  Design.md §7 remount-key contract — do NOT modify the chart internals;
  report).
- Server-ifying DashboardView surfaces a hook in more than two of the seven
  cards (the plan's premise is wrong; report instead of sprinkling
  `"use client"`).
- Build sizes do not move after Step 2 (the chunk graph differs from the
  plan's model; report with the build output).

## Maintenance notes

- New chart/canvas usage should follow the dynamic-import pattern; consider a
  shared `components/dashboard/lazy.tsx` if a third viz library ever lands.
- When the dashboard gets real data (direction work), `DashboardView` being a
  server component is exactly what lets it fetch via the DAL directly —
  preserve that property.
- Deferred deliberately: splitting `demo-data.ts` by domain (audit finding
  DEBT-01) would compound these wins; not in scope here.
