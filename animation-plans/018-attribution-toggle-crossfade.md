# 018 — Attribution mode toggle crossfade

- **Status**: TODO
- **Commit**: 2526020
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file (apps/web/components/dashboard/fund-monitor/attribution-card.tsx), ~3 lines

## Problem

The "Today's attribution" card on the fund monitor has a Strategy/Security
segment toggle. Clicking it swaps the entire rows block — different labels,
different bar widths, different figures — in a single frame. The whole card
body teleports, and because the two datasets have similar shapes it's easy to
miss that anything changed at all.

```tsx
// apps/web/components/dashboard/fund-monitor/attribution-card.tsx:67-70 — current
export function AttributionCard() {
  const [mode, setMode] = React.useState<Mode>("Strategy")
  const rows =
    mode === "Strategy" ? ATTRIBUTION_BY_STRATEGY : ATTRIBUTION_BY_SECURITY
```

```tsx
// apps/web/components/dashboard/fund-monitor/attribution-card.tsx:96-102 — current
<div className="flex flex-col gap-3 px-3">
  <div className="flex justify-end">
    <span className="text-[11px] text-muted-foreground">
      Contribution (bp)
    </span>
  </div>
  <AttributionRows rows={rows} />
```

## Target

Give each mode's rows a fast fade-in by remounting the rows block per mode
and running the shared fade keyframe at the fast tier (150ms — the toggle is
clicked more than once, so it gets a quicker beat than a page-level 200ms
entrance):

```tsx
// apps/web/components/dashboard/fund-monitor/attribution-card.tsx — target
<div
  key={mode}
  className="motion-safe:animate-fade-in [animation-duration:var(--duration-fast)]"
>
  <AttributionRows rows={rows} />
</div>
```

- `key={mode}` forces a remount on toggle, so the CSS animation replays.
- `[animation-duration:var(--duration-fast)]` overrides `animate-fade-in`'s
  default `var(--duration-base)` down to 150ms.
- The diverging bars inside (`DivergingBar`, lines 18-35, inline
  `style={{ width: `${pct}%` }}`) stay **static widths** — because the block
  remounts, there is nothing to tween between modes, and no width transition
  may be added. Bars appear at their final width inside the fade.

The "Total" footer row (lines 103-113) and the header toggle stay outside
the keyed wrapper — they don't change with the data (`ATTRIBUTION_TOTAL_BP`
is mode-independent) and must not re-fade.

## Repo conventions to follow

- `animate-fade-in` is the shared keyframe utility from
  `packages/ui/src/styles/globals.css:92`
  (`--animate-fade-in: fade-in var(--duration-base) var(--ease-out-quart)`;
  keyframes at lines 102-108). Gate with `motion-safe:` at the variant level.
- Duration overrides use the token via an arbitrary property —
  `[animation-duration:var(--duration-fast)]` — never a numeric literal.
- Reduced motion: `motion-safe:` skips the animation entirely; the global
  layer (`globals.css:277`) would flatten it anyway. No `motion-reduce:`
  variant needed.
- The key-to-replay-a-CSS-animation pattern is the house way to animate
  content swaps without an exit-animation library (cf. Design.md §5-6).

## Steps

1. In `apps/web/components/dashboard/fund-monitor/attribution-card.tsx`, wrap
   the `<AttributionRows rows={rows} />` element (line 102) in
   `<div key={mode} className="motion-safe:animate-fade-in [animation-duration:var(--duration-fast)]">…</div>`.
   Nothing else moves; the wrapper sits between the "Contribution (bp)"
   header div and the Total footer div inside the existing
   `flex flex-col gap-3` column (a plain block div participates in that flex
   column exactly like the component's own root div did — visual layout is
   unchanged).

## Boundaries

- Do NOT modify `AttributionRows` or `DivergingBar` — no width transitions,
  no per-row stagger.
- Do NOT animate the toggle buttons themselves (their `transition-colors` at
  line 84 is owned by plan 020).
- Do NOT add exit animation or crossfade both states simultaneously (no
  double-mount) — old rows disappear instantly, new rows fade in. Instant-out
  is house posture.
- Do NOT add new dependencies.
- If the JSX around line 102 has drifted from the excerpt, STOP and report.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`
  (fund monitor), find "Today's attribution":
  - Click Strategy ↔ Security: the rows block fades in over ~150ms; the
    Total footer and the header do not flicker or re-fade.
  - Spam the toggle: each click restarts the fade cleanly (remount), never
    stacking or stuttering.
  - Bars appear at their final widths — no width sweep.
  - DevTools → Animations panel at 10% playback: single opacity ramp,
    decelerating (quart), ~150ms.
  - Rendering panel → `prefers-reduced-motion: reduce`: toggling swaps
    instantly with no fade.
- **Done when**: the toggle produces a clean 150ms fade of the rows only, all
  reduced-motion and spam behavior is as above, and typecheck is green.
