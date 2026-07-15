# 036 — Bulk-action bar: budget the entrance, gate it, add press feedback

- **Status**: DONE
- **Commit**: 91466cd
- **Severity**: MEDIUM
- **Category**: Easing & duration / Accessibility gating / Physicality (press feedback)
- **Estimated scope**: 1 file (`packages/ui/src/components/bulk-action-bar.tsx`), 3 class-string edits

## Problem

The floating selected-rows action bar (`packages/ui/src/components/bulk-action-bar.tsx`)
has three motion defects. It is currently consumed only by the playbook demo
(`apps/web/app/playbook/data-table-demo.tsx`), but it is a shared `packages/ui`
primitive that real bulk flows will adopt, so it must match house rules before
it spreads.

**(a) Entrance duration is page-tier on a toast-tier surface.**

```tsx
// packages/ui/src/components/bulk-action-bar.tsx:32 — current
<div className="animate-slide-up-fade pointer-events-auto flex items-center gap-2 rounded-none bg-primary py-2 pr-2 pl-4 text-primary-foreground shadow-lg">
```

`animate-slide-up-fade` resolves to `slide-up-fade var(--duration-page)
var(--ease-out-quart)` = **400ms** (`packages/ui/src/styles/globals.css:95`,
duration defined at `:202`). The bar is a small floating affordance that
appears in direct response to a row selection — Design.md §5's budget for
standard UI is 150–250ms, and the 400ms page tier is reserved for page-level
entrances. At 400ms the bar is still sliding while the user is already
reaching for its buttons.

**(b) The keyframe is not motion-gated.** House convention (stated in
`globals.css:88-89`: "Pair every animated element with
`motion-reduce:animate-none`", and practiced as `motion-safe:animate-*` in,
e.g., `apps/web/components/dashboard/runs/run-inspector.tsx:103`) is to gate
every `animate-*` utility explicitly rather than rely only on the global
reduced-motion clamp. This is the only ungated `animate-*` in
`packages/ui/src/components/`.

**(c) The bar's buttons have no press feedback.** Both the inline Deselect
button and the shared `BulkActionButton` transition colors only:

```tsx
// packages/ui/src/components/bulk-action-bar.tsx:41 — current (Deselect)
className="rounded-none px-2.5 py-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground"
```

```tsx
// packages/ui/src/components/bulk-action-bar.tsx:60 — current (BulkActionButton)
"rounded-none border border-primary-foreground/20 px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10 disabled:pointer-events-none disabled:opacity-50",
```

The house `Button` primitive gives every pressable element a 1px press dip
(`packages/ui/src/components/button.tsx:7`:
`active:not-aria-[haspopup]:translate-y-px` with `transform` in the
transition list). These bar buttons are the only pressables in `packages/ui`
without it.

Neither `transition-colors` declares a duration/easing token either — they run
at the Tailwind default instead of the house scale (same defect class as
plan 014).

## Target

**Line 32** — entrance at base duration, motion-gated. `animate-slide-up-fade`
cannot be retimed with a `[animation-duration:...]` override (the utility's
`animation` shorthand resets duration — measured and documented in
`animation-plans/README.md`, batch 027-032 note, item 031c). Use the explicit
shorthand that reuses the same keyframe:

```tsx
// packages/ui/src/components/bulk-action-bar.tsx:32 — target
<div className="pointer-events-auto flex items-center gap-2 rounded-none bg-primary py-2 pr-2 pl-4 text-primary-foreground shadow-lg motion-safe:[animation:slide-up-fade_var(--duration-base)_var(--ease-out-quart)]">
```

(`--duration-base` = 200ms. Under reduced motion the bar simply appears —
allowed; position changes are dropped, and the bar itself is the feedback.)

**Line 41 (Deselect)** — tokenized transition + press dip:

```tsx
className="rounded-none px-2.5 py-1.5 text-sm font-medium text-primary-foreground/70 transition-[color,transform] duration-[var(--duration-fast)] ease-out-quad hover:text-primary-foreground active:translate-y-px"
```

