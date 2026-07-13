# 009 — Sliding tabs indicator (opportunity)

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: LOW (missed opportunity — additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (packages/ui/src/components/tabs.tsx), ~25 lines

## Problem

The `line` variant's active underline is a per-trigger `::after` toggled by
opacity, so switching tabs cross-fades one underline out and another in — the
indicator never travels between tabs:

```tsx
// packages/ui/src/components/tabs.tsx:64 — current (fourth class-string line of TabsTrigger)
"after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100"
```

Tabs are primary navigation, seen constantly; a single indicator that slides
along the list gives spatial continuity (you see *where* you moved) that an
opacity crossfade cannot. Base UI ships `Tabs.Indicator` for exactly this: it
tracks the active tab and exposes its position/size as CSS variables.

## Target

Add a `TabsIndicator` rendered inside `TabsList` for the `line` variant, using
Base UI's `Tabs.Indicator` with its position variables, animated on transform
(GPU-safe), house timing:

```tsx
// target — new element inside TabsList (line variant)
<TabsPrimitive.Indicator
  data-slot="tabs-indicator"
  className={cn(
    "absolute bg-foreground transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none",
    // horizontal: a 2px bar under the active tab, translated + sized via Base UI vars
    "group-data-horizontal/tabs:bottom-[-5px] group-data-horizontal/tabs:left-0 group-data-horizontal/tabs:h-0.5",
    "group-data-horizontal/tabs:w-[var(--active-tab-width)] group-data-horizontal/tabs:translate-x-[var(--active-tab-left)]",
    // vertical mirror
    "group-data-vertical/tabs:-right-1 group-data-vertical/tabs:top-0 group-data-vertical/tabs:w-0.5",
    "group-data-vertical/tabs:h-[var(--active-tab-height)] group-data-vertical/tabs:translate-y-[var(--active-tab-top)]"
  )}
/>
```

**Check the exact CSS variable names** Base UI's `Tabs.Indicator` publishes in
the installed version (inspect the rendered element in DevTools; the docs name
them `--active-tab-left/top/width/height` but verify). Width/height here are
sized (not transitioned) — only `transform` animates, so movement is
composited; the width change during the slide snaps, which reads fine at 2px
thickness. If width snapping looks broken with very different tab widths, add
`width` to the transition and note it as an accepted layout-transition on a
2px element.

Then remove the per-trigger `::after` underline for the `line` variant
(the whole class-string line quoted above) so there's exactly one indicator.

Under `prefers-reduced-motion` the indicator must not slide:
`motion-reduce:transition-none` is included in the target classes (the global
layer also strips transform transitions — the explicit utility is belt and
suspenders, matching tree.tsx:364).

## Repo conventions to follow

- Slot naming: `data-slot="tabs-indicator"` (every component element carries a
  `data-slot`, see tabs.tsx's existing slots).
- Timing: `duration-[var(--duration-base)]` + `ease-out-quart` (movement of an
  on-screen element; `ease-in-out-quart` is also defensible — pick `ease-out-quart`
  to match the system's response-first bias).
- Exemplar for token + motion-reduce: `packages/ui/src/components/tree.tsx:364`.

## Steps

1. Add `TabsIndicator` (a wrapper around `TabsPrimitive.Indicator` following
   the file's function style) and render it inside `TabsList` when the variant
   is `line`; ensure `TabsList` has `relative` positioning for the absolute
   indicator.
2. Verify/adjust the CSS variable names against the rendered DOM.
3. Remove the `::after` underline classes (the quoted line) from `TabsTrigger`.
4. Confirm the `default` (pill) variant is untouched.

## Boundaries

- Do NOT change the `default` variant's appearance.
- Do NOT animate `left`/`top` — position via transform only.
- Do NOT add dependencies (Base UI is already installed).
- If the installed Base UI version has no `Tabs.Indicator` or no position
  variables, STOP and report.

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui typecheck && pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` → tabs demo (line variant):
  - Click across tabs: one underline **slides** from the old tab to the new
    one (~200ms, decelerating). Nothing fades.
  - Click the far tab from the first: the slide covers the distance without
    lag or overshoot; at 10% speed, motion starts fast and eases out.
  - Keyboard navigation (arrow keys) slides the indicator identically.
  - Reduced-motion emulation: the indicator jumps instantly, no slide.
- **Done when**: line-variant tabs have exactly one traveling indicator and the
  pill variant is unchanged.
