# 003 — Drawer fades instead of teleporting under reduced motion

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (packages/ui/src/styles/globals.css), ~10 lines

## Problem

The reduced-motion layer strips movement properties from all transitions and
re-opts dialogs into a plain fade — but only dialogs:

```css
/* packages/ui/src/styles/globals.css:247-252 — current */
  /* Modals should still fade, not teleport. The command palette
     (data-command-dialog) stays instant. */
  [data-slot="dialog-content"][data-open]:not([data-command-dialog]),
  [data-slot="dialog-overlay"][data-open]:not(:has(~ [data-command-dialog])) {
    animation: fade-in var(--duration-fast) var(--ease-out-quad) !important;
  }
```

The drawer popup's entrance is built almost entirely from `transform`
(`data-starting-style:transform-(--closed-transform)` in
`packages/ui/src/components/drawer.tsx:125,135`) with opacity held at ~1
(`data-ending-style:opacity-[0.9999]`). Under reduced motion the global layer
removes `transform` from `transition-property` (globals.css:242-243), so the
popup **snaps from off-screen to fully open with no feedback at all** — a
teleport — while its overlay still fades. The sheet keeps a fade (its popup
transitions `opacity` too), so the drawer is the one surface that loses all
entrance feedback.

## Target

Extend the same re-opt-in rule to the drawer popup and its overlay. The drawer
opens via Base UI `data-open`/starting-style transitions (not keyframes), so
give it the identical keyframe fade the dialog uses — the `!important`
animation plays regardless of the stripped transition:

```css
/* target — extend the existing rule's selector list */
  [data-slot="dialog-content"][data-open]:not([data-command-dialog]),
  [data-slot="dialog-overlay"][data-open]:not(:has(~ [data-command-dialog])),
  [data-slot="drawer-popup"][data-open],
  [data-slot="drawer-overlay"][data-open] {
    animation: fade-in var(--duration-fast) var(--ease-out-quad) !important;
  }
```

Verify the drawer popup actually carries `data-open` when open (Base UI sets
open-state data attributes; if the attribute is named differently on the
drawer, e.g. only `data-starting-style` phases, adjust the selector to match
the real open-state attribute observed in DevTools — the requirement is: a fade
plays on open under reduced motion).

## Repo conventions to follow

- The reduced-motion layer is centralized at the bottom of
  `packages/ui/src/styles/globals.css` — extend the existing rule; do not add
  per-component CSS or touch `drawer.tsx`.
- Comment style: short English comments stating the constraint (see the
  existing "Modals should still fade, not teleport" comment — update it to
  mention drawers).

## Steps

1. In `packages/ui/src/styles/globals.css`, extend the re-opt-in selector list
   with `[data-slot="drawer-popup"][data-open]` and
   `[data-slot="drawer-overlay"][data-open]`, and update the comment to
   "Modals and drawers should still fade, not teleport."
2. Open the playbook drawer demo with reduced motion emulated and confirm the
   attribute match (step 1's selector) actually fires; adjust the open-state
   attribute if DevTools shows a different one.

## Boundaries

- Do NOT touch `drawer.tsx` or any component file.
- Do NOT alter the drawer's normal-motion behavior (swipe tracking,
  `--drawer-swipe-strength` release, `ease-ios-sheet`) — this plan is only the
  reduced-motion branch.
- If the globals.css rule at :247-252 has drifted, STOP and report.

## Verification

- **Mechanical**: `pnpm --filter web build` — green.
- **Feel check**: `pnpm --filter web dev` → `localhost:3000/playbook` →
  Overlays section → open the drawer:
  - Normal: slides in with the iOS-sheet curve, unchanged.
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: the popup
    **fades in in place** (no slide, no teleport); the overlay fades; closing
    does not fling the panel.
- **Done when**: under reduced motion the drawer's open is a visible fade, not
  an instant appearance, and normal motion is untouched.
