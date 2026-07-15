# 019 — Attention panel rows get house focus-visible treatment

- **Status**: DONE
- **Commit**: 2526020
- **Severity**: LOW
- **Category**: Accessibility
- **Estimated scope**: 1 file (apps/web/components/dashboard/fund-monitor/attention-panel.tsx), 2 class-string edits

## Problem

The Attention panel's interactive rows are the only interactive rows in the
dashboard without the house focus treatment — they rely on the browser's
default focus outline, which clashes with the square, outline-free look every
other row uses (background tint on `:focus-visible`). Keyboard-tabbing
through the fund monitor, these two controls visibly break style.

```tsx
// apps/web/components/dashboard/fund-monitor/attention-panel.tsx:36-39 — current (AttentionRow)
<button
  type="button"
  className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 motion-reduce:transition-none"
>
```

```tsx
// apps/web/components/dashboard/fund-monitor/attention-panel.tsx:115-118 — current (Healthy toggle)
<button
  type="button"
  className="flex min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 motion-reduce:transition-none"
>
```

## Target

Add `outline-none focus-visible:bg-muted/60` to both buttons, matching the
decision-log row treatment (the house exemplar for keyboard-focusable rows):

```tsx
// apps/web/components/dashboard/run-detail/decision-log.tsx:119 — exemplar
className="cursor-pointer outline-none focus-visible:bg-muted/60 data-[state=selected]:bg-primary/5"
```

Resulting class strings (assuming plan 020 has not yet removed
`motion-reduce:transition-none` — see Boundaries):

```tsx
// AttentionRow — target
className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 focus-visible:bg-muted/60 motion-reduce:transition-none"
```

```tsx
// Healthy toggle — target
className="flex min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-left outline-none transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 focus-visible:bg-muted/60 motion-reduce:transition-none"
```

The focus tint (`bg-muted/60`, slightly stronger than the `bg-muted/50`
hover) rides the existing `transition-colors
duration-[var(--duration-instant)]` — no new motion classes needed.

## Repo conventions to follow

- Focusable rows: `outline-none focus-visible:bg-muted/60` — exemplars at
  `apps/web/components/dashboard/run-detail/decision-log.tsx:119` and
  `apps/web/components/dashboard/runs/run-history-table.tsx:96`
  (`"h-11 cursor-pointer outline-none focus-visible:bg-muted/60"`).
- Icon-button-shaped controls elsewhere use ring-based focus
  (`focus-visible:ring-1 focus-visible:ring-ring/50`) — these are full-width
  rows, so they take the row treatment, not the ring.
- Color-only transition already tokenized on these buttons — leave the
  duration/easing as-is.

## Steps

1. In `apps/web/components/dashboard/fund-monitor/attention-panel.tsx:38`
   (AttentionRow button), add `outline-none` and `focus-visible:bg-muted/60`
   to the className per the Target.
2. Same edit on the Healthy toggle button className at line 117.

## Boundaries

- Do NOT remove or alter `motion-reduce:transition-none` here — that class is
  owned by plan 020 (which deletes it across the dashboard). If plan 020 has
  already landed and the class is gone, that's expected: apply this plan's
  additions to the string as you find it.
- Do NOT change hover classes, layout, markup, or the row content.
- Do NOT touch other files.
- If the class strings differ beyond the plan-020 interaction just described,
  STOP and report.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`
  (fund monitor), find the Attention card:
  - Tab through the page with the keyboard: each attention row and the
    "Healthy (n)" toggle show a muted background tint when focused — no
    default blue/white outline ring anywhere on the card.
  - The focused tint appears via the instant (100ms) color transition, same
    as hover.
  - Mouse clicks do NOT show the tint after release (`focus-visible`, not
    `focus`).
  - Compare against a run-detail decision-log row: identical focus look.
- **Done when**: both buttons carry `outline-none focus-visible:bg-muted/60`,
  keyboard focus looks like the decision-log exemplar, and typecheck is
  green.
