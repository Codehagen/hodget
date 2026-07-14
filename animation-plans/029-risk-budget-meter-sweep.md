# 029 — Risk-budget meter sweeps once on mount

- **Status**: DONE
- **Commit**: 1752933
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 2 files — a keyframe/token in `packages/ui/src/styles/globals.css`, the fill span in `fund-monitor/risk-card.tsx`

## Problem

The "Risk budget" meter on the Fund-overview Forward-risk card rendered its fill
at a fixed width with no motion:

```tsx
// risk-card.tsx — before
<span className={cn("block h-full", "bg-success")} style={{ width: `${riskBudgetPct}%` }} />
```

Every other value indicator in the app sweeps to its value on mount — the
run-progress bar (`transition-transform scaleX`, plan 015), the score ring
(`stroke-dashoffset`, plan 012). This meter was the odd one that just appeared,
and it animated **`width`** (Layout+Paint+Composite, Design.md §10) rather than a
GPU-composited transform.

## Target

Make the fill sweep from empty to its value exactly once on mount, on a
GPU-composited `transform: scaleX`. `risk-card.tsx` is a server component (no
client hooks), so a transition-from-zero can't fire on mount without adding
client JS — a CSS **keyframe** is the cleanest one-shot: it runs on mount, never
replays on re-render (only on remount), and is flattened to instant under the
global reduced-motion rule.

A new named keyframe + `@theme` token in `globals.css`:

```css
@keyframes risk-sweep { from { transform: scaleX(0); } }   /* no `to` → falls back to the element's own scaleX(ratio) */
--animate-risk-sweep: risk-sweep var(--duration-slow) var(--ease-out-quart) backwards;
```

The fill span renders at `w-full origin-left` with its resting value as an inline
`transform: scaleX(ratio)`; the keyframe sweeps from `scaleX(0)` up to that
resting value (Design.md §5: omitting `100%` falls back to the element's natural
value). `backwards` fill-mode applies `scaleX(0)` before the first frame so there
is no flash of the full bar.

```tsx
// risk-card.tsx — after
<span
  className="block h-full w-full origin-left bg-success motion-safe:animate-risk-sweep"
  style={{ transform: `scaleX(${riskBudgetPct / 100})` }}
/>
```

## Repo conventions to follow

- **scaleX, not width** — GPU-composited, no layout (Design.md §10), same as
  run-progress.tsx (plan 015).
- **Token duration/easing** — `--duration-slow` (300ms, the sweep ceiling) +
  `ease-out-quart`, matching the score-ring/progress sweeps (Design.md §16).
- **Reduced motion**: gated `motion-safe:` (checkbox `draw-stroke` precedent,
  Design.md §6). Under `prefers-reduced-motion` the variant drops the animation
  and the fill renders statically at its resting `scaleX(ratio)` — remove, not
  reduce (§11). (The global rule also flattens any keyframe to 0.01ms, so this is
  belt-and-suspenders.)
- The named keyframe is registered as an `--animate-*` token in the same `@theme`
  block as `fade-in`, `draw-stroke`, … (Design.md §2), keeping the meter's motion
  named and swappable rather than a magic inline animation.

## Steps

1. globals.css: add `@keyframes risk-sweep { from { transform: scaleX(0); } }`
   near the other keyframes, and `--animate-risk-sweep: …` in the `@theme` block.
2. risk-card.tsx: swap the fill span to `w-full origin-left …
   motion-safe:animate-risk-sweep` with the inline `transform: scaleX(ratio)`.
   Drop the now-unused `cn` import.

## Boundaries

- Do NOT touch the 0 / 50% / 100% axis row beneath the meter.
- Do NOT animate the red scenario-loss bars (`ScenarioRow`) — static by design.
- Do NOT convert `risk-card.tsx` to a client component; the keyframe needs no JS.

## Verification

- **Mechanical**: `pnpm turbo typecheck` + `pnpm turbo test --filter=web` — green.
- **Feel check** (headless Chromium, `/demo`):
  - Fill computed `animation-name: risk-sweep`, `animation-duration: 0.3s`,
    `animation-fill-mode: backwards`, `transform-origin: 0px …` (left),
    `transform: matrix(0.72, 0, 0, 1, 0, 0)` (= scaleX(0.72) for the 72% fixture).
  - Dark theme: fill `background-color` = success token (dark variant), transform
    unchanged.
  - Zero app console errors.
- **Done when**: the fill sweeps left-to-right once on mount to 72%, on scaleX,
  never replays on re-render, static under reduced motion. All met.
