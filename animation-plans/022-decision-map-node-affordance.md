# 022 — Decision-map nodes get a cursor + hover affordance

- **Status**: DONE
- **Commit**: 9ceb076
- **Severity**: MEDIUM
- **Category**: Affordance
- **Estimated scope**: 1 file (apps/web/components/dashboard/decision-map/nodes.tsx), 1 class-string edit + 1 doc comment

## Problem

Every node on the decision-map canvas is clickable (clicking opens the
inspector), but the node shell gave zero affordance that it is interactive:
no `cursor-pointer`, and no hover state. The pointer stayed a default arrow
and nothing changed on hover, so the map read as a static diagram rather than
an explorable surface. Selection is a blue ring and must stay instant.

```tsx
// apps/web/components/dashboard/decision-map/nodes.tsx:44-51 — current (NodeShell root)
<div
  className={cn(
    "relative rounded-none bg-card text-card-foreground ring-1 ring-foreground/10",
    selected && "ring-2 ring-info",
    width,
    className
  )}
>
```

## Target

Add `cursor-pointer` (always) and a hover ring on **unselected** nodes only —
`hover:ring-foreground/20` keeping the ring at width 1 — that eases its
box-shadow over `--duration-instant` (100ms) with `ease-out-quad`. The hover
is gated behind fine pointers (`pointer-fine:`), matching the house
touch-first / hover-enhanced pattern already used in
`packages/ui/src/components/filter-pill.tsx:31`
(`pointer-fine:group-hover/pill:…`). Selection stays **instant**: the
transition is applied only on the unselected branch, so when `selected`
becomes true the element renders with no `transition-*` class and the
`ring-2 ring-info` swap snaps.

```tsx
// nodes.tsx — target (NodeShell root)
<div
  className={cn(
    "relative cursor-pointer rounded-none bg-card text-card-foreground ring-1 ring-foreground/10",
    selected
      ? "ring-2 ring-info"
      : "transition-[box-shadow] duration-[var(--duration-instant)] ease-out-quad pointer-fine:hover:ring-foreground/20",
    width,
    className
  )}
>
```

Why the transition lives on the **unselected branch** and not the base string:
the Tailwind `ring-*` utilities are box-shadow, so a base
`transition-[box-shadow]` would also ease the `ring-1 → ring-2 ring-info`
selection swap. The house posture keeps selection instant (Design.md §1,
"selection stays INSTANT"). Putting the transition on the unselected branch
means it is only present while the node is *not* selected, so only the hover
ring (a color-only `ring-foreground/10 → /20` change at ring width 1) eases;
selection and deselection snap. (An added transition-property does not animate
the value change happening in the same style recalc, so deselection snaps too.)

The NodeShell doc comment (lines 25-31) said "Selection is a blue ring; it is
instant (no transition)". Update it to note the new hover ring while keeping
the instant-selection promise.

## Repo conventions to follow

- Token form only: `duration-[var(--duration-instant)]`, never a numeric
  Tailwind duration (Design.md §2).
- Explicit property list: `transition-[box-shadow]`, never `transition-all`.
- Color/opacity-only change → NO `motion-reduce:` variant needed; the global
  reduced-motion allowlist (globals.css) keeps `box-shadow` transitions
  running (Design.md §11). The hover ring is a `box-shadow`/color change with
  no movement, so it is reduced-motion safe as-is.
- Touch-first: gate hover behind `pointer-fine:` like `filter-pill.tsx`.

## Steps

1. Edit the NodeShell root `className` per Target.
2. Update the NodeShell doc comment to mention the eased hover ring.

## Boundaries

- Do NOT add a transition to the base (always-on) string — selection must stay
  instant.
- Do NOT change the ring **width** on hover (stays `ring-1`); only the color
  deepens (`/10 → /20`). Width changes on hover would shift the node's paint.
- Do NOT touch the Handle ports, the node body markup, or any per-node
  component.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green (verified).
- **Feel check** (verified in headless Chromium against
  `/demo/runs/run_8c41cf/decisions/dec_c12f8b7a`):
  - Unselected shell computed `cursor: pointer` ✓.
  - Rest ring `--tw-ring-color` = foreground @ 10%, width 1px ✓.
  - `transition-property: box-shadow`, `duration 0.1s`,
    `ease-out-quad` on unselected shell ✓.
  - On real hover of an unselected shell: `--tw-ring-color` = foreground @ 20%,
    box-shadow last layer alpha ≈ 0.2 at width 1px ✓.
  - Selected node (`analyst:macro-context`) shell computed
    `transition-property: all, duration 0s` — i.e. no transition → selection is
    instant ✓.
  - Zero JS console errors.
- **Done when**: cursor is a pointer, unselected nodes deepen their ring on
  hover over 100ms, selection stays instant, typecheck green. All met.
