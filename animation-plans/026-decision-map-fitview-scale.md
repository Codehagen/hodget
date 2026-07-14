# 026 — Decision-map fitView caps at 1:1 for crisp nodes

- **Status**: DONE
- **Commit**: 9ceb076
- **Severity**: LOW
- **Category**: Polish
- **Estimated scope**: 1 file (apps/web/components/dashboard/decision-map/decision-flow.tsx), 2 edits

## Problem

`fitView` scales the graph to fill the canvas. With only
`fitViewOptions={{ padding: 0.16 }}` and `maxZoom: 1.5`, a wide viewport lets
fitView zoom **past 1:1**, up-scaling the node cards and their text so they
look soft/blurry rather than crisp. And the canvas was a fixed `h-[560px]`,
which under-serves the 3-analyst column (the tallest stack) when height is the
binding constraint.

```tsx
// apps/web/components/dashboard/decision-map/decision-flow.tsx:43,62 — current
<div className="h-[560px] w-full">
  <ReactFlow
    …
    fitView
    fitViewOptions={{ padding: 0.16 }}
    minZoom={0.3}
    maxZoom={1.5}
  />
</div>
```

## Target

Cap the fit zoom at 1 so the graph never renders larger than 1:1 (text stays
crisp; fitView still zooms **out** to fit when the graph is larger than the
canvas), and bump the canvas height to `h-[640px]` to give the analyst column
more room when height is the constraint.

```tsx
// decision-flow.tsx — target
<div className="decision-map-canvas h-[640px] w-full">
  …
  fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
```

`fitViewOptions.maxZoom` caps only the **fit** zoom (independent of the
interaction `maxZoom={1.5}`, which is left as-is). (`decision-map-canvas` scope
class is shared with plans 024/025.)

## Behavior note (measured)

At a typical 1440px-wide layout the graph is horizontally constrained (five
stage columns at 340px stride), so fitView already zooms **out** to ~0.44 to
fit — well under 1 — and `maxZoom: 1` does not bind there. `maxZoom: 1` is a
**correctness guard**: it prevents up-scaling on very wide / short viewports
where fitView would otherwise zoom past 1 and blur the text. The `h-[640px]`
bump adds vertical breathing room and helps when height (not width) is the
binding dimension (narrower/taller viewports, or the shorter no-trade graph).
Both pages render readable with no clipping.

## Repo conventions to follow

- No motion tokens involved (this is a layout/zoom cap, not an animation).
- No layout shift / crisp rendering (Design.md §12): capping at 1:1 keeps card
  text from being up-scaled.

## Steps

1. Change the canvas wrapper height `h-[560px]` → `h-[640px]`.
2. Add `maxZoom: 1` to `fitViewOptions` (keep `padding: 0.16`).

## Boundaries

- Do NOT change the interaction `maxZoom={1.5}` or `minZoom={0.3}`.
- Do NOT change `padding`, the layout `STRIDE`, or node positions in
  `layout.ts`.
- Do NOT add scroll/pan/zoom interactions — the canvas stays read-only.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green (verified).
- **Feel check** (verified in headless Chromium):
  - `/demo/runs/run_8c41cf/decisions/dec_c12f8b7a`: canvas height 640px; 8
    nodes / 9 edges; fit zoom ≈ 0.44 (graph wider than viewport → zooms out,
    never past 1); nodes legible, no clipping ✓.
  - `/demo/runs/run_8c41cf/decisions/dec_b91e4c33` (no-trade): 6 nodes / 7
    edges, no execution node, committee → risk-gate "PASSED" path renders;
    nodes legible ✓.
  - The React Flow "parent container needs a width and a height" console
    **warning** appears transiently during hydration (the canvas has an
    explicit `h-[640px]`); it is benign, pre-existing React Flow mount
    behavior, not an error and not a regression from this change.
- **Done when**: fitView never up-scales past 1:1, the canvas is 640px tall,
  both the trade and no-trade decisions render readable and unclipped;
  typecheck green. All met.
