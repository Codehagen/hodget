# 023 — Decision-map inspector follows keyboard selection

- **Status**: DONE
- **Commit**: 9ceb076
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (apps/web/components/dashboard/decision-map/decision-flow.tsx), swap one handler

## Problem

The canvas sets `nodesFocusable`, so nodes are keyboard-reachable (Tab) and
React Flow selects a focused node on Enter/Space — the blue selection ring
follows the keyboard. But the inspector's `selectedId` was driven **only** by
`onNodeClick`, a mouse-only handler. A div node with `tabindex=0` does not
dispatch a synthetic `click` on Enter (only buttons/links do), so keyboard
selection updated React Flow's internal selection (and the ring) while the
inspector stayed stranded on whatever was last clicked. Keyboard users could
select a node and see the wrong details.

```tsx
// apps/web/components/dashboard/decision-map/decision-flow.tsx:49-50 — current
onNodeClick={(_, node) => setSelectedId(node.id)}
onPaneClick={() => setSelectedId(null)}
```

## Target

Drive `selectedId` from React Flow's `onSelectionChange`, which fires for
**both** pointer and keyboard selection. `multiSelect` is off by default, so
the selection set holds at most one node; take `nodes[0]?.id ?? null`. Keep
`onPaneClick` clearing (redundant with the empty-selection path, but explicit).

```tsx
// decision-flow.tsx — target
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type OnSelectionChangeParams,
} from "@xyflow/react"

// …inside Flow, after `edges`:
const handleSelectionChange = React.useCallback(
  ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    setSelectedId(selectedNodes[0]?.id ?? null)
  },
  []
)

// …on <ReactFlow>: replace onNodeClick with
onSelectionChange={handleSelectionChange}
onPaneClick={() => setSelectedId(null)}
```

`onNodeClick` is removed: clicking a node still selects it in React Flow, which
fires `onSelectionChange`, so pointer selection keeps working through the same
path. The initial `selected: true` on the primary analyst (set in
`layout.ts` `buildNodes`) fires `onSelectionChange` once on init with that
node, keeping `selectedId` in sync with the initial `useState`.

## Repo conventions to follow

- `onSelectionChange` is the standard React Flow prop (v12.11.2) and is safe to
  pass; only the `useOnSelectionChange` **hook** requires a memoized handler.
  The handler is wrapped in `React.useCallback` for cleanliness anyway.
- Keyboard nav must work consistently; DOM order = visual order; real selection
  feedback (Design.md §12).

## Steps

1. Import `type OnSelectionChangeParams` from `@xyflow/react`.
2. Add the `handleSelectionChange` `useCallback`.
3. Replace `onNodeClick={…}` with `onSelectionChange={handleSelectionChange}`;
   leave `onPaneClick` as-is.

## Boundaries

- Do NOT enable `multiSelect` — the inspector shows exactly one node.
- Do NOT remove `onPaneClick` (clears on empty-canvas click).
- Do NOT change `nodesFocusable`, `elementsSelectable`, or the initial
  `selected` seeding in `layout.ts`.

## Verification

- **Pre-fix confirmation (structural)**: `onNodeClick` binds the DOM `click`
  event; a focusable `<div>` fires no `click` on Enter, so pre-fix keyboard
  Enter selected the node in React Flow (ring moved) but never called
  `setSelectedId` → inspector stale. Confirmed by reading React Flow's
  keyboard-selection path (keydown → select → `onSelectionChange`, not
  `onNodeClick`).
- **Mechanical**: `pnpm turbo typecheck` — green (verified).
- **Feel check** (verified in headless Chromium against
  `/demo/runs/run_8c41cf/decisions/dec_c12f8b7a`):
  - Focused `analyst:macro-context` node (tabindex=0) and pressed **Enter**:
    inspector title updated to "Macro context" and the node gained
    `.react-flow__node.selected` ✓.
  - Clicking a different analyst still updates the inspector (pointer path
    through `onSelectionChange`) ✓ — verified inspector switched to
    "Earnings drift" on click.
  - Exactly one node selected at a time.
  - Zero JS console errors.
- **Done when**: Tab + Enter selects a node and the inspector reflects it;
  clicking still works; typecheck green. All met.
