# 020 — Reduced-motion posture sweep: drop motion-reduce on color-only transitions

- **Status**: TODO
- **Commit**: 2526020
- **Severity**: LOW
- **Category**: Cohesion
- **Estimated scope**: 5 files under apps/web/components/dashboard, 6 class-string deletions

## Problem

The repo's reduced-motion posture is a global allowlist, not a blanket kill.
`packages/ui/src/styles/globals.css:273-282`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-property: color, background-color, border-color, outline-color,
      text-decoration-color, fill, stroke, opacity, box-shadow !important;
    scroll-behavior: auto !important;
  }
  ...
}
```

Keyframes are flattened, but transitions are deliberately **restricted to
color/opacity properties rather than zeroed** — "opacity/color feedback that
aids comprehension keeps running, while transform/translate/width/height
changes snap" (Design.md §11). The dashboard's own copy-button documents this
posture explicitly:

```tsx
// apps/web/components/dashboard/run-detail/copy-button.tsx:13-15 — the documented posture
 * Copying is a rare, pointer-initiated action, so a short color/icon swap is the
 * right amount of feedback — the icon change is instant (no transform), keeping
 * it within the reduced-motion allowlist by default.
```

Yet `motion-reduce:transition-none` is sprinkled on SOME color-only
transitions in the dashboard. That contradicts the allowlist: under reduced
motion, those elements' hover tints snap while identical elements elsewhere
(e.g. `run-history-table`'s rows via `table.tsx:63`, `runs-view.tsx`'s
pagination buttons at :62/:75/:90 — all color-only, no `motion-reduce:`) keep
easing. Same-pattern elements diverge under reduced motion for no reason.

All current occurrences of `motion-reduce:transition-none` under
`apps/web/components/dashboard/**` (grepped at commit 2526020):

| # | Location | Transition list | Verdict |
|---|---|---|---|
| 1 | `apps/web/components/dashboard/equity-chart.tsx:120` | `transition-colors` | **remove** |
| 2 | `apps/web/components/dashboard/strategies-view.tsx:145` | `transition-colors` | **remove** |
| 3 | `apps/web/components/dashboard/fund-monitor/attention-panel.tsx:38` | `transition-colors` | **remove** |
| 4 | `apps/web/components/dashboard/fund-monitor/attention-panel.tsx:117` | `transition-colors` | **remove** |
| 5 | `apps/web/components/dashboard/fund-monitor/attribution-card.tsx:84` | `transition-colors` | **remove** |
| 6 | `apps/web/components/dashboard/runs/runs-toolbar.tsx:63` | `transition-colors` | **remove** |
| 7 | `apps/web/components/dashboard/runs/run-progress.tsx:52` | `transition-[width]` | **keep** (width is movement; see note) |

Verbatim current strings for the six removals:

```tsx
// equity-chart.tsx:120
"px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums transition-colors duration-[var(--duration-instant)] motion-reduce:transition-none",

// strategies-view.tsx:145
"cursor-pointer border-b border-border outline-none transition-colors duration-[var(--duration-instant)] last:border-b-0 motion-reduce:transition-none",

// fund-monitor/attention-panel.tsx:38
className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 motion-reduce:transition-none"

// fund-monitor/attention-panel.tsx:117
className="flex min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 motion-reduce:transition-none"

// fund-monitor/attribution-card.tsx:84
"px-2 py-0.5 text-[11px] font-medium transition-colors duration-[var(--duration-instant)] motion-reduce:transition-none",

// runs/runs-toolbar.tsx:63
"inline-flex h-full items-center px-3 text-xs font-medium transition-colors duration-[var(--duration-instant)] motion-reduce:transition-none",
```

## Target

Delete the ` motion-reduce:transition-none` token (and its leading space)
from occurrences 1-6. Nothing else in those strings changes.

Keep it wherever the transition list includes movement properties
(transform/width/height/stroke-dashoffset). In-scope that means:

- `runs/run-progress.tsx:52` (`transition-[width]`) — keep. **Exception:** if
  plan 015 has already landed, this line has been rewritten to
  `transition-transform` without the variant — that is correct too; skip it.

Out of scope but correct as-is (do not touch): `packages/ui` occurrences
where the variant guards movement — `tabs.tsx:65` (`transition-transform`
indicator), `score-meter.tsx:167` (`transition-[stroke-dashoffset]`),
`accordion.tsx:47` and `tree.tsx:364` (`transition-transform` chevrons).

## Repo conventions to follow

- The posture rule (Design.md §11): color/opacity transitions need NO
  `motion-reduce:` variant — the global allowlist keeps them; movement
  transitions are auto-stripped by the same allowlist, and an explicit
  `motion-reduce:transition-none` on them is acceptable belt-and-braces
  documentation of intent.
- Exemplar of the correct default (no variant on a color-only transition):
  `packages/ui/src/components/table.tsx:63` —
  `"group border-b border-border transition-colors duration-[var(--duration-instant)]"`.

## Steps

1. Remove ` motion-reduce:transition-none` from
   `apps/web/components/dashboard/equity-chart.tsx:120`.
2. Remove it from `apps/web/components/dashboard/strategies-view.tsx:145`.
   (Coordinate: plan 021 rewrites this same class string — see Boundaries.)
3. Remove it from
   `apps/web/components/dashboard/fund-monitor/attention-panel.tsx:38`
   and `:117`. (Plan 019 adds focus-visible classes to these same strings —
   either order works; just re-grep before editing.)
4. Remove it from
   `apps/web/components/dashboard/fund-monitor/attribution-card.tsx:84`.
5. Remove it from
   `apps/web/components/dashboard/runs/runs-toolbar.tsx:63`.
6. Re-run the grep to confirm the final state:
   `grep -rn "motion-reduce:transition-none" apps/web/components/dashboard/`
   should return only `runs/run-progress.tsx` (or nothing, if plan 015
   landed first).

## Boundaries

- Scope is `apps/web/components/dashboard/**` only. Do NOT touch
  `packages/ui` or other app directories.
- Deletions only — do NOT add, reorder, or reformat any other class.
- Ordering: plan 021 replaces the whole row class string in
  `strategies-view.tsx:145`. Run this plan BEFORE 021; if 021 somehow landed
  first, the string there will already be gone — verify and skip step 2.
- If a listed line no longer contains the token (drift or another plan
  landed), verify the file's remaining occurrences against the keep/remove
  rule instead of failing — but STOP and report if you find a NEW
  `motion-reduce:transition-none` on a color-only transition not listed here.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
  `grep -rn "motion-reduce:transition-none" apps/web/components/dashboard/`
  → only the run-progress width line (or empty).
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`,
  DevTools → Rendering → `prefers-reduced-motion: reduce`:
  - Hover the range toggle (Performance card), the attribution
    Strategy/Security toggle, attention rows, the runs-toolbar segment
    filter, and a strategy-registry row: every hover/active tint now eases at
    the same 100ms as the run-history table rows beside them — no
    element snaps while its neighbor eases.
  - Progress bars still snap to value changes under reduced motion (width /
    transform stripped).
  - Turn reduced-motion emulation OFF: everything behaves exactly as before
    (these classes were no-ops outside reduced motion).
- **Done when**: the grep is clean per above, reduced-motion hover feedback
  is uniform across the dashboard, and typecheck is green.
