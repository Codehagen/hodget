# 007 — Tooltips appear instantly after the first in a group

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: LOW
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file (packages/ui/src/components/tooltip.tsx)

## Problem

Audit rule: "tooltip delay + animation on every tooltip in a toolbar — after
the first, they should be instant." The provider already suppresses the *delay*
for subsequent tooltips (`delay = 0` default at tooltip.tsx:7-14, and Base UI's
provider grouping), but the 150ms scale/opacity entrance still replays on every
tooltip as you sweep across a toolbar row:

```tsx
// packages/ui/src/components/tooltip.tsx:53 — current (excerpt)
"... transition-[opacity,transform] duration-150 ease-out-quart data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100"
```

Sweeping a 6-button toolbar plays six 150ms entrances — the animation stops
carrying information after the first.

## Target

When a tooltip opens *instantly* (provider group already warm, i.e. Base UI
opens it with no delay because a sibling tooltip was just open), the entrance
transition is skipped. Base UI exposes this state: the popup receives
`data-instant` (value `delay`/`focus`/`dismiss` variants exist) when it opens
without the delay. Gate the transition on it:

```tsx
// target — add to the popup class string
"data-[instant]:transition-none data-[instant]:data-starting-style:scale-100 data-[instant]:data-starting-style:opacity-100"
```

**Verify the attribute first**: render two adjacent tooltips in the playbook,
hover the first, then the second, and inspect the popup in DevTools. If Base UI
uses a different attribute than `data-instant` for the grouped-open state (its
docs call the concept "instant phase"), adjust the selector to the attribute
actually present. If no such attribute exists in the installed Base UI version,
STOP and report — do not hand-roll provider state tracking for a LOW finding.

Exit stays as-is (100ms fade-out is fine; only entrances repeat).

## Repo conventions to follow

- Keep everything in the class string; no new props, no JS state (house style:
  smallest possible API change).
- Data-attribute variants follow the existing pattern
  (`data-starting-style:`, `data-[align-trigger=true]:` in select.tsx:87).

## Steps

1. Confirm the instant-open data attribute on `TooltipPrimitive.Popup` in
   DevTools (see Target).
2. Add the gating classes to `tooltip.tsx:53`.

## Boundaries

- Do NOT change the provider `delay` default or tooltip timing for the first
  open.
- Do NOT touch popover/menu/select (they are click-opened; the rule is
  tooltip-specific).
- STOP if the attribute doesn't exist (see Target).

## Verification

- **Mechanical**: `pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` → any section with multiple
  tooltips (or the button row): hover the first button — tooltip animates in
  (150ms scale+fade). Without leaving, slide to the next button — its tooltip
  appears **instantly**, no scale, no fade. Leave the group for 2+ seconds,
  hover again — the entrance animation is back.
- **Done when**: first tooltip animates, subsequent group tooltips render
  fully-formed.
