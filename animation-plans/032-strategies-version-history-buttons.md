# 032 — Strategies version-history inline buttons get the sibling hover affordance

- **Status**: DONE
- **Commit**: 1752933
- **Severity**: LOW
- **Category**: Cohesion / affordance
- **Estimated scope**: 1 file (apps/web/components/dashboard/strategies-view.tsx), 1 class-string edit

## Problem

The strategy-detail "Version history" row renders each version as an inline
`<button>` (v3.2.1, v3.2.0, …). They styled only `underline-offset-4
hover:underline` — an underline toggle with no color transition, out of step with
every other inline text affordance on the surface (the card "Explore" links, the
version links' own siblings), which deepen their color on hover over the instant
token.

```tsx
// strategies-view.tsx — before
className="font-mono text-[11px] text-primary tabular-nums underline-offset-4 hover:underline"
```

## Target

Match the sibling idiom: add `transition-colors
duration-[var(--duration-instant)] hover:text-primary/80`, keeping the underline
and the inline-button structure.

```tsx
// strategies-view.tsx — after
className="font-mono text-[11px] text-primary tabular-nums underline-offset-4 transition-colors duration-[var(--duration-instant)] hover:text-primary/80 hover:underline"
```

## Repo conventions to follow

- Token duration (`--duration-instant`, 100ms hover) + explicit `transition-colors`
  (Design.md §2, §4).
- Color-only change → kept running under reduced motion by the global allowlist
  (Design.md §11); no `motion-reduce:` needed.
- No explicit `ease` on the `transition-colors` idiom — this matches the
  established repo-wide hover idiom (see the REJECTED note in the README: adding
  `ease` here would drift the idiom everywhere).

## Steps

1. Add `transition-colors duration-[var(--duration-instant)]
   hover:text-primary/80` to the version button class (before `hover:underline`).

## Boundaries

- Do NOT restructure the version buttons or the "More version history" overflow
  button.
- Do NOT change the surrounding "Version history" row layout.

## Verification

- **Mechanical**: `pnpm turbo typecheck` + `pnpm turbo test --filter=web` — green.
- **Feel check** (headless Chromium, `/demo/strategies`, first strategy detail):
  - 4 version buttons render (v3.2.1, …); each carries `hover:text-primary/80`;
    computed `transition-property` includes `color`, `duration 0.1s`.
  - Both themes; zero app console errors.
- **Done when**: version links deepen their color on hover over 100ms, underline
  preserved. All met.
