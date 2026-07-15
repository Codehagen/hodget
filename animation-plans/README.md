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
- 022-026: decision-map audit (`apps/web/components/dashboard/decision-map`
  @xyflow/react canvas) at commit `9ceb076` (2026-07-14).
- 027-032: audit of the plain-language explainer rebuilds — Fund overview,
  Decisions, and Strategies dashboard pages — at commit `1752933` (2026-07-14).
- 033: audit of the marketing landing page (`apps/web/app/page.tsx` + its
  embedded decision-map canvas) at commit `9d9169e` (2026-07-14).
- 036: full-repo motion audit (all eight categories, `packages/ui` +
  `apps/web`) at commit `91466cd` (2026-07-15).

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
| [022](022-decision-map-node-affordance.md) | Decision-map nodes get a cursor + hover affordance | MEDIUM | Affordance | DONE |
| [023](023-decision-map-keyboard-selection.md) | Decision-map inspector follows keyboard selection | MEDIUM | Accessibility | DONE |
| [024](024-decision-map-edge-stroke-transition.md) | Active-path edges ease their stroke color on selection | LOW | Missed opportunity | DONE (shipped; DOM-reuse verified — not a no-op) |
| [025](025-decision-map-staggered-entrance.md) | Decision-map one-time staggered entrance | LOW | Missed opportunity | DONE |
| [026](026-decision-map-fitview-scale.md) | Decision-map fitView caps at 1:1 for crisp nodes | LOW | Polish | DONE |
| [027](027-equity-chart-range-morph.md) | Fund-overview chart stops replaying its draw tween on range clicks | MEDIUM | Frequency | DONE |
| [028](028-fund-overview-micro-affordances.md) | Fund-overview micro-affordances (dead transitions, focus-visible, chevron curve) | LOW | Affordance | DONE |
| [029](029-risk-budget-meter-sweep.md) | Risk-budget meter sweeps once on mount (scaleX) | MEDIUM | Missed opportunity | DONE |
| [030](030-decision-node-accent-hover.md) | Decision-map node hover preserves semantic accent rings | MEDIUM | Affordance | DONE |
| [031](031-decisions-polish.md) | Decisions polish (canvas legibility kept, rail snap, advisor crossfade) | LOW | Polish | DONE (031a kept-as-is: canvas is width-bound at 1440px) |
| [032](032-strategies-version-history-buttons.md) | Strategies version-history inline buttons get sibling hover | LOW | Cohesion | DONE |
| [033](033-landing-page-motion-fixes.md) | Landing page motion fixes (hero intro once-per-load, footer duration, canvas scroll-entrance) | MEDIUM/LOW | Frequency / Cohesion / Missed opportunity | DONE |
| [034](034-summary-tab-timeline-draw.md) | Decisions Summary tab: timeline one-time draw + Open-evidence focus ring | LOW | Missed opportunity / Accessibility | DONE |
| [035](035-waitlist-success-polish.md) | Waitlist: success-state fade + entrance idiom, no card collapse | LOW | Cohesion / Missed opportunity | DONE |
| [036](036-bulk-action-bar-motion-budget.md) | Bulk-action bar: entrance to base duration, motion-safe gate, press feedback | MEDIUM | Easing & duration / Physicality | DONE |

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

### Batch 022-026 (decision-map audit)

Five fixes to the read-only `@xyflow/react` decision-map canvas at
`apps/web/components/dashboard/decision-map`, all implemented and verified
against `/demo/runs/run_8c41cf/decisions/dec_c12f8b7a` (trade) and
`…/dec_b91e4c33` (no-trade). They are largely independent; the only coupling is
that **024, 025, and 026 share** the `.decision-map-canvas` scope class on the
ReactFlow wrapper div, and **024 + 025 share** the colocated `decision-flow.css`
stylesheet — land them together or reconcile the shared wrapper/import.

1. **022** (node affordance) — `nodes.tsx` only; independent.
2. **023** (keyboard selection) — `decision-flow.tsx` handler swap; independent.
3. **024** (edge stroke transition) — creates `decision-flow.css` + wires the
   import and `.decision-map-canvas` scope class.
4. **025** (staggered entrance) — adds a `prefers-reduced-motion` block to the
   `decision-flow.css` from 024 + per-node inline delays in `layout.ts`.
5. **026** (fitView scale) — `decision-flow.tsx` `fitViewOptions.maxZoom` + the
   `h-[640px]` on the same wrapper div 024/025 tag with the scope class.

