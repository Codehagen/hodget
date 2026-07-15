# 017 — Runs inspector entrance fade

- **Status**: DONE
- **Commit**: 2526020
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 1 file (apps/web/components/dashboard/runs/run-inspector.tsx), 1 class edit

## Problem

On the Runs page, selecting a row opens a 340px inspector panel and the
master list narrows to make room. Closing it does the reverse. Both happen in
a single frame — a large piece of UI teleports in with zero acknowledgment,
which reads as a glitch rather than a response to the click.

The grid flip lives in the view:

```tsx
// apps/web/components/dashboard/runs-view.tsx:165-169 — current
<MasterDetail
  className={cn(
    "gap-6",
    selectedRow ? "lg:grid-cols-[1fr_340px]" : "lg:grid-cols-1"
  )}
>
```

The panel is conditionally rendered — it mounts fresh whenever `selectedRow`
goes from `null` to a row, and unmounts on close:

```tsx
// apps/web/components/dashboard/runs-view.tsx:221-227 — current
{selectedRow ? (
  <RunInspector
    row={selectedRow}
    basePath={basePath}
    onClose={() => setSelectedId(null)}
  />
) : null}
```

And the inspector's root element:

```tsx
// apps/web/components/dashboard/runs/run-inspector.tsx:102-103 — current
return (
  <MasterDetailPanel className="flex flex-col gap-4">
```

## Target

Opacity-only entrance on the panel — one class:

```tsx
// apps/web/components/dashboard/runs/run-inspector.tsx — target
return (
  <MasterDetailPanel className="flex flex-col gap-4 motion-safe:animate-fade-in">
```

That's the whole change. `animate-fade-in` is the shared keyframe utility
(`fade-in var(--duration-base) var(--ease-out-quart)`, defined in
`packages/ui/src/styles/globals.css:92` with the keyframes at lines 102-108)
— the panel fades in over 200ms on mount.

Deliberate non-goals, per house posture:

- **No exit animation.** Instant-out is the house default (cf. Design.md §6
  dialog recipe: "fast in, instant out"). On close, the panel unmounts in one
  frame — leave it.
- **No transition on the grid columns.** Animating `grid-template-columns` is
  a layout animation (Design.md §10); the list snapping wider/narrower
  instantly while the panel fades is the intended compromise.
- **No key on `RunInspector`.** Because it is conditionally rendered
  (`runs-view.tsx:221-227`), it already remounts on `null → row`, which is
  the only moment the fade should play. Switching selection from one row to
  another does NOT remount (props update in place) and must NOT re-fade —
  row-to-row switches are high-frequency and stay instant per Design.md's
  frequency rule (already noted in the view's own doc comment,
  `runs-view.tsx:104`: "no row-select animation, per Design.md's frequency
  rule"). Verify this conditional render still exists; if the code has
  changed such that the panel no longer remounts when going from closed to
  open, key the panel on presence instead — otherwise leave keys alone.

Reduced motion needs nothing extra: `motion-safe:` skips the keyframe for
reduced-motion users outright, and even without the variant the global layer
flattens keyframes (`globals.css:277`) — the variant just makes the intent
explicit at the call site.

## Repo conventions to follow

- Keyframe utilities live in `packages/ui/src/styles/globals.css:87-99`
  (`--animate-fade-in: fade-in var(--duration-base) var(--ease-out-quart)`);
  consumed as `animate-fade-in`, gated with `motion-safe:` at the Tailwind
  variant level — the same pattern as the checkbox's
  `motion-safe:animate-draw-stroke` (see Design.md §6, checkbox recipe).
- Entrances use ease-out + short durations (Design.md §3-4).
- No new keyframes, no new tokens — reuse `animate-fade-in` as-is.

## Steps

1. In `apps/web/components/dashboard/runs/run-inspector.tsx:103`, change
   `className="flex flex-col gap-4"` to
   `className="flex flex-col gap-4 motion-safe:animate-fade-in"`.
2. Confirm in `apps/web/components/dashboard/runs-view.tsx:221-227` that the
   inspector is still conditionally rendered (`{selectedRow ? … : null}`). If
   it is, no further change. If it has drifted to an always-mounted panel,
   STOP and report (do not improvise a key without seeing the new shape).

## Boundaries

- Do NOT touch `runs-view.tsx` (unless the step-2 check fails — then STOP,
  don't edit).
- Do NOT add exit animation, grid transitions, width/transform animation, or
  any state/keys.
- Do NOT modify `MasterDetailPanel` in `packages/ui`.
- Do NOT add new dependencies.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`,
  go to Runs:
  - The inspector is open by default (first row selected) and fades in with
    the page.
  - Close it (X), then click a row: the panel fades in over ~200ms while the
    table snaps to its narrower width instantly. No sliding, no width tween.
  - With the panel open, click a *different* row: content swaps instantly —
    NO re-fade.
  - Close: the panel disappears in one frame (intended).
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: opening the
    panel shows it immediately at full opacity (no fade).
- **Done when**: open = fade, row-switch = instant, close = instant,
  reduced-motion = instant, typecheck green.
