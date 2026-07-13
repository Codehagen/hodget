# 012 — ScoreRing sweeps to its value like its sibling bar (opportunity)

- **Status**: DONE
- **Commit**: ba46291
- **Severity**: LOW (missed opportunity — additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (packages/ui/src/components/score-meter.tsx), one class addition

## Problem

The gauge arc sets `strokeDashoffset` with no transition, so when `score`
changes the arc jumps — while the linear representation of the *same value*
animates (`progress.tsx:48` transitions width over `--duration-slow`
`ease-out-quart`). The score is the emotional centerpiece of a finance
dashboard; the bar sweeping while the ring snaps is an inconsistency users
feel.

```tsx
// packages/ui/src/components/score-meter.tsx:156-166 — current (value arc)
<circle
  cx={size / 2}
  cy={size / 2}
  r={r}
  fill="none"
  strokeWidth={stroke}
  strokeLinecap="round"
  strokeDasharray={circumference}
  strokeDashoffset={offset}
  className={meta.ringClass}
/>
```

## Target

Transition the offset. `stroke-dashoffset` is a presentation attribute set via
the SVG attribute here, but CSS transitions apply when declared as a
transitioned property:

```tsx
// target — same element, className extended
className={cn(
  meta.ringClass,
  "transition-[stroke-dashoffset] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none"
)}
```

(Import `cn` from `@workspace/ui/lib/utils` if the file doesn't already; check
how `meta.ringClass` is applied and compose accordingly.)

This animates value *changes*. It also animates the initial mount from the
default offset — check what the first paint looks like: if React hydrates with
the correct offset immediately there is no mount sweep (fine); if a visible
0→value sweep on mount appears and feels wrong in context, it is acceptable —
the Progress bar has the same property (its width transition also applies on
first data). Match the bar's behavior; do not special-case mount.

## Repo conventions to follow

- Exemplar (the sibling this must match): `packages/ui/src/components/progress.tsx:48`
  — `transition-[width] duration-[var(--duration-slow)] ease-out-quart`.
- `motion-reduce:transition-none` per `tree.tsx:364`.

## Steps

1. Extend the value-arc `<circle>` className per Target.
2. If the playbook's score demo is static (no changing values), add a small
   interactive control to the score section demo ONLY if one already exists for
   similar demos — otherwise verify by editing the demo value in React DevTools.

## Boundaries

- Do NOT touch the background track circle or ScoreMeter's bar.
- Do NOT change scoring logic, colors, or geometry.
- Do NOT add JS animation — CSS transition only.

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui lint && pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` → score section: change a ring's
  score (via demo control or React DevTools props): the arc **sweeps** to the
  new value over ~300ms, decelerating — visually paired with the bar's sweep.
  Reduced-motion emulation: the arc jumps instantly.
- **Done when**: ring and bar animate the same datum the same way.
