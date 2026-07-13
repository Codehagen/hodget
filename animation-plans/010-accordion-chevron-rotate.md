# 010 — Rotate one accordion chevron instead of swapping two icons (opportunity)

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: LOW (missed opportunity — additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (packages/ui/src/components/accordion.tsx), ~5 lines

## Problem

The accordion trigger hard-swaps two icons on expand — the glyph teleports
while the panel below it animates smoothly, and the tree component already does
this correctly with a rotating single chevron, so the two disclosure patterns
are inconsistent:

```tsx
// packages/ui/src/components/accordion.tsx:43-44 — current
<HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} data-slot="accordion-trigger-icon" className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden" />
<HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} data-slot="accordion-trigger-icon" className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline" />
```

```tsx
// packages/ui/src/components/tree.tsx:364 — the exemplar to match
"... transition-transform duration-[var(--duration-fast)] ease-out-quad motion-reduce:transition-none group-aria-expanded/tree-item:rotate-90 ..." // (rotating chevron)
```

## Target

One `ArrowDown01Icon` that rotates 180° when expanded, timed exactly like the
tree chevron:

```tsx
// target — replaces both icon lines
<HugeiconsIcon
  icon={ArrowDown01Icon}
  strokeWidth={2}
  data-slot="accordion-trigger-icon"
  className="pointer-events-none shrink-0 transition-transform duration-[var(--duration-fast)] ease-out-quad motion-reduce:transition-none group-aria-expanded/accordion-trigger:rotate-180"
/>
```

Remove the now-unused `ArrowUp01Icon` import.

## Repo conventions to follow

- Exemplar: `packages/ui/src/components/tree.tsx:364` (token duration, `ease-out-quad`, `motion-reduce:transition-none`).
- `--duration-fast` = 150ms; do not pick a different duration.

## Steps

1. Replace the two icon elements at accordion.tsx:43-44 with the single
   rotating icon above.
2. Delete the `ArrowUp01Icon` import if nothing else uses it.

## Boundaries

- Do NOT touch the trigger's other classes or the panel's height transition.
- Do NOT change icon size or placement (the `**:data-[slot=accordion-trigger-icon]:` rules on the trigger keep applying).

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui lint && pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` → accordion demo: expanding rotates
  the chevron 180° in sync with the panel opening; collapsing rotates it back.
  Rapid toggling reverses the rotation mid-flight (it's a transition, not a
  keyframe). Reduced-motion emulation: chevron flips instantly, panel snaps —
  no motion.
- **Done when**: one chevron, smooth rotation, consistent with the tree.