Batch note: the original brief proposed Tailwind arbitrary selectors on the
wrapper for 024/025 (`[&_.react-flow__edge-path]:…`). Those do **not** compile —
Tailwind rewrites `_` to a space, mangling React Flow's BEM `__` class names —
so both fixes moved to a colocated `decision-flow.css` using CSS-variable
tokens. Fix 024's DOM-reuse caveat was checked in-browser (9/9 edge paths
reused across selection) and shipped, not reverted.

Every 001-012 plan carries mechanical verification (`lint`/`build`) plus a
feel check against `localhost:3000/playbook` (start with
`pnpm --filter web dev`). Plans with decision branches (006, 007, 008, 012)
allow a documented "keep as-is" outcome — that is a valid completion, not a
failure.

### Batch 027-032 (explainer-rebuild audit)

Six fixes across the plain-language explainer rebuilds of three dashboard pages —
**Fund overview** (`/demo`), **Decisions** (`/demo/decisions`), and **Strategies**
(`/demo/strategies`) — all implemented and verified in headless Chromium against
`/demo`, `/demo/decisions`, and `/demo/strategies`, both themes, zero app console
errors. Mostly independent; the couplings:

1. **027** (chart range morph) and **028b** (range-button focus-visible) edit the
   **same `<button>`** in `equity-chart.tsx` (027 the `onClick`, 028 the class) —
   land together or reconcile.
2. **029** (risk-budget sweep) adds a `risk-sweep` keyframe + `--animate-risk-sweep`
   token to `packages/ui/src/styles/globals.css`, consumed by `risk-card.tsx`.
3. **030** (node accent hover) is `nodes.tsx`-only; independent.
4. **031** touches `decisions-view.tsx` (rail snap) and `inspector.tsx` (advisor
   crossfade); **031a** (canvas height) is a documented **keep-as-is** — measurement
   showed the map is width-bound at 1440px, so raising height/padding does not
   improve legibility (reconciling the plan-026 `h-640` regression: the restyle's
   `h-480`/`padding 0.08` is the better-balanced choice at desktop widths).
5. **032** is `strategies-view.tsx`-only; independent.

Batch note — two implementation adjustments from the brief's literal form, both
because the literal form did not win the CSS cascade:

- **031c** advisor crossfade: `motion-safe:animate-fade-in` +
  `[animation-duration:var(--duration-fast)]` did not override — the
  `animate-fade-in` token's `animation` shorthand resets `animation-duration` back
  to `--duration-base` (measured 0.2s). Replaced with one explicit shorthand
  reusing the same keyframe:
  `motion-safe:[animation:fade-in_var(--duration-fast)_var(--ease-out-quart)]`
  (verified 0.15s). Same visual result, no override conflict.
- **029** risk sweep: used a CSS keyframe (not a transition-from-zero) because
  `risk-card.tsx` is a server component with no mount hook; a keyframe runs once
  on mount and never replays on re-render.

Rejected (not implemented, by design):

- **Adding explicit `ease` to the `transition-colors` hover idiom** — would drift
  from the established repo-wide hover idiom (applies to 028a, 032, and every
  sibling link). Kept the bare `transition-colors duration-[var(--duration-instant)]`.
- **Advisor weight-bar sweep on Strategies** — the bar remounts per selection, so
  a sweep would replay on a frequent interaction (frequency rule, Design.md §1/§4).
- **Refresh-button spin on Fund overview** — the button is a no-op mock; spinning
  it would imply work that isn't happening.
- **Recent-decisions expanded-detail fade** — restraint; the instant expand is the
  settled behavior (Design.md frequency rule, already noted in the card's doc
  comment).

### Plan 033 (Landing page audit)

Three fixes to the marketing landing page (`apps/web/app/page.tsx`) and the
decision-map canvas it embeds, verified in headless Chromium against `/` and
`/demo/decisions`, zero app console errors. Two new colocated client wrappers
live under `apps/web/components/landing/`:

- **033a** — hero intro plays once per full page load, never on back-nav
  (`intro-gate.tsx`). Module-scoped `played` flag read in a `useState`
  initializer (no flash, no hydration mismatch, resets on hard reload so the
  intro replays there). Flipped in a Strict-Mode-safe `useEffect`, **not** on
  `animationend` — in dev the animation finishes before hydration attaches the
  handler, so `animationend` is missed and the intro replays (measured).
- **033b** — footer link hover swapped `--duration-fast` → `--duration-instant`
  (the color-only-hover idiom).
