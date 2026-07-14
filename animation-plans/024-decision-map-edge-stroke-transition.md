# 024 — Active-path edges ease their stroke color on selection

- **Status**: DONE
- **Commit**: 9ceb076
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 2 files (new decision-flow.css + decision-flow.tsx wire-up)

## Problem

Selecting a different (included) analyst re-derives the active reasoning path,
and the edges along it flip stroke color between grey (`--muted-foreground`)
and blue (`--info`) **instantly**. `buildEdges` recreates the edge *objects* on
every selection change, but React Flow keys edges by their stable `id`, so the
underlying `<path class="react-flow__edge-path">` DOM elements persist — the
only thing that changes is the inline `stroke`. That is a free opportunity for
a color-only ease that reduced-motion keeps by default.

```ts
// apps/web/components/dashboard/decision-map/layout.ts:106-107 — current edge styles
const GREY = { stroke: "var(--muted-foreground)", strokeOpacity: 0.4, strokeWidth: 1.5 }
const BLUE = { stroke: "var(--info)", strokeWidth: 2 }
```

No CSS transition targets `.react-flow__edge-path`, so the swap snaps.

## Target

Transition the `stroke` of `.react-flow__edge-path` with `--duration-fast`
(150ms) and `ease-out-quad`. Color-only, so it is reduced-motion safe (the
global allowlist includes `stroke`).

**Implementation note / deviation from the original brief.** The brief
suggested a Tailwind arbitrary selector on the wrapper
(`[&_.react-flow__edge-path]:transition-[stroke] …`). That does **not** work:
Tailwind's arbitrary-value parser rewrites every `_` to a space, and React
Flow's classes use BEM double-underscores (`react-flow__edge-path`), so the
generated selector becomes `.react-flow  edge-path` and matches nothing.
(Escaping the underscores can't survive a JSX string literal: the scanner reads
one backslash from source while the runtime className drops it, so the class
name and the CSS selector never agree.) `chart.tsx`'s `[&_.recharts-…]`
selectors only work because they rely on that `_ → space` conversion as an
intentional descendant combinator.

So the rules live in a colocated stylesheet, `decision-flow.css`, imported by
`decision-flow.tsx` right after the existing `@xyflow/react/dist/base.css`
import, scoped under a `.decision-map-canvas` class on the ReactFlow wrapper
div. Tokens are referenced as CSS variables so it stays inside the token
system.

```css
/* apps/web/components/dashboard/decision-map/decision-flow.css */
.decision-map-canvas .react-flow__edge-path {
  transition: stroke var(--duration-fast) var(--ease-out-quad);
}
```

```tsx
// decision-flow.tsx
import "@xyflow/react/dist/base.css"
import "./decision-flow.css"
// …
<div className="decision-map-canvas h-[640px] w-full">
```

## DOM-reuse caveat — checked, NOT reverted

The brief flagged: if React Flow recreates the path DOM on selection instead of
reusing it, the stroke would appear on a fresh element and never transition
(a no-op to revert rather than ship). **Verified reused, so shipped.** In the
browser I tagged all 9 `.react-flow__edge-path` elements with a JS expando,
switched the selected analyst, and re-queried: `reused=9 fresh=0`, and exactly
the 4 active-path edges changed stroke. The transition is real.

## Repo conventions to follow

- Tokens via CSS variables (`var(--duration-fast)`, `var(--ease-out-quad)`);
  the `@theme` easings and `:root` durations resolve on `:root` (Design.md §2).
- Color-only transition → no reduced-motion gate; the allowlist keeps `stroke`
  running (Design.md §11).
- Global CSS imports are already used in this client component
  (`@xyflow/react/dist/base.css`), so a second colocated import is in-idiom.

## Steps

1. Create `decision-flow.css` with the `.react-flow__edge-path` rule.
2. Import it in `decision-flow.tsx` after `base.css`.
3. Add `decision-map-canvas` to the ReactFlow wrapper div's className.

## Boundaries

- Transition **stroke only** — not `stroke-width` or `stroke-opacity` (they
  snap; the ~0.5px width change is negligible and the arrowhead marker color
  swap snaps too, which is fine).
- Do NOT alter `GREY`/`BLUE`/marker definitions in `layout.ts`.
- Scope every rule under `.decision-map-canvas` so it can't leak to another
  React Flow instance.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green (verified).
- **Feel check** (verified in headless Chromium against
  `/demo/runs/run_8c41cf/decisions/dec_c12f8b7a`):
  - `.react-flow__edge-path` computed
    `transition-property: stroke, duration 0.15s, ease-out-quad` ✓.
  - DOM reuse across selection: `reused=9 fresh=0`; 4 active-path edges swapped
    stroke → the color eases rather than snaps ✓.
  - Zero JS console errors.
- **Done when**: switching the selected analyst eases the active-path edge
  color over 150ms; typecheck green. All met (not reverted).
