# 035 — Waitlist page: success-state fade + entrance idiom

- **Status**: DONE
- **Commit**: 622ab98
- **Severity**: LOW
- **Category**: Cohesion & tokens · Missed opportunity
- **Estimated scope**: 2 files, ~6 lines

## Problem

Two findings from the waitlist-page animation audit:

1. `apps/web/app/waitlist/page.tsx:35` — the card entrance used bare
   `animate-fade-in` while every other entrance keyframe in the app
   (plans 017/025, the landing page) writes `motion-safe:animate-fade-in`.
   Functionally covered by the global reduced-motion flattener, but the
   idiom drifted.

```tsx
// apps/web/app/waitlist/page.tsx:35 — before
<Card className="w-full max-w-sm animate-fade-in">
```

2. `apps/web/app/waitlist/waitlist-form.tsx:24-33` — the success moment
   (the one meaningful state change on this page) teleported: the form
   unmounted and the confirmation popped in the same frame, and the card
   abruptly collapsed by roughly the form's height.

```tsx
// apps/web/app/waitlist/waitlist-form.tsx — before
if (state.status === "success") {
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
```

## Target

1. `motion-safe:animate-fade-in` on the card.
2. The confirmation fades in via the same house keyframe
   (`fade-in`, `--duration-base`, `--ease-out-quart` through the
   `animate-fade-in` token), and both branches share `min-h-32` so the
   swap causes no card-height jump. Reduced motion: keyframes are
   flattened globally, so the confirmation appears instantly and fully
   visible.

## Repo conventions to follow

- Entrance keyframes are always `motion-safe:animate-fade-in`
  (exemplar: `run-inspector.tsx` root, plan 017).
- No layout shift on state changes (Design.md §12 rule 1) — reserve
  dimensions rather than letting containers collapse.

## Steps

1. `page.tsx`: `animate-fade-in` → `motion-safe:animate-fade-in`.
2. `waitlist-form.tsx`: success branch root gains
   `min-h-32 motion-safe:animate-fade-in`; form root gains `min-h-32`.

## Boundaries

- Do NOT touch `actions.ts` or the input/error rendering — errors stay
  instant (immediate feedback is correct).
- No new dependencies, no new keyframes.

## Verification

- **Mechanical**: `pnpm turbo typecheck` and `pnpm turbo test --filter=web`
  pass.
- **Feel check**: submit an email on `/waitlist` (envs absent locally →
  use the duplicate/success path on a deployed env, or temporarily mock):
  the confirmation fades in over ~200ms with no card-height jump; under
  reduced-motion emulation it appears instantly.