- **033c** — landing canvas entrance defers to first view via a one-shot
  IntersectionObserver (`canvas-reveal.tsx`, threshold 0.25). `DecisionFlow`/
  `DecisionCanvas` gained an optional `entrance?: boolean` prop that renders a
  `data-entrance` gate on `.decision-map-canvas`; **omit = current behavior**, so
  `/demo/decisions` and the per-run pages are untouched (their canvas has no
  `data-entrance` attribute; decisions-view's own ancestor gate is separate). The
  suppression rule lives in a new colocated `canvas-reveal.css`, mirroring the
  `decisions-view.css` consumer-side gate. Not committed per task scope; another
  agent concurrently edited `summary-tab.tsx` / `decisions-view.css` (untouched
  here).

### Plan 034 (Decisions Summary-tab audit)

Two fixes on the Decisions **Summary** tab
(`apps/web/components/dashboard/decision-map/summary-tab.tsx`), verified in
headless Chromium against `/demo/decisions`, both themes, zero console errors:

- **034A** — the "Open evidence" link-button gains the house
  `focus-visible:ring-1 focus-visible:ring-ring/50` alongside its existing
  underline (matches `button.tsx`).
- **034B** — the "What happened next" timeline draws once on first page load
  (line `scaleX` left-to-right + staggered node fade). It reuses the page's
  existing `suppressEntrance`/`data-entrance` gate (the same one that suppresses
  the canvas entrance on swaps): keyframes are scoped under
  `.summary-timeline[data-entrance="on"]` in `decisions-view.css`, so a rail
  swap or tab return drops `animation-name` and never replays. The Summary
  `<TabsContent>` also gained `keepMounted` to stop a pre-first-swap tab-return
  from remounting and replaying. Reduced motion is `no-preference`-gated →
  static and fully visible (no `backwards`-fill flash). Not committed per task
  scope; another agent concurrently edited app/page.tsx / decision-canvas.tsx /
  decision-flow.tsx (untouched here).

### Audit 036 (full-repo motion audit, 2026-07-15 @ 91466cd)

Eight-category sweep of `packages/ui/src` + `apps/web` after batches 001-035
landed. One plan came out of it (**036**, independent, any time). Everything
else the audit surfaced, with disposition, so future audits don't re-litigate:

Flagged but **not planned** (real findings, deliberately left open):

- `packages/ui/src/components/message-scroller.tsx:112` — the jump-to-end
  button's hide transition uses a hand-typed ease-in curve
  (`cubic-bezier(0.7,0,0.84,0)` = easeInExpo) at a raw `duration-400`, and the
  same class string hand-types `cubic-bezier(0.23,1,0.32,1)` (verbatim
  `--ease-out-quint`) and `duration-200` (= `--duration-base`). Only arbitrary
  `ease-[...]` literals in the repo. MEDIUM; fix = exit to an ease-out token at
  ≤200ms + tokenize all four literals.
- `apps/web/components/dashboard/ask/ask-view.tsx` ReasoningBlock — the
  "Thought process" body conditionally remounts and refires its `fade-in`
  keyframe per toggle; a transition-based reveal would also animate the
  collapse. LOW polish.

Rejected — **conflicts with settled house posture** (do not re-flag):

- Tab-panel content fade on `TabsContent` (`packages/ui/src/components/tabs.tsx:92`)
  — Design.md §1 explicitly lists "a tab switch" in the 100+/day no-animation
  tier; the sliding indicator (plan 009) is the sanctioned motion for tabs.
- Strategies inspector fade on selection change
  (`apps/web/components/dashboard/strategies-view.tsx:1188`) — plan 017's
  documented non-goal: row-to-row selection swaps are high-frequency and stay
  instant (`runs-view.tsx:104` records the same rule for runs).

Rejected — **by design / canonical technique** (do not re-flag):

- `accordion.tsx:64` `transition-[height]` — the Base UI accordion panel idiom
  (`--accordion-panel-height`); height is the only property that encodes it.
- `drawer.tsx:125` `transition-[transform,height,opacity,filter]` — standard
  Base UI drawer resize idiom (`interpolate-size:allow-keywords`); plan 008
  already scoped its `will-change`.
- `.shimmer` animating `background-position` (`globals.css`) — unavoidable
  with `background-clip: text`; tiny live-status text only, reduced-motion
  clamped.
- Runs filter-result swap teleport — documented as intentional at
  `runs-view.tsx:104`.

Reconciliation done with this audit: Status lines in plan files 014-021
synced to this README (they still said TODO; all were shipped, 015 with its
documented STOP branch).
