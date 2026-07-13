# 008 — Scope the drawer's will-change to active motion

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file (packages/ui/src/components/drawer.tsx), one class edit

## Problem

The drawer popup declares `will-change-transform` unconditionally, keeping a
compositor layer promoted the entire time the drawer sits open and idle:

```tsx
// packages/ui/src/components/drawer.tsx:125 — current (excerpt)
"... transition-[transform,height,opacity,filter] duration-[var(--duration-drawer)] ease-out-quint will-change-transform outline-none select-none ..."
```

The popup only moves while swiping or during its enter/exit transition. A
permanently promoted full-size layer costs memory (and on low-end devices,
compositing budget) for no benefit while idle. Impact is bounded — the popup
only exists while the drawer is open — hence LOW.

## Target

Promote only during phases where transform actually changes: while swiping and
during the starting/ending transitions.

```tsx
// target — replace the unconditional class with phase-gated variants
"data-swiping:will-change-transform data-starting-style:will-change-transform data-ending-style:will-change-transform"
```

If testing shows a visible first-frame hitch when the swipe begins (layer
promotion happening mid-gesture), fall back to keeping `will-change-transform`
unconditional and instead add a comment documenting why:
`/* Promoted for the popup's lifetime: promoting at swipe-start caused a
first-frame hitch. */` — and report that outcome.

## Repo conventions to follow

- Phase-gated variants follow the drawer's own established pattern
  (`data-swiping:duration-0`, `data-ending-style:...` throughout drawer.tsx).

## Steps

1. Swap the class per Target on drawer.tsx:125.
2. Test the swipe start on a real pointer (trackpad drag) for hitching; apply
   the fallback branch if needed.

## Boundaries

- Do NOT touch any other drawer class (durations/easings owned by plan 005;
  reduced-motion by plan 003).
- The fallback (keep unconditional + comment) is a valid outcome.

## Verification

- **Mechanical**: `pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` → open the drawer, swipe it
  repeatedly with fast direction reversals — tracking stays glued to the
  pointer with no first-frame hitch; DevTools Layers panel shows the popup's
  layer released after the drawer settles open (if the gated branch was taken).
- **Done when**: no visible regression in swipe feel, and the layer is either
  released when idle or the unconditional promotion is documented.
