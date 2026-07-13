# Animation plans

Output of an `improve-animations` audit of `packages/ui` + `apps/web/app/playbook`
at commit `ba46291` (2026-07-13). Each plan is self-contained — an executor
needs no other context. Engine/architecture plans live in `plans/`; this
directory is motion-only.

## Plans

| # | Title | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| [001](001-charts-reduced-motion.md) | Gate Recharts animations on prefers-reduced-motion | HIGH | Accessibility | TODO |
| [002](002-scope-transition-all.md) | Replace transition-all with scoped properties | HIGH | Performance | TODO |
| [003](003-drawer-reduced-motion-fade.md) | Drawer fades instead of teleporting under reduced motion | MEDIUM | Accessibility | TODO |
| [004](004-dialog-transition-idiom.md) | Migrate dialogs to the Base UI transition idiom | MEDIUM | Cohesion | TODO |
| [005](005-duration-easing-tokens.md) | Route every duration/easing through tokens | MEDIUM | Cohesion | TODO |
| [006](006-sidebar-layout-transforms.md) | Stop animating layout properties (sidebar, filter-pill) | MEDIUM | Performance | TODO |
| [007](007-tooltip-instant-in-group.md) | Tooltips instant after the first in a group | LOW | Purpose | TODO |
| [008](008-drawer-will-change.md) | Scope drawer will-change to active motion | LOW | Performance | TODO |
| [009](009-tabs-sliding-indicator.md) | Sliding tabs indicator | LOW | Opportunity | TODO |
| [010](010-accordion-chevron-rotate.md) | Rotating accordion chevron | LOW | Opportunity | TODO |
| [011](011-checkbox-draw-stroke.md) | Checkbox check drawn via draw-stroke keyframe | LOW | Opportunity | TODO |
| [012](012-score-ring-sweep.md) | ScoreRing sweeps to its value | LOW | Opportunity | TODO |

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

Every plan carries mechanical verification (`lint`/`build`) plus a feel check
against `localhost:3000/playbook` (start with `pnpm --filter web dev`). Plans
with decision branches (006, 007, 008, 012) allow a documented "keep as-is"
outcome — that is a valid completion, not a failure.
