# 001 — Gate Recharts animations on prefers-reduced-motion

- **Status**: DONE
- **Commit**: ba46291
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 2 files (packages/ui/src/components/chart.tsx, apps/web/app/playbook/_sections/charts.tsx), ~30 lines

## Problem

Recharts animates chart mounts (bars grow, area lines draw in, pie sweeps) via
react-smooth, which drives SVG geometry through `requestAnimationFrame` — a JS
attribute tween, not CSS. The global reduced-motion layer in
`packages/ui/src/styles/globals.css:236-245` only overrides
`animation-duration` / `animation-iteration-count` / `transition-property` on
DOM elements, so it cannot touch rAF-driven interpolation. Users who set
"Reduce motion" in their OS still see every chart animate on mount.

There is no `isAnimationActive` anywhere in the repo (verified by grep), so all
charts run Recharts' default mount animation:

```tsx
// apps/web/app/playbook/_sections/charts.tsx — current (Area/Bar/Pie series
// carry no isAnimationActive prop; exact line numbers: Area ~177-190,
// Bar ~229-234, Pie ~257-268)
<Area dataKey="opened" ... />
<Bar dataKey="count" ... />
<Pie data={statusData} ... />
```

`packages/ui/src/components/chart.tsx` is the shared wrapper
(`ChartContainer` renders `RechartsPrimitive.ResponsiveContainer`) — the right
home for a reusable hook, since every future dashboard chart flows through it.

## Target

A `useChartAnimation()` hook exported from
`packages/ui/src/components/chart.tsx` that returns `false` when
`prefers-reduced-motion: reduce` matches (and `false` during SSR/first render
to avoid hydration mismatch — charts render statically, then enable animation
after mount if motion is allowed):

```tsx
// packages/ui/src/components/chart.tsx — target addition
function useChartAnimation(): boolean {
  const [animate, setAnimate] = React.useState(false)

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setAnimate(!query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return animate
}
```

Export it alongside the existing chart exports, and thread it through every
Recharts series in the playbook:

```tsx
// apps/web/app/playbook/_sections/charts.tsx — target (each chart component)
const isAnimationActive = useChartAnimation()
...
<Area dataKey="opened" isAnimationActive={isAnimationActive} ... />
<Bar dataKey="count" isAnimationActive={isAnimationActive} ... />
<Pie data={statusData} isAnimationActive={isAnimationActive} ... />
```

Every `<Area>`, `<Bar>`, `<Pie>` (and any `<Line>`/`<Radar>` etc. found in the
file) gets the prop. Tooltip/legend components do not need it.

## Repo conventions to follow

- The playbook already has a `usePrefersReducedMotion()`-style guard in
  `apps/web/app/playbook/page.tsx:1118-1126` (`ReplayBox` bails before starting
  its interval) — same intent, but the shared hook belongs in `chart.tsx` so
  dashboard code reuses it.
- House style (`.claude/skills/house-style/SKILL.md`): open code, small
  explicit APIs — export the hook, don't hide the behavior inside
  `ChartContainer` magically.
- All code and comments in English.

## Steps

1. Add `useChartAnimation` to `packages/ui/src/components/chart.tsx` (after the
   existing `useChart` hook, ~line 40) and add it to the file's exports.
2. In `apps/web/app/playbook/_sections/charts.tsx`, call the hook in each chart
   component and pass `isAnimationActive={isAnimationActive}` to every Recharts
   series element (`Area`, `Bar`, `Pie`, and any others present).
3. Grep `apps/web` and `packages/ui` for other Recharts series usages
   (`<Area`, `<Bar`, `<Pie`, `<Line`, `<Radar`) and apply the same prop if any
   exist outside the playbook.

## Boundaries

- Do NOT change chart data, colors, layout, or the `ChartContainer` API surface
  beyond adding the exported hook.
- Do NOT add new dependencies.
- Do NOT wrap the charts in CSS-based workarounds — the fix is the Recharts
  prop.
- If the charts file's structure doesn't match (drift since ba46291), STOP and
  report.

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui typecheck && pnpm --filter web typecheck && pnpm --filter web lint` — all clean. `pnpm --filter web build` — green.
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/playbook`,
  scroll to the Charts section:
  - Default: bars/areas/pie animate in on mount, exactly as before.
  - DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion:
    reduce", reload: charts render fully drawn with **no** mount animation.
- **Done when**: both states behave as above and typecheck/lint/build are green.
