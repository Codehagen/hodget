# 028 — Fund-overview micro-affordances (dead transitions, focus-visible, chevron curve)

- **Status**: DONE
- **Commit**: 1752933
- **Severity**: LOW (batch of three)
- **Category**: Affordance / accessibility / cohesion
- **Estimated scope**: 4 files, 1 class-string edit each

## Problem

Three small affordance gaps on the Fund-overview surface:

**(a) Dead color transitions on two "Explore" links.** In
`fund-monitor/risk-card.tsx` (the "Explore risk" link) and
`fund-monitor/engine-ops-card.tsx` (the "Open Decisions" link), the class was
`text-primary transition-colors duration-[var(--duration-instant)]
hover:underline`. The only hover change is `underline` — a
`text-decoration-line` toggle, which is **not** animatable — so the
`transition-colors` was inert (nothing colored changed on hover). The transition
declared intent it never delivered.

**(b) Range-toggle buttons had no focus-visible state.** The 1D/1M/3M/YTD/1Y
buttons in `equity-chart.tsx` styled only hover (`hover:text-foreground`),
leaving keyboard focus invisible — off the house pattern used by
`attention-panel.tsx:31` (`focus-visible:bg-muted/60`).

**(c) Chevron rotation used the wrong duration/curve.** The expand chevron in
`fund-monitor/recent-decisions-card.tsx` rotated with
`transition-transform duration-[var(--duration-instant)]` and no explicit easing.
A 90° on-screen rotation is a morph, which Design.md §3 (easing flowchart) and
§5 ("rotation looks best with ease-in-out") say should run on
`ease-in-out` at a hair more than instant.

## Target

**(a)** Add a real color shift so the transition has something to animate; keep
the underline:
`… hover:text-primary/80 hover:underline` (transition-colors retained).

**(b)** Add the house focus-visible treatment (and `outline-none` so the ring
doesn't double up) to the range buttons:
`… outline-none transition-colors duration-[var(--duration-instant)]
focus-visible:bg-muted/60`.

**(c)** Move the chevron to the on-screen-morph curve:
`transition-transform duration-[var(--duration-fast)] ease-in-out-cubic`.

## Repo conventions to follow

- Token form only (`duration-[var(--duration-fast)]`), explicit property lists
  (`transition-transform`, `transition-colors`), never `transition-all`
  (Design.md §2).
- `pointer-fine:` is not needed here — `focus-visible` is keyboard-only by
  definition, and the color hovers are already opacity/color changes the global
  reduced-motion allowlist keeps running (Design.md §11).
- The chevron's `transition-transform` is transform-only, so under reduced motion
  the global allowlist strips it and the rotation snaps — correct (§11).

## Steps

1. risk-card.tsx: add `hover:text-primary/80` to the "Explore risk" link class.
2. engine-ops-card.tsx: same for the "Open Decisions" link.
3. equity-chart.tsx: add `outline-none … focus-visible:bg-muted/60` to the range
   button class.
4. recent-decisions-card.tsx: `duration-[var(--duration-instant)]` →
   `duration-[var(--duration-fast)] ease-in-out-cubic` on the chevron.

## Boundaries

- Do NOT drop `hover:underline` (a) — the underline stays, the color deepen is
  additive.
- Do NOT restyle the buttons/links beyond the single affordance each.
- (b) shares the range-button class string with fix 027's `onClick` change — both
  edits touch the same `<button>`; land together or reconcile.

## Verification

- **Mechanical**: `pnpm turbo typecheck` + `pnpm turbo test --filter=web` — green.
- **Feel check** (headless Chromium, `/demo`):
  - (a) both links carry `hover:text-primary/80` (computed transition-property
    includes `color`).
  - (b) all 5 range buttons carry `focus-visible:bg-muted/60` + `transition-colors`.
  - (c) chevron computed `transition-property: transform`, `duration 0.15s`,
    `timing cubic-bezier(0.645, 0.045, 0.355, 1)` (= ease-in-out-cubic).
  - Both themes; zero app console errors.
- **Done when**: links deepen on hover, range buttons show a keyboard focus fill,
  the chevron rotates on the ease-in-out curve. All met.
