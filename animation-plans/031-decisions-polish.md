# 031 — Decisions polish (canvas legibility, rail selection snap, advisor crossfade)

- **Status**: DONE
- **Commit**: 1752933
- **Severity**: LOW (batch of three)
- **Category**: Polish / cohesion / missed opportunity
- **Estimated scope**: 3 files — decision-flow.tsx (feel-check only, kept as-is), decisions-view.tsx, inspector.tsx

## (a) Canvas legibility — feel-checked, kept as-is (reconciliation vs plan 026)

The restyle that turned Strategies/Decisions into plain-language explainers
shrank the map canvas to `h-[480px]` with `fitViewOptions={{ padding: 0.08 }}`,
where plan 026 had left it at `h-[640px]` / `padding: 0.16`. The brief flagged the
graph as possibly "zoomed small" and said: if node text renders below comfortable
legibility (fit zoom < ~0.7) at ~1440px, raise the canvas height (h-560/h-600)
and/or padding until legible.

**Measured in headless Chromium at 1440px, then 1680/1920 with fresh mounts:**

| viewport | canvas width | fit zoom |
|---|---|---|
| 1440px | 608px | **0.401** (width-bound) |
| 1680px | 848px | 0.558 (width-bound) |
| 1920px | 1088px | 0.613 (height-bound) |

At the 1440px feel-check width the fit is **width-bound**: the three-rail layout
(left "Today" rail `lg:w-52` + right advisor rail `lg:w-72` + the app nav
sidebar) compresses the middle column to ~608px. With `graphW ≈ 1273px`, the fit
zoom ceiling is `608 / 1273 ≈ 0.48` **even at zero padding** — so 0.7 is not
reachable at 1440px via height or padding without restructuring the page layout
(out of scope). Height is **not** the binding dimension here: raising it changes
nothing about the zoom and only adds vertical whitespace.

**Empirically tested** `h-[560px]` + `padding: 0.04`: fit zoom moved only
0.401 → 0.416 (the width bound barely shifts), while the graph (~274px tall at
that zoom) began floating in a 560px box with ~280px of vertical whitespace —
visibly worse balance than the restyle's `h-[480px]`, which frames the graph
tightly. Both changes were **reverted**; `decision-flow.tsx` is unchanged.

Conclusion (the plan-026 reconciliation the brief asked for): the restyle's
`h-[480px]` / `padding: 0.08` is the better-balanced choice at desktop widths.
Nodes are legible at ~0.40 (headings, convictions, committee math, risk-gate and
execution nodes all read clearly) — comparable to plan-026's shipped ~0.44. The
map stays width-bound at 1440px; the height only becomes the lever at ≥~1900px
(where it is already fine). Legibility gains would require changing the 3-rail
page layout, which this motion audit does not touch. Documented keep-as-is, a
valid completion per this directory's convention.

## (b) Left-rail row selection snaps; only hover eases

`decisions-view.tsx`'s `RailRow` put `transition-colors
duration-[var(--duration-instant)]` on the base class, so the **selected** state
swap (`bg-primary/5` + the `before:` accent bar) eased in — selection should be
instant (Design.md §1, the NodeShell posture). Moved the transition into the
**unselected branch only**, alongside `hover:bg-muted/40`; `focus-visible:bg-muted/60`
stays on the base (keyboard focus is instant, which is correct).

```tsx
// RailRow — after
"relative flex … outline-none focus-visible:bg-muted/60",
selected
  ? "bg-primary/5 before:… before:bg-primary before:content-['']"
  : "transition-colors duration-[var(--duration-instant)] hover:bg-muted/40"
```

## (c) Advisor rail crossfades on advisor change

`inspector.tsx`'s `AdvisorRail` swapped its content with no motion when a
different advisor node is clicked. Wrapped the rail's inner content in a div
**keyed on `advisor.analystId`** so it remounts on advisor change and replays an
**opacity-only** fade; the `<aside>` frame (ring, padding, background) stays put.

The brief's literal form was `motion-safe:animate-fade-in` +
`[animation-duration:var(--duration-fast)]`. That did **not** win the cascade:
the `animate-fade-in` token expands to an `animation` shorthand that resets
`animation-duration` back to `--duration-base` (measured 0.2s), overriding the
separate duration utility. Replaced with a single explicit shorthand that reuses
the same `fade-in` keyframe at the fast token — one declaration, no override
conflict:

```tsx
<div key={advisor.analystId}
     className="flex flex-col gap-5 motion-safe:[animation:fade-in_var(--duration-fast)_var(--ease-out-quart)]">
```

Opacity-only, `motion-safe:` gated (drops to an instant swap under reduced
motion — remove, not reduce, Design.md §11), no movement, no delay.

## Repo conventions to follow

- Token durations/easings only; explicit animation, never `transition-all`.
- Selection instant; only hover/crossfade eases (Design.md §1).
- Crossfade is opacity-only → reduced-motion safe via `motion-safe:`.

## Boundaries

- (a) do NOT change the page's 3-rail layout, `STRIDE`, node positions, or the
  interaction `maxZoom`/`minZoom`.
- (b) keep `focus-visible:bg-muted/60` on the base (focus stays instant).
- (c) key the **inner content wrapper**, not the `<aside>` frame — the frame must
  not flash.

## Verification

- **Mechanical**: `pnpm turbo typecheck` + `pnpm turbo test --filter=web` — green.
- **Feel check** (headless Chromium, `/demo/decisions`):
  - (a) fit zoom 0.401 at 1440px, width-bound (see table); h-560/pad-0.04
    tested → 0.416 with excess whitespace → reverted. Nodes legible.
  - (b) selected row computed `transition: all / 0s` (snaps); unselected computed
    `transition-property: color, background-color, … / 0.1s` (eases).
  - (c) rail wrapper computed `animation-name: fade-in`, `duration: 0.15s`,
    `timing: cubic-bezier(0.165, 0.84, 0.44, 1)` (ease-out-quart); keyed on
    `advisor.analystId`.
  - Both themes; zero app console errors.
- **Done when**: canvas legible + reconciliation recorded, rail selection snaps
  while hover eases, advisor rail crossfades opacity-only on advisor change. All
  met.