**Line 60 (BulkActionButton)** — same treatment, with background/border in the
transition list since it hovers those:

```tsx
"rounded-none border border-primary-foreground/20 px-3 py-1.5 text-sm font-medium text-primary-foreground transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] ease-out-quad hover:bg-primary-foreground/10 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
```

Deliberate non-goals, per house posture:

- **No exit animation.** Instant-out is the house default (Design.md: "fast
  in, instant out"). Deselecting unmounts the bar in one frame — leave it.
- **No conversion to a retargeting transition.** Mount keyframes are the house
  entrance idiom; a remount restart at 200ms on rapid deselect/reselect is
  acceptable and matches every other entrance in the repo.

## Repo conventions to follow

- Duration/easing tokens live in `packages/ui/src/styles/globals.css` (`@theme`
  blocks, `--duration-*` at :195-203, `--ease-*` at :71-82). Never hand-type a
  cubic-bezier or raw ms.
- Press-feedback exemplar: `packages/ui/src/components/button.tsx:7`
  (`active:...translate-y-px`, `transform` included in `transition-[...]`,
  `duration-[var(--duration-fast)] ease-out-quad`).
- Explicit-animation-shorthand exemplar (when a named `animate-*` token has the
  wrong duration): the advisor crossfade noted in `animation-plans/README.md`
  batch 027-032, item 031c —
  `motion-safe:[animation:fade-in_var(--duration-fast)_var(--ease-out-quart)]`.
- Motion gating exemplar: `apps/web/components/dashboard/runs/run-inspector.tsx:103`
  (`motion-safe:animate-fade-in`).

## Steps

1. In `packages/ui/src/components/bulk-action-bar.tsx:32`, replace
   `animate-slide-up-fade` with
   `motion-safe:[animation:slide-up-fade_var(--duration-base)_var(--ease-out-quart)]`
   (keep every other class on the line; Tailwind class order is enforced by
   prettier — run it rather than hand-sorting).
2. In the same file, line 41 (Deselect button), replace `transition-colors`
   with `transition-[color,transform] duration-[var(--duration-fast)]
   ease-out-quad` and append `active:translate-y-px`.
3. Line 60 (`BulkActionButton`), replace `transition-colors` with
   `transition-[color,background-color,border-color,transform]
   duration-[var(--duration-fast)] ease-out-quad` and append
   `active:translate-y-px`.
4. Run `pnpm prettier --write packages/ui/src/components/bulk-action-bar.tsx`.

## Boundaries

- Do NOT touch any file other than `packages/ui/src/components/bulk-action-bar.tsx`.
- Do NOT add an exit animation, a portal transition wrapper, or new state.
- Do NOT change markup, props, or the `count <= 0` render guard.
- Do NOT add dependencies.
- If line contents differ from the excerpts above (drift since commit
  `91466cd`), STOP and report instead of improvising.

## Verification

- **Mechanical**: `pnpm turbo typecheck lint --filter=web` passes (web
  transitively checks `@workspace/ui`).
- **Feel check**: `pnpm --filter web dev`, open
  `localhost:3000/playbook`, scroll to the data-table demo, select rows:
  - The bar slides up noticeably quicker than before (200ms, not 400ms) and
    settles before your cursor reaches it.
  - Hold a click on "Deselect" and on an action button — each dips 1px while
    pressed and returns on release.
  - In DevTools → Animations panel at 10% speed, confirm the entrance is the
    `slide-up-fade` keyframe at 200ms with ease-out-quart (fast start, gentle
    settle), and that deselecting removes the bar with no exit animation.
  - Rendering panel → emulate `prefers-reduced-motion: reduce`: reselect rows —
    the bar appears in place with no slide; button color feedback still works.
- **Done when**: all three class strings match the targets, prettier is clean,
  and the feel checks above hold.
