# 027 — Fund-overview chart stops replaying its draw tween on range clicks

- **Status**: DONE
- **Commit**: 1752933
- **Severity**: MEDIUM
- **Category**: Frequency / missed-friction
- **Estimated scope**: 1 file (apps/web/components/dashboard/equity-chart.tsx), ~4 edits

## Problem

`PerformanceChart` has a 1D / 1M / 3M / YTD / 1Y range toggle that slices the
equity curve to different trailing point counts. Every series carried
`isAnimationActive={isAnimationActive}` with the container keyed on the same
value (the house chart contract, Design.md §7). That is correct for the mount
draw, but it also means **every range click re-runs Recharts' ~400ms update
tween** across series whose point counts differ (2 → 22 → 66 → full). Recharts
morphs the old path into the new one, which on differing point counts is an
incoherent squash-and-stretch — on a control a user clicks dozens of times a
session. Per Design.md §1/§4 (frequency rule) a frequent interaction should not
animate; the mount draw is welcome once, the per-click morph is not.

```tsx
// equity-chart.tsx — before
const isAnimationActive = useChartAnimation()
const [range, setRange] = React.useState<Range>("YTD")
const animKey = isAnimationActive ? "animated" : "static"
// …series…
isAnimationActive={isAnimationActive}
```

## Target

Keep the mount draw, then go static from the first interaction onward. Track a
one-way `hasInteracted` flag, flip it in the range `onClick`, and derive a
composite `animate = isAnimationActive && !hasInteracted`. Feed that composite to
**both** the series `isAnimationActive` **and** the container remount `key` — the
chart contract requires the key to change whenever the effective animation flag
changes, or a mid-flight tween strands the series geometry (invisible / half-drawn
series, Design.md §7).

```tsx
// equity-chart.tsx — after
const [hasInteracted, setHasInteracted] = React.useState(false)
const animate = isAnimationActive && !hasInteracted
const animKey = animate ? "animated" : "static"       // keys: `line-${animKey}`, `dd-${animKey}`

onClick={() => { setRange(r); setHasInteracted(true) }}
// all three series:
isAnimationActive={animate}
```

On first click the composite flips `true → false`, the container remounts static,
and the new range renders at final geometry with no tween — it snaps. Every later
click keeps `animate` false and the key `static`, so Recharts updates the series
in place without a tween. The initial page-load draw is unaffected (before any
click, `animate` tracks `isAnimationActive`).

## Repo conventions to follow

- The chart contract is non-negotiable: `isAnimationActive` and the container
  `key` move together (Design.md §7). This fix routes both through the single
  `animate` composite so they cannot drift.
- Reduced motion is already handled by `useChartAnimation()` returning `false`
  (fully static charts); the composite `animate` is `false` there regardless of
  `hasInteracted`, so the behavior is unchanged for reduced-motion users.

## Steps

1. Add `const [hasInteracted, setHasInteracted] = React.useState(false)`.
2. Derive `const animate = isAnimationActive && !hasInteracted` and base
   `animKey` on `animate`.
3. Set `hasInteracted` true in the range button `onClick` (alongside `setRange`).
4. Swap the three series' `isAnimationActive={isAnimationActive}` →
   `isAnimationActive={animate}`.

## Boundaries

- Do NOT remove the mount draw (initial load should still draw when motion is
  allowed).
- Do NOT key the container on `range` — that would remount (and redraw) on every
  click, the opposite of the goal.
- Do NOT touch the drawdown area's data derivation or the tooltip.

## Verification

- **Mechanical**: `pnpm turbo typecheck` + `pnpm turbo test --filter=web` — green.
- **Feel check** (headless Chromium, `/demo`, 1440px):
  - Initial load: line + benchmark + drawdown curves draw once.
  - Click 1M: 4 `path.recharts-curve` present, all with valid `d`,
    `aria-pressed` moves to 1M — the new range renders instantly, no morph.
  - Rapid 3M → YTD: all 4 curves still carry valid `d` (no stranded/blank
    series) — the remount-static path is correct.
  - Both themes render; zero app console errors.
- **Done when**: first range click snaps, later clicks snap, initial load still
  draws, no invisible series. All met.
