# 025 — Decision-map one-time staggered entrance

- **Status**: DONE
- **Commit**: 9ceb076
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 3 files (decision-flow.css, layout.ts, decision-flow.tsx wire-up)

## Problem

The whole canvas appears at once on mount. A gentle left-to-right stagger by
stage column — the same "wave" Design.md §9 recommends — reads as the pipeline
assembling itself (data → views → committee → construction/risk → execution),
which is exactly the story this map tells. It is a mount-once nicety, never a
hot path, and must never replay.

## Target

On mount only, fade each `.react-flow__node` in with the house `fade-in`
keyframe (`var(--animate-fade-in)` = `fade-in var(--duration-base)
var(--ease-out-quart)`), delayed per stage column so columns cascade
left-to-right. The edges layer fades with the canvas. `motion-safe` only.

**Per-node delay via inline longhand.** Each node carries its stage delay as an
inline `animation-delay` (plus `animation-fill-mode: backwards` so a delayed
node starts invisible) set on the React Flow node wrapper via the node's
`style` field in `buildNodes`. Inline longhands **override** the `animation`
shorthand emitted by the stylesheet rule (an inline declaration beats a
stylesheet one), so the shorthand's implicit `animation-delay: 0` /
`fill-mode: none` don't clobber them. Stagger is `stageIndex * 60ms`
(0 / 60 / 120 / 180 / 240ms), inside Design.md's 40–60ms range.

```ts
// apps/web/components/dashboard/decision-map/layout.ts — added helper
const STAGE_STAGGER_MS = 60
function entranceStyle(stageIndex: number) {
  return {
    animationDelay: `${stageIndex * STAGE_STAGGER_MS}ms`,
    animationFillMode: "backwards" as const,
  }
}
// each node gains `style: entranceStyle(<stageIndex>)`:
//   data 0 · analysts 1 · committee 2 · construction/risk 3 · execution 4
```

```css
/* decision-flow.css */
@media (prefers-reduced-motion: no-preference) {
  .decision-map-canvas .react-flow__node  { animation: var(--animate-fade-in); }
  .decision-map-canvas .react-flow__edges { animation: var(--animate-fade-in); }
}
```

**Why a stylesheet, not a Tailwind arbitrary selector.** Same reason as plan
024: React Flow's `react-flow__node` BEM class is mangled by Tailwind's
`_ → space` conversion, so `[&_.react-flow__node]:motion-safe:animate-fade-in`
generates nothing. The rule lives in the colocated `decision-flow.css` (created
in 024), gated in an explicit `prefers-reduced-motion: no-preference` block to
mirror `motion-safe:`. The `fade-in` keyframe animates **opacity only** — no
movement — so it never fights React Flow's `transform` positioning on the same
wrapper.

**Plays once, never replays.** The animation is a static CSS keyframe applied
on mount. React Flow keeps nodes mounted across selection changes (selection
only re-renders the inner NodeShell className), so the entrance runs exactly
once and does not replay on select/deselect.

## Repo conventions to follow

- `var(--animate-fade-in)` is the house mount-once enter token (Design.md §2).
- Stagger interval 40–60ms (Design.md §9, §16).
- `animation-fill-mode: backwards` for delayed enters (Design.md §5).
- `motion-safe` gating; keyframes are additionally flattened by the global
  reduced-motion layer, so reduced-motion users just get static nodes
  (Design.md §11).

## Steps

1. Add `entranceStyle` + `STAGE_STAGGER_MS` to `layout.ts`; attach
   `style: entranceStyle(n)` to each pushed node with its stage index.
2. Add the `prefers-reduced-motion: no-preference` block to `decision-flow.css`
   (node + edges fade).
3. (Wrapper `.decision-map-canvas` scope class + CSS import already added by
   plan 024.)

## Boundaries

- Do NOT drive the delay through a Tailwind class or a shorthand `animation`
  inline — inline **longhand** (`animationDelay`) is required to win over the
  stylesheet shorthand.
- Do NOT animate transform/position (opacity only) — the node wrapper's
  `transform` is React Flow's positioning.
- Do NOT over-engineer edges: one fade on the `.react-flow__edges` layer, no
  per-edge delay.
- Keep it subtle: `--duration-base`, 60ms/column.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green (verified).
- **Feel check** (verified in headless Chromium against
  `/demo/runs/run_8c41cf/decisions/dec_c12f8b7a`):
  - Node computed `animation-name: fade-in`, `duration 0.2s`,
    `fill-mode: backwards` ✓.
  - Inline `animation-delay` per column: `0 / 60 / 120 / 180 / 240ms` across
    the 8 nodes in stage order ✓.
  - `.react-flow__edges` computed `animation-name: fade-in` ✓.
  - Selecting / deselecting nodes does not restart the entrance (nodes stay
    mounted) ✓.
  - `prefers-reduced-motion: reduce` → the `no-preference` block drops out and
    the global layer flattens keyframes, so nodes appear statically (verified
    structurally).
  - Zero JS console errors.
- **Done when**: on mount, columns fade in left-to-right once; no replay on
  selection; reduced-motion is static; typecheck green. All met.
