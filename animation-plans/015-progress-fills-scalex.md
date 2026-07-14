# 015 — Progress fills animate scaleX, not width

- **Status**: TODO
- **Commit**: 2526020
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files (packages/ui/src/components/progress.tsx, apps/web/components/dashboard/runs/run-progress.tsx), ~10 lines

## Problem

Both progress fills animate `width`, a layout property — every frame of the
sweep triggers layout + paint instead of a GPU-composited transform. The bars
are small so it's not (yet) a dropped-frames emergency, but a live-updating
run list will have many of these sweeping at once, and the repo's own guide
(Design.md §10) forbids animating layout properties when a transform encodes
the same thing.

```tsx
// packages/ui/src/components/progress.tsx:41-52 — current
function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("h-full bg-primary transition-[width] duration-[var(--duration-slow)] ease-out-quart", className)}
      {...props}
    />
  )
}
```

Here the width itself is set by Base UI: `ProgressPrimitive.Indicator`
applies an inline style derived from the Root's `value`.

```tsx
// apps/web/components/dashboard/runs/run-progress.tsx:49-57 — current
<div className={cn("h-1 min-w-0 flex-1 bg-muted", trackClassName)} aria-hidden>
  <span
    className={cn(
      "block h-full transition-[width] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none",
      FILL_TONE[status]
    )}
    style={{ width: `${pct}%` }}
  />
</div>
```

These two are a **matched pair** with the score ring: Design.md §6
("Score-ring sweep") documents that `score-meter.tsx`'s ring transitions
`stroke-dashoffset` with the *same* `duration-[var(--duration-slow)]
ease-out-quart` as `progress.tsx`'s width sweep — "Two different visual
encodings of the same value must animate identically — a lesson learned from
a real inconsistency (the ring used to jump while the bar swept) and now
enforced as a matched pair." This plan must keep the pair matched: same
tokens, same visual result, only the animated property changes.

## Target

Render each fill at full width and drive the value with
`transform: scaleX(ratio)` from an `origin-left`, transitioning `transform`
instead of `width`:

```tsx
// apps/web/components/dashboard/runs/run-progress.tsx — target
<div
  className={cn("h-1 min-w-0 flex-1 overflow-hidden bg-muted", trackClassName)}
  aria-hidden
>
  <span
    className={cn(
      "block h-full w-full origin-left transition-transform duration-[var(--duration-slow)] ease-out-quart",
      FILL_TONE[status]
    )}
    style={{ transform: `scaleX(${pct / 100})` }}
  />
</div>
```

Note the two deliberate deltas beyond the transform swap:

- `overflow-hidden` on the track (defensive; the fill never exceeds 1 but a
  scaled child should be clipped by its track, matching `ProgressTrack`'s
  existing `overflow-x-hidden`).
- `motion-reduce:transition-none` is **removed**: the global reduced-motion
  layer (`packages/ui/src/styles/globals.css:273-282`) restricts
  `transition-property` to a color/opacity allowlist, so a `transform`
  transition is auto-stripped — the explicit variant becomes redundant. (It
  was load-bearing for `width` only in the sense of belt-and-braces; width is
  also outside the allowlist.)

For `progress.tsx` the same idea applies, but **Base UI owns the Indicator's
sizing** — check before editing. Render the demo progress bar (or read
`node_modules/@base-ui/react`'s Progress source / Base UI docs) and determine
how `ProgressPrimitive.Indicator` expresses the value:

- **If it sets an inline `width` percentage** (the expected case): keep the
  Indicator as the full-width track-filling element and wrap the visible fill
  inside it — i.e. give the Indicator `h-full w-full` with NO background and
  render a child `<span className="block h-full w-full origin-left bg-primary
  transition-transform duration-[var(--duration-slow)] ease-out-quart" />`
  scaled via `scaleX`… **only if** the primitive exposes the ratio to style
  against (e.g. a CSS variable or `data-` attribute). If it exposes nothing
  usable and only sets `width` inline, an alternative is to override with
  `!w-full` and compute `scaleX` from the Root `value` prop — but that
  re-implements the primitive's contract. **If the primitive API fights this
  (no clean way to get the ratio), STOP on the progress.tsx half and report;
  land the run-progress.tsx half alone** (it is fully hand-rolled and carries
  the dashboard usage).
- **If it already sets a `transform`** (some Base UI versions do): just change
  the class from `transition-[width]` to `transition-transform` and verify.

## Repo conventions to follow

- Duration/easing tokens stay exactly as they are:
  `duration-[var(--duration-slow)] ease-out-quart` (tokens defined in
  `packages/ui/src/styles/globals.css:75-77,191-195`).
- The matched-pair rule, Design.md §6 "Score-ring sweep" — this plan must not
  change perceived timing on either bar, or the pair with
  `score-meter.tsx:167` breaks.
- Transform-over-layout rule: Design.md §10 (Performance).
- Reduced-motion posture: transform transitions need no `motion-reduce:`
  variant — the allowlist strips them (Design.md §11).

## Steps

1. Edit `apps/web/components/dashboard/runs/run-progress.tsx:49-57` to the
   target above (w-full + origin-left + scaleX style + transition-transform;
   drop `motion-reduce:transition-none`; add `overflow-hidden` to the track).
   Also update the component's doc comment (lines 10-14 mention "The width
   transition") to say the fill scales via transform.
2. Investigate `ProgressPrimitive.Indicator` sizing per the Target section.
3. Apply the matching change to `packages/ui/src/components/progress.tsx:48`
   using whichever branch step 2 selected — or STOP and report on that half
   if the primitive fights it.
4. Grep for other `transition-[width]` occurrences in
   `apps/web/components/dashboard` and `packages/ui/src/components` to
   confirm none were missed (`score-meter.tsx`'s `stroke-dashoffset` is NOT
   width — leave it).

## Boundaries

- Do NOT change bar colors, sizes, layout, the `showValue` figure, or the
  `FILL_TONE` mapping.
- Do NOT touch `packages/ui/src/components/score-meter.tsx` — its
  `stroke-dashoffset` transition is the correct SVG analogue and keeps its
  explicit `motion-reduce:transition-none` (stroke-dashoffset is not in the
  allowlist).
- Do NOT add new dependencies.
- If the code you find differs from the excerpts (drift since 2526020), STOP
  and report.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`:
  - Runs view: every row's progress bar renders at the same visual fill as
    before (compare 12%, 100%, queued "—" rows against production/screenshots
    — a 62% bar must still read 62%).
  - Open the run inspector (click a row): its Progress detail row matches the
    table's bar exactly.
  - In DevTools, edit a row's `scaleX(...)` value live: the fill sweeps with a
    decelerating tail over ~300ms — identical feel to the old width sweep.
  - Performance panel sanity: recording while forcing a value change shows no
    Layout entries attributable to the bar (composite-only).
  - Toggle `prefers-reduced-motion: reduce`: fills snap to their value with
    no sweep (allowlist strips transform) — same end state.
  - If step 3 landed: the playbook progress demo (`localhost:3000/playbook`)
    still fills correctly and sweeps on value change.
- **Done when**: both bars (or run-progress alone + a written report on the
  primitive, per the STOP branch) are visually identical to before at rest,
  sweep on transform only, and typecheck is green.
