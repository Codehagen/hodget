# 006 — Stop animating layout properties in sidebar and filter-pill

- **Status**: DONE
- **Commit**: ba46291
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files (sidebar.tsx, filter-pill.tsx); the sidebar part is a genuine refactor

## Problem

Layout properties (`width`, `left`, `right`, `margin`, `padding`, `height`)
trigger layout + paint + composite every frame. The sidebar collapse animates
several of them across the full viewport height, and the filter pill reveals an
icon by animating `width` from zero:

```tsx
// packages/ui/src/components/sidebar.tsx:234 — current (fixed container)
"... w-(--sidebar-width) transition-[left,right,width] duration-200 ease-in-out-quart ..."
```

```tsx
// packages/ui/src/components/sidebar.tsx:222 — current (gap element)
"... w-(--sidebar-width) ... transition-[width] duration-200 ease-in-out-quart ..."
```

```tsx
// packages/ui/src/components/sidebar.tsx:479 — current (menu button, per row)
"... transition-[width,height,padding] ..."
```

```tsx
// packages/ui/src/components/sidebar.tsx:404 — current (group label)
"... transition-[margin,opacity] ... group-data-[collapsible=icon]:-mt-8 ..."
```

```tsx
// packages/ui/src/components/filter-pill.tsx:29 — current
"... transition-[width,transform,opacity] duration-200 ease-out-quart ... group-hover/pill:w-3.5 ..."
```

Settled exceptions (do not change): `accordion.tsx:58` height transition is the
idiomatic accordion pattern with `[interpolate-size:allow-keywords]`;
`progress.tsx:48` width IS the semantic value. Leave both, but add a short
comment at `accordion.tsx:58` documenting the deliberate tradeoff.

## Target

This is the shadcn-derived sidebar pattern, so a full transform rewrite risks
breaking its layout contract. Scope precisely:

1. **filter-pill.tsx:29** — replace the width reveal with a transform+opacity
   reveal: keep the element at its natural width, hidden via
   `scale-x-0 opacity-0 origin-left` (classes: `origin-left scale-x-0 opacity-0
   group-hover/pill:scale-x-100 group-hover/pill:opacity-100
   transition-[transform,opacity]`), preserving the existing duration/easing.
   If the pill's layout genuinely requires the element to occupy zero width
   when hidden (check: does the label shift on hover?), then the label shift is
   part of the design — in that case keep `width` in the transition but
   document it with a comment, and report this outcome.
2. **sidebar.tsx:404 (group label)** — the `-mt-8` margin animation moves the
   label up when collapsing to icon mode. Replace `transition-[margin,opacity]`
   with `transition-[transform,opacity]` and swap
   `group-data-[collapsible=icon]:-mt-8` for
   `group-data-[collapsible=icon]:-translate-y-8` **only if** the following
   elements don't need to reflow into the label's space (inspect in DevTools;
   if they do reflow, the margin animation is load-bearing — keep it and
   document with a comment).
3. **sidebar.tsx:479 (menu button)** — `transition-[width,height,padding]`
   animates three layout props per menu row on every collapse. The icon-mode
   snap does not need to be smooth per-row (the container's motion carries the
   transition). Remove `width,height,padding` from the transition (keep any
   color/opacity the row transitions, or drop the transition classes entirely
   if nothing else animates).
4. **sidebar.tsx:222,234 (container/gap)** — leave the width/left/right
   transitions in place (the fixed sidebar's collapse is structurally a layout
   animation in this pattern and a transform rewrite is out of scope), but add
   one comment above the classes documenting the accepted tradeoff:
   `/* Collapse animates width/left — a deliberate tradeoff inherited from the
   sidebar pattern; the surface is a solid panel so paint cost is bounded. */`

## Repo conventions to follow

- Transform-based reveals exemplar: `packages/ui/src/components/popover.tsx:40`
  (`transition-[opacity,transform]` + scale).
- Comments state constraints, in English, only where the code can't show them
  (house style).

## Steps

1. filter-pill.tsx per target 1 (with its decision branch).
2. sidebar.tsx:404 per target 2 (with its decision branch).
3. sidebar.tsx:479 per target 3.
4. sidebar.tsx:222,234 comment per target 4.
5. accordion.tsx:58 — add the settled-tradeoff comment.

## Boundaries

- Do NOT restructure the sidebar's DOM or CSS variables.
- Do NOT change durations/easings (plan 005 owns those).
- Do NOT touch accordion/progress behavior.
- If a decision branch (targets 1–2) lands on "keep layout animation", that is
  a valid outcome — document and report it, don't force the transform.

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui lint && pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` (templates section uses the
  sidebar) or any page with the sidebar: toggle collapse repeatedly —
  DevTools Performance panel recording shows no long purple (layout) bars from
  menu rows; the pill icon reveal on hover looks identical or better (no text
  jumping unless the width-keep branch was taken).
- **Done when**: per-row layout transitions are gone, the pill reveal is
  transform-based (or documented as load-bearing), and the two accepted layout
  animations carry explanatory comments.
