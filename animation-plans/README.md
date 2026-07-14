# Animation plans

Output of `improve-animations` audits. Each plan is self-contained — an
executor needs no other context. Engine/architecture plans live in `plans/`;
this directory is motion-only.

Audit provenance:

- 001-012: audit of `packages/ui` + `apps/web/app/playbook` at commit
  `ba46291` (2026-07-13).
- 013-021: audit of the dashboard refresh
  (`apps/web/components/dashboard` + ui primitives) at commit `2526020`
  (2026-07-14).

## Plans

| # | Title | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| [001](001-charts-reduced-motion.md) | Gate Recharts animations on prefers-reduced-motion | HIGH | Accessibility | DONE |
| [002](002-scope-transition-all.md) | Replace transition-all with scoped properties | HIGH | Performance | DONE |
| [003](003-drawer-reduced-motion-fade.md) | Drawer fades instead of teleporting under reduced motion | MEDIUM | Accessibility | DONE |
| [004](004-dialog-transition-idiom.md) | Migrate dialogs to the Base UI transition idiom | MEDIUM | Cohesion | DONE |
| [005](005-duration-easing-tokens.md) | Route every duration/easing through tokens | MEDIUM | Cohesion | DONE |
| [006](006-sidebar-layout-transforms.md) | Stop animating layout properties (sidebar, filter-pill) | MEDIUM | Performance | DONE |
| [007](007-tooltip-instant-in-group.md) | Tooltips instant after the first in a group | LOW | Purpose | DONE |
| [008](008-drawer-will-change.md) | Scope drawer will-change to active motion | LOW | Performance | DONE |
| [009](009-tabs-sliding-indicator.md) | Sliding tabs indicator | LOW | Opportunity | DONE |
| [010](010-accordion-chevron-rotate.md) | Rotating accordion chevron | LOW | Opportunity | DONE |
| [011](011-checkbox-draw-stroke.md) | Checkbox check drawn via draw-stroke keyframe | LOW | Opportunity | DONE |
| [012](012-score-ring-sweep.md) | ScoreRing sweeps to its value | LOW | Opportunity | DONE |
| [013](013-tokenize-recharts-series-animation.md) | Tokenize Recharts series animation duration and easing | HIGH | Easing & duration | DONE |
| [014](014-tokenize-ui-primitive-transitions.md) | Tokenize transitions on ui primitives (tabs, select, button, badge) | MEDIUM | Cohesion & tokens | DONE |
| [015](015-progress-fills-scalex.md) | Progress fills animate scaleX, not width | MEDIUM | Performance | DONE (run-progress half; progress.tsx half STOPPED — Base UI Indicator exposes only inline width, no ratio for scaleX) |
| [016](016-stage-stepper-state-transitions.md) | Stage stepper transitions its state flips | MEDIUM | Missed opportunity | DONE |
| [017](017-runs-inspector-entrance-fade.md) | Runs inspector entrance fade | MEDIUM | Missed opportunity | DONE |
| [018](018-attribution-toggle-crossfade.md) | Attribution mode toggle crossfade | LOW | Missed opportunity | DONE |
| [019](019-attention-panel-focus-visible.md) | Attention panel rows get house focus-visible treatment | LOW | Accessibility | DONE |
| [020](020-reduced-motion-posture-sweep.md) | Drop motion-reduce:transition-none from color-only transitions | LOW | Cohesion | DONE |
| [021](021-strategies-view-shared-table-row.md) | Converge strategies-view rows onto shared TableRow | LOW | Cohesion | DONE |

## Recommended execution order & dependencies

1. **002** (transition-all) — touches the same class strings as several later
   plans; landing it first minimizes conflicts.
2. **005** (tokens) — depends on 002 being done (002 owns *which* properties
   transition; 005 owns durations/easings on them). Also touches checkbox.tsx,
   which 011 extends afterwards.
3. **004** (dialog idiom) — independent of 002/005 in files, but its
   reduced-motion step interacts with **003**: run 003 and 004 in either order,
   whichever runs second must reconcile the shared globals.css re-opt-in rule
   (each plan documents this).
4. **001** (charts) — independent; can run any time.
5. **003** (drawer reduced motion) — see 004 note.
6. **006** (layout transforms) — after 002/005 (sidebar class strings overlap).
7. **010, 012** — small, independent; any time after 005.
8. **011** (checkbox draw) — after 005 (extends the same Root transition).
9. **009** (tabs indicator) — after 002 (tabs.tsx class strings overlap).
10. **007, 008** — independent polish; last.

### Batch 013-021 (dashboard refresh audit)

1. **013** (Recharts tokens) — first; highest feel impact of the batch and
   fully independent.
2. **015** (progress scaleX) — next; its two halves (progress.tsx +
   run-progress.tsx) are a matched pair and must land together.
3. **014** (ui primitive tokens) — before 020/021, since all three touch
   tab/table-adjacent class strings; 014 owns the `packages/ui` side.
4. **016, 017, 018, 019** — independent of everything; any order, any time.
   (019 and 020 edit the same two class strings in attention-panel.tsx —
   either order works, each plan documents the interaction.)
5. **020** (reduced-motion sweep) — after 014; before 021.
6. **021** (strategies-view TableRow) — **depends on 020**: both rewrite the
   same row class string in `strategies-view.tsx` (020 deletes a token from
   it, 021 replaces the string wholesale). Run 021 last, after 014 and 020.

Batch 013-021 plans carry mechanical verification (`pnpm turbo typecheck`)
plus a feel check against `localhost:3000/demo` (start with
`pnpm --filter web dev`); 014 also glances at `localhost:3000/playbook`.
Plan 015 has a documented STOP branch on the Base UI progress primitive —
landing only the run-progress half with a report is a valid completion.

Every 001-012 plan carries mechanical verification (`lint`/`build`) plus a
feel check against `localhost:3000/playbook` (start with
`pnpm --filter web dev`). Plans with decision branches (006, 007, 008, 012)
allow a documented "keep as-is" outcome — that is a valid completion, not a
failure.
