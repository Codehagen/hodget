# 013 — Tokenize Recharts series animation duration and easing

- **Status**: TODO
- **Commit**: 2526020
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 4 files (packages/ui/src/components/chart.tsx + 3 chart components), ~15 lines

## Problem

Every Recharts series in the dashboard correctly passes `isAnimationActive`
(the reduced-motion gate from plan 001), but none passes `animationDuration`
or `animationEasing`. Recharts therefore falls back to its defaults: **1500ms**
with the `'ease'` curve. The house duration ceiling for product UI is 300ms
(Design.md §16, "Product UI duration ceiling | < 300ms"), with 400ms
(`--duration-page`) reserved for the heaviest surfaces. Charts currently take
**5x** the budget of even the slow tier — the equity line lazily draws itself
long after the rest of the page has settled, and every range-toggle click in
the performance card re-runs a 1.5-second tween.

The six affected series, all missing duration/easing:

```tsx
// apps/web/components/dashboard/equity-chart.tsx:187-195 — current
<Line
  dataKey="benchmark"
  type="monotone"
  stroke="var(--color-benchmark)"
  strokeWidth={1.25}
  strokeDasharray="4 3"
  dot={false}
  isAnimationActive={isAnimationActive}
/>
```

```tsx
// apps/web/components/dashboard/equity-chart.tsx:196-203 — current
<Line
  dataKey="portfolio"
  type="monotone"
  stroke="var(--color-portfolio)"
  strokeWidth={1.75}
  dot={false}
  isAnimationActive={isAnimationActive}
/>
```

```tsx
// apps/web/components/dashboard/equity-chart.tsx:243-250 — current
<Area
  dataKey="drawdown"
  type="monotone"
  stroke="var(--destructive)"
  strokeWidth={1}
  fill="url(#fillDrawdown)"
  isAnimationActive={isAnimationActive}
/>
```

```tsx
// apps/web/components/dashboard/run-equity-chart.tsx:135-143 — current
<Line
  dataKey="index"
  name="Equity"
  type="monotone"
  stroke="var(--color-equity)"
  strokeWidth={1.5}
  dot={false}
  isAnimationActive={isAnimationActive}
/>
```

```tsx
// apps/web/components/dashboard/run-equity-chart.tsx:197-205 — current
<Area
  dataKey="drawdown"
  name="Drawdown"
  type="monotone"
  stroke="var(--color-drawdown)"
  fill="url(#fillRunDrawdown)"
  strokeWidth={1}
  isAnimationActive={isAnimationActive}
/>
```

```tsx
// apps/web/components/dashboard/analysts/signal-behavior-chart.tsx:89 — current
<Bar dataKey="value" radius={0} isAnimationActive={isAnimationActive}>
```

## Target

A single shared constant exported from `packages/ui/src/components/chart.tsx`,
placed directly after the `useChartAnimation` hook (which ends at line 62), and
spread onto all six series:

```tsx
// packages/ui/src/components/chart.tsx — target addition (after useChartAnimation)

// House animation props for Recharts series. 400ms is the --duration-page
// tier — charts are the heaviest elements on screen, so they get the top of
// the duration scale; "ease-out" per Design.md's enter rule (entrances
// decelerate). Recharts takes these as JS props, not CSS, so the CSS tokens
// can't reach them — keep these values in sync with globals.css.
export const chartAnimationProps = {
  animationDuration: 400,
  animationEasing: "ease-out",
} as const
```

Each series then reads (equity-chart.tsx benchmark line shown; same pattern on
all six):

```tsx
<Line
  dataKey="benchmark"
  type="monotone"
  stroke="var(--color-benchmark)"
  strokeWidth={1.25}
  strokeDasharray="4 3"
  dot={false}
  isAnimationActive={isAnimationActive}
  {...chartAnimationProps}
/>
```

Note on the range toggle in `equity-chart.tsx`: clicking 1D/1M/3M/YTD/1Y
(`setRange`, line 117) changes the chart data and re-runs the series tween.
At 1500ms this felt broken; at 400ms it is an acceptable, even pleasant,
morph. Do **not** add extra machinery (no animation suppression on range
change, no keys, no state) — the duration fix alone resolves it.

## Repo conventions to follow

- Motion tokens live in `packages/ui/src/styles/globals.css` — durations at
  lines 191-195 (`--duration-instant: 100ms` … `--duration-page: 400ms`).
  Recharts can't consume CSS variables, so the constant mirrors
  `--duration-page` as the number `400` with a comment tying them together.
- The exemplar for "shared chart behavior lives in chart.tsx" is
  `useChartAnimation` itself, `packages/ui/src/components/chart.tsx:50-62`,
  exported from the export block at lines 388-396.
- Hard chart rule (already satisfied, do not disturb): every series carries
  `isAnimationActive` from `useChartAnimation()` AND the `ChartContainer` is
  keyed on that value (see `equity-chart.tsx:106,147,211`). Design.md §7.
- House style: open code, small explicit APIs — an exported constant the call
  sites spread visibly, not a wrapper component that hides the props.

## Steps

1. In `packages/ui/src/components/chart.tsx`, add the `chartAnimationProps`
   constant (code above) after the `useChartAnimation` function (line 62),
   with the explanatory comment. Because it is declared with `export const`
   inline, do NOT also add it to the bottom export block at lines 388-396 —
   or, if you prefer consistency with the file's style, declare it without
   `export` and add `chartAnimationProps` to that export block instead. Pick
   one; do not do both.
2. In `apps/web/components/dashboard/equity-chart.tsx`, add
   `chartAnimationProps` to the existing `@workspace/ui/components/chart`
   import (lines 7-13) and spread `{...chartAnimationProps}` on the `<Line>`
   at 187, the `<Line>` at 196, and the `<Area>` at 243 (after
   `isAnimationActive`).
3. Same in `apps/web/components/dashboard/run-equity-chart.tsx`: extend the
   import (lines 14-20), spread on the `<Line>` at 135 and `<Area>` at 197.
4. Same in `apps/web/components/dashboard/analysts/signal-behavior-chart.tsx`:
   extend the import (lines 5-9), spread on the `<Bar>` at 89 (before the
   `>` that opens the Cell children).

## Boundaries

- Do NOT touch chart data, colors, axes, tooltips, or the existing
  `isAnimationActive` / keyed-container wiring.
- Do NOT change the playbook charts (`apps/web/app/playbook/**`) — this plan
  is dashboard-only; the playbook can be swept in a follow-up.
- Do NOT add new dependencies or wrap Recharts components.
- If a cited series has moved or its props differ from the excerpts above
  (drift since 2526020), STOP and report instead of improvising.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green, no new errors.
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`:
  - Fund monitor: the Performance card's equity/benchmark lines and drawdown
    area draw in briskly (~0.4s) and settle with a decelerating tail — no
    long lazy crawl.
  - Click through the 1D/1M/3M/YTD range toggle rapidly: each click re-tweens
    in ~0.4s; spamming feels responsive, never like the chart is "catching up".
  - Runs → open a run detail page: the run equity line + drawdown strip
    animate on the same clock.
  - Analysts: the signal-behavior decile bars grow in ~0.4s.
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, reload:
    charts still render fully drawn with no mount animation (unchanged
    behavior from `useChartAnimation`).
- **Done when**: all six series visibly animate at ~400ms ease-out, the range
  toggle feels snappy, reduced-motion still renders statically, and typecheck
  is green.
