# 016 — Stage stepper transitions its state flips

- **Status**: DONE
- **Commit**: 2526020
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 1 file (packages/ui/src/components/stage-stepper.tsx), 3 class-string edits

## Problem

The StageStepper (the Data → Analysts → Committee → Risk → Fills pipeline
stepper shown in the dashboard "Active run" header, the run-detail header
rail, and the runs inspector) has no transitions at all. On a live run, a
stage flipping pending → active → complete snaps instantly: the node's border
and background jump from muted to blue ring to solid green, and the connector
line jumps from dashed grey to solid green. This is exactly the state change
worth a beat of motion — it's rare, meaningful, and currently invisible if
you blink.

```tsx
// packages/ui/src/components/stage-stepper.tsx:65-77 — current (StageNode span)
<span
  data-slot="stage-node"
  data-state={step.state}
  className={cn(
    "flex shrink-0 items-center justify-center rounded-full border font-mono font-medium tabular-nums",
    NODE_SIZE[size],
    step.state === "complete" &&
      "border-success bg-success text-success-foreground",
    step.state === "active" &&
      "border-2 border-info bg-background text-info",
    step.state === "pending" &&
      "border-border bg-background text-muted-foreground"
  )}
>
```

```tsx
// packages/ui/src/components/stage-stepper.tsx:84-89 — current (connector class)
/** Connector line whose style is decided by the node it leaves. */
function connectorClass(leftState: StageState | undefined) {
  return leftState === "complete"
    ? "border-success"
    : "border-dashed border-border"
}
```

The caption under/next to a label also swaps color when a stage becomes
active, equally without transition:

```tsx
// packages/ui/src/components/stage-stepper.tsx:104-109 — current (StageLabel caption)
<span
  className={cn(
    "text-[11px]",
    active ? "text-info" : "text-muted-foreground"
  )}
>
```

## Target

Add `transition-colors duration-[var(--duration-base)] ease-out-quad` to all
three class strings. Color-only transitions, 200ms, gentle deceleration —
state changes are infrequent (once per pipeline stage per run), so they get
the base tier, not the instant hover tier.

1. StageNode span — first string in the `cn(...)` becomes:

```tsx
"flex shrink-0 items-center justify-center rounded-full border font-mono font-medium tabular-nums transition-colors duration-[var(--duration-base)] ease-out-quad",
```

2. `connectorClass` — prepend the transition to both branches by adding it
   once in the callers? No — keep it in the returned string so every
   connector gets it regardless of call site:

```tsx
function connectorClass(leftState: StageState | undefined) {
  return leftState === "complete"
    ? "border-success transition-colors duration-[var(--duration-base)] ease-out-quad"
    : "border-dashed border-border transition-colors duration-[var(--duration-base)] ease-out-quad"
}
```

   (Alternatively factor the shared classes:
   `const CONNECTOR_TRANSITION = "transition-colors duration-[var(--duration-base)] ease-out-quad"`
   and template both branches — either shape is fine; the class output must be
   as above.)

3. StageLabel caption span:

```tsx
"text-[11px] transition-colors duration-[var(--duration-base)] ease-out-quad",
```

Known limitation, accepted: the connector's dashed → solid change is a
`border-style` flip, which CSS cannot transition — the dash pattern will
still snap while the color eases. That is fine: the grey → green **color**
carries the state change; do not attempt to fake dash interpolation.

The label title (`text-xs font-medium text-foreground`, line 102) never
changes color — leave it untouched.

## Repo conventions to follow

- Tokens from `packages/ui/src/styles/globals.css` (easings lines 75-77,
  durations lines 191-195); durations written as
  `duration-[var(--duration-*)]`, never numeric Tailwind durations; explicit
  property lists (`transition-colors`, not `transition-all`).
- These are color-only transitions, so NO `motion-reduce:transition-none` —
  the global reduced-motion layer (`globals.css:273-282`) deliberately keeps
  color transitions running (Design.md §11).
- Exemplar of a correctly tokenized color transition:
  `apps/web/components/dashboard/fund-monitor/attention-panel.tsx:38` —
  `transition-colors duration-[var(--duration-instant)] hover:bg-muted/50`.
  (It uses the instant tier because hover is high-frequency; the stepper uses
  base because state flips are rare — Design.md's frequency rule.)

## Steps

1. Edit the StageNode span class at
   `packages/ui/src/components/stage-stepper.tsx:69` per Target item 1.
2. Edit `connectorClass` at lines 85-89 per Target item 2.
3. Edit the StageLabel caption span at lines 104-109 per Target item 3.

## Boundaries

- Do NOT change the state semantics, the CheckIcon, the layout variants
  (vertical / inline / below), or any markup.
- Do NOT animate the check icon appearing (a `draw-stroke` entrance is a
  separate, deliberate non-goal here — the fixtures are static and plan scope
  is the color flip only).
- Do NOT add `motion-reduce:` variants (see conventions).
- If the class strings differ from the excerpts (drift since 2526020), STOP
  and report.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`:
  - The dashboard "Active run" header and the runs inspector ("Current
    stage") render the stepper identically to before at rest.
  - In DevTools, select a pending node's span and flip its `data-state` /
    swap the pending classes for the complete ones
    (`border-success bg-success text-success-foreground`): border and fill
    ease over ~200ms instead of snapping. Do the same on a connector
    (`border-dashed border-border` → `border-success`): the color eases; the
    dash pattern snaps (expected).
  - Scrub in the Animations panel at 10%: the color ramp decelerates (quad).
  - Toggle `prefers-reduced-motion: reduce`: color transitions still run
    (allowlist keeps them) — this is the intended posture.
- **Done when**: all three class strings carry the transition, rest-state
  rendering is pixel-identical, and typecheck is green.
