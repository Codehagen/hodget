# 030 — Decision-map node hover preserves semantic accent rings

- **Status**: DONE
- **Commit**: 1752933
- **Severity**: MEDIUM
- **Category**: Affordance / semantics
- **Estimated scope**: 1 file (apps/web/components/dashboard/decision-map/nodes.tsx), NodeShell rewrite + RiskGateNode accent wiring

## Problem

`NodeShell` (plan 022) gives unselected nodes a hover ring that eases its
box-shadow. But the hover class was a single neutral grey
(`pointer-fine:hover:ring-foreground/25`) applied to **every** unselected node —
so hovering an accent node **erased its semantic color**: the amber safety-gate
ring (`ring-warning/50`), the green fill ring (`ring-success/45`), and the red
veto ring (`ring-destructive/50`, then applied via a `className` override on
`RiskGateNode`) all flattened to grey while hovered. Hover destroyed the exact
signal the accent exists to carry.

```tsx
// nodes.tsx — before (unselected branch)
cn(accentRing, "transition-[box-shadow] … pointer-fine:hover:ring-foreground/25")
// …and RiskGateNode passed the veto ring as a className, invisible to the accent system:
<NodeShell … accent={accent} className={cn(vetoed && !selected && "ring-destructive/50")}>
```

## Target

Give each accent a hover that deepens **within its own hue**, and route the veto
through the accent system so it participates in the hover logic instead of a
side-channel `className`. A lookup table maps each accent (plus a `none` default)
to its rest ring and its deeper hover ring:

```tsx
type Accent = "amber" | "green" | "red"

const ACCENT_RING: Record<Accent | "none", { rest: string; hover: string }> = {
  amber: { rest: "ring-warning/50",     hover: "pointer-fine:hover:ring-warning/70" },
  green: { rest: "ring-success/45",     hover: "pointer-fine:hover:ring-success/65" },
  red:   { rest: "ring-destructive/50", hover: "pointer-fine:hover:ring-destructive/70" },
  none:  { rest: "ring-foreground/10",  hover: "pointer-fine:hover:ring-foreground/20" },
}
// unselected branch:
cn(ring.rest, "transition-[box-shadow] duration-[var(--duration-instant)] ease-out-quad", ring.hover)
```

`RiskGateNode` now passes `accent={vetoed ? "red" : clipped ? "amber" : undefined}`
and drops the `className` ring override entirely. Selection still wins: the
`selected` branch renders `ring-2 ring-info` with no transition and no accent ring
(instant, Design.md §1).

## Plan-022 value reconciliation

Plan 022 specified the neutral hover ring at `ring-foreground/20`; the shipped
code had drifted to `ring-foreground/25`. This plan reconciles to **`/20`** (the
022 value) for the `none` accent and updates the `NodeShell` doc comment
accordingly (it now documents the accent-preserving hover and names the red
veto accent). The `/25` value no longer appears anywhere in `nodes.tsx`.

## Repo conventions to follow

- Hover ring is a `box-shadow`/color change at ring width 1 → color-only, kept
  running under reduced motion by the global allowlist (Design.md §11); no
  `motion-reduce:` needed.
- Transition lives on the **unselected branch only** so selection stays instant
  (Design.md §1, plan 022's rationale carries over unchanged).
- `pointer-fine:` gates every hover (touch-first, Design.md §12).

## Steps

1. Extend `Accent` to include `"red"`; add the `ACCENT_RING` lookup.
2. Rewrite `NodeShell` to read `ACCENT_RING[accent ?? "none"]` for `ring.rest`
   and `ring.hover`; update the doc comment.
3. `RiskGateNode`: `accent = vetoed ? "red" : clipped ? "amber" : undefined`;
   remove the `className={cn(vetoed && !selected && "ring-destructive/50")}`.

## Boundaries

- Do NOT add a transition to the always-on base string (selection must snap).
- Do NOT change ring **width** on hover (stays `ring-1`); only the color deepens.
- Do NOT touch the green `ExecutionNode` accent value or the Handle ports.

## Verification

- **Mechanical**: `pnpm turbo typecheck` + `pnpm turbo test --filter=web` — green.
- **Feel check** (headless Chromium, node class + computed-ring inspection):
  - Reduced (trade) decision `dec_…c12f8b7a`: the amber gate carries
    `hover:ring-warning/70` (rest ring = warning@50%), the green execution carries
    `hover:ring-success/65` (rest = success@45%), the 5 neutral nodes carry
    `hover:ring-foreground/20`; `ring-foreground/25` count = 0.
  - Vetoed (no-trade) decision `run_5d2b9f1` (MSFT): the "Safety blocked it" gate
    carries `hover:ring-destructive/70`, rest ring = destructive@50%.
  - Selected node rest ring = info blue (selection ring intact, instant).
  - Both themes; zero app console errors.
- **Done when**: accent nodes keep their hue on hover (deeper), neutral nodes
  deepen grey to `/20`, veto flows through the accent system, selection stays
  instant. All met.
