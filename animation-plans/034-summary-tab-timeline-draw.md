# 034 — Decisions Summary tab: timeline one-time draw + Open-evidence focus ring

- **Status**: DONE
- **Commit**: 9d9169e (base; working tree — not committed per task)
- **Severity**: LOW (batch of two)
- **Category**: Missed opportunity (B) / Accessibility (A)
- **Estimated scope**: 3 files — summary-tab.tsx, decisions-view.css (additive),
  decisions-view.tsx (tiny gate hookup)

Audit fixes on the Decisions Summary tab
(`apps/web/components/dashboard/decision-map/summary-tab.tsx`). Both motion is
`transform`/`opacity` only; token durations/easings; reduced-motion safe.

## (A) "Open evidence" link-button gains the house focus ring

The link-styled `<button>` in `CtaBand` (summary-tab.tsx) had
`outline-none … focus-visible:underline` only — an underline is easy to miss and
diverges from the sibling `Button`'s focus idiom. Added the house ring alongside
the existing underline, matching `button.tsx`'s
`focus-visible:ring-1 focus-visible:ring-ring/50`:

```tsx
className="text-xs font-medium text-primary underline-offset-4 outline-none
  hover:underline focus-visible:underline
  focus-visible:ring-1 focus-visible:ring-ring/50"
```

Color-only (`ring`), so the reduced-motion allowlist keeps it; the underline is
retained so the affordance survives forced-colors too.

## (B) "What happened next" timeline draws once on first page load

`TimelineCard` rendered its connecting line + nodes with no motion. Now, on the
first page load only, the connecting line **draws left-to-right** (`scaleX`,
`origin-left`, `--duration-slow`, `--ease-out-quart`) while the nodes **fade in
behind it**, staggered 60ms per node (`--duration-base`, `--ease-out-quart`,
`animation-fill-mode: backwards` so a not-yet-reached node starts invisible).
Transform/opacity only — no layout properties.

### The frequency gate (critical)

Summary is the **default** tab and its content re-keys per rail decision, so the
draw must play **once per page load**, never on a swap or a tab return. This
reuses the page's established entrance gate rather than inventing a new one:

- `TimelineCard`'s wrapper carries `data-entrance`, driven by the **same
  `suppressEntrance` flag** the canvas uses (decisions-view.tsx) — `"on"` on
  first load, flipped to `"off"` from the first decision change onward.
- The keyframes are scoped under `.summary-timeline[data-entrance="on"]` in
  `decisions-view.css`, so a later swap simply drops `animation-name` — nothing
  replays. Same idiom as the existing `[data-entrance="off"] … { animation-name:
  none }` rule for the canvas nodes/edges.
- The per-node stagger is an inline `animation-delay` longhand on each `<li>`
  (0/60/120/… ms), harmless when the gate is `"off"` (no `animation-name`, so
  the inline delay is inert). Same inline-longhand technique as plan 025.
- `<TabsContent value="summary">` gained **`keepMounted`** (the "full" tab
  already had it): Summary has no `keepMounted` by default, so returning to it
  would remount and replay the draw on a fresh load *before* any rail click
  (when `suppressEntrance` is still `false`). Keeping it mounted removes that
  remount; the `data-entrance` gate covers every case after the first swap.

### Reduced motion

The whole keyframe block is gated on `@media (prefers-reduced-motion:
no-preference)` (matching decision-flow.css / plan 025). Under `reduce` there is
**no `animation-name` at all**, so `backwards` is inert and the inline delay is
harmless — every node and the line render fully visible immediately, with no
flash from the fill-mode. The keyframes omit their end frame, settling on each
element's natural value (`scaleX(1)` / `opacity: 1`).

```css
/* decisions-view.css (additive) */
@media (prefers-reduced-motion: no-preference) {
  .summary-timeline[data-entrance="on"] .summary-timeline-line {
    transform-origin: left center;
    animation: summary-timeline-draw var(--duration-slow) var(--ease-out-quart);
  }
  .summary-timeline[data-entrance="on"] .summary-timeline-node {
    animation: summary-timeline-node var(--duration-base) var(--ease-out-quart)
      backwards;
  }
}
@keyframes summary-timeline-draw { from { transform: scaleX(0); } }
@keyframes summary-timeline-node { from { opacity: 0; } }
```

## Repo conventions to follow

- Token durations/easings only; explicit keyframes, never `transition-all`.
- `transform`/`opacity` only (Design.md §10); `origin-left` set deliberately.
- Frequency gate: default-tab, re-keying content draws **once** (Design.md §1/§4).
- Reduced motion via `no-preference` gating → static + fully visible (§11).
- `backwards` fill-mode only under `no-preference`, never leaving elements
  invisible under `reduce`.

## Boundaries

- Own only summary-tab.tsx, decisions-view.css (additive), and the minimal
  decisions-view.tsx gate hookup (`suppressEntrance` prop + `keepMounted`).
  Did **not** touch app/page.tsx, decision-canvas.tsx, decision-flow.tsx
  (concurrent edit by another agent).
- Reuse the existing `suppressEntrance`/`data-entrance` machinery — no new
  suppression state.

## Verification

- **Mechanical**: `pnpm turbo typecheck` (4/4) + `pnpm --filter web test`
  (59/59) — green.
- **Feel check** (headless Chromium, `/demo/decisions`, computed styles):
  - **First load**: `data-entrance="on"`; line `animation-name:
    summary-timeline-draw`, `transform-origin: 0px 0.5px` (left-center); nodes
    `animation-name: summary-timeline-node`, delays `0/0.06/0.12/0.18/0.24s`
    (60ms steps), `fill-mode: backwards`. Line settles to `transform: none`
    (scaleX 1) — not stranded.
  - **After rail swap**: `data-entrance="off"`; line + all nodes
    `animation-name: none`, opacity 1 — **no replay**.
  - **After tab away + back**: `data-entrance="off"`; `animation-name: none`,
    opacity 1 — **no replay** (keepMounted + gate).
  - **Reduced motion** (`reducedMotion: reduce`): even with `data-entrance="on"`,
    `animation-name: none` on line + every node, opacity 1 — fully visible
    immediately, no flash.
  - Zero console errors in every scenario.
- **Done when**: (A) link-button shows the house ring on focus-visible while
  keeping the underline; (B) timeline draws once on first load, never replays on
  swap/tab-return, reduced-motion static + visible. All met.
