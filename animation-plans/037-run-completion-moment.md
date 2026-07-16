# 037 — Give the run-completion moment a deliberate arrival

- **Status**: DONE
- **Commit**: b1de3cb
- **Severity**: MEDIUM
- **Category**: Missed opportunity (delight budget — rare, high-emotion moment)
- **Estimated scope**: 1 file (`apps/web/components/dashboard/live-run/live-run-dialog.tsx`), ~40 lines changed

## Problem

The "New run" dialog streams a live engine run (or the scripted demo replay) and
ends on the product's single highest-emotion moment: the run completing with its
metrics. Today that payoff arrives with generic motion:

- The status badge hard-flips from "Running" (blue) to "Completed" (green) with
  no transition at all — `apps/web/components/dashboard/live-run/live-run-dialog.tsx:266`:

```tsx
{/* live-run-dialog.tsx:265-266 — current */}
<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
  <Badge variant={badge.variant}>{badge.label}</Badge>
```

- The result block (Sharpe / CAGR / Max drawdown / Hit rate + action buttons)
  animates as one undifferentiated slab using the same `slide-up-fade` every
  other entrance in the app uses — `live-run-dialog.tsx:302-352`:

```tsx
{/* live-run-dialog.tsx:300-305 — current */}
{/* Result — the payoff, so it earns the page-length entrance; opacity+
    transform only, and motion-safe gates it. */}
{terminal ? (
  <div className="flex flex-col gap-3 motion-safe:animate-slide-up-fade">
    {state.metrics ? (
      <StatBar>
```

A user waits through the whole streamed run for this beat. It happens at most a
few times per session (rare tier — this is exactly where the delight budget
lives), and it currently spends none of it. Note the wrapper is shared with the
**failed** and **disconnected** terminal states — those must NOT get a
celebratory sequence.

## Target

On `status === "completed"`, a short sequenced arrival (~640ms total, every
piece opacity/transform/stroke only, all `motion-safe:`-gated):

1. **Progress bar fills to 100** — already animated
   (`packages/ui/src/components/progress.tsx:48`, `transition-[width]
   duration-[var(--duration-slow)]`). No change.
2. **Status badge pops on every status flip**: key the badge by status so it
   remounts, with `motion-safe:animate-scale-in` (existing token: scale 0.95→1
   + fade, 200ms `var(--ease-out-quart)`). Status flips are rare
   (queued→running→terminal, once per run), so this stays inside the frequency
   budget.
3. **The Completed badge draws a check**: a small inline SVG check inside the
   badge, drawn with the existing `draw-stroke` keyframe (150ms
   `var(--ease-out-quart)`), delayed 100ms behind the badge pop
   (`animation-fill-mode: backwards` so the stroke is hidden during the delay).
4. **Result stats stagger in**: each of the four `StatItem`s runs its own
   `motion-safe:animate-slide-up-fade` (400ms `var(--ease-out-quart)`,
   translateY 10px→0 + fade) with inline `animationDelay` of 0 / 60 / 120 /
   180ms and `animationFillMode: "backwards"`. The wrapper drops to a plain
   `motion-safe:animate-fade-in` so children don't double-translate.
5. **Action row arrives last**: "Run again" / "View full run →" row gets
   `motion-safe:animate-slide-up-fade` with `animationDelay: "240ms"`,
   `animationFillMode: "backwards"`.
6. **Failed / disconnected keep today's behavior**: single
   `motion-safe:animate-slide-up-fade` on the wrapper, no stagger, no check.

Reduced motion: everything above is `motion-safe:`-gated (repo convention), so
under `prefers-reduced-motion` the result simply appears — same as today.

## Repo conventions to follow

- Animation utilities come from `packages/ui/src/styles/globals.css` `@theme`
  (lines 92-100): `--animate-scale-in: scale-in var(--duration-base)
  var(--ease-out-quart)`, `--animate-slide-up-fade: slide-up-fade
  var(--duration-page) var(--ease-out-quart)`, `--animate-fade-in: fade-in
  var(--duration-base) var(--ease-out-quart)`, `--animate-draw-stroke:
  draw-stroke 150ms var(--ease-out-quart)`. **Do not add new keyframes or
  tokens — everything needed exists.**
- Check-draw exemplar — `packages/ui/src/components/checkbox.tsx:22-32`:

```tsx
<svg viewBox="0 0 14 14" fill="none" className="size-3" aria-hidden>
  <path
    d="M11.5 4L5.75 10L2.5 7"
    pathLength="1"
    strokeDasharray="1"
    className="motion-safe:animate-draw-stroke"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
</svg>
```

- Stagger exemplar — inline `style={{ animationDelay: `${i * 60}ms` }}` per
  item, as in `apps/web/components/dashboard/decision-map/summary-tab.tsx:276`.
- The `Badge` primitive already sizes child SVGs (`[&>svg]:size-3!`,
  `packages/ui/src/components/badge.tsx:8`) and accepts `className`/children.
- `cn` is already imported in `live-run-dialog.tsx` from
  `@workspace/ui/lib/utils`.

## Steps

All edits in `apps/web/components/dashboard/live-run/live-run-dialog.tsx`.

1. **Badge pop.** In `Replay` (line 266), key the badge by status and add the
   scale-in, plus the check when completed:

```tsx
<Badge
  key={state.status}
  variant={badge.variant}
  className="motion-safe:animate-scale-in"
>
  {state.status === "completed" ? <CompletedCheck /> : null}
  {badge.label}
</Badge>
```

2. **Check icon.** Add a private component at the bottom of the file (near
   `FeedRow`), copying the checkbox idiom with a 100ms delayed draw:

```tsx
/** Check drawn inside the Completed badge — the checkbox's draw-stroke idiom,
 * delayed 100ms so it lands just after the badge's scale-in. */
function CompletedCheck() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M11.5 4L5.75 10L2.5 7"
        pathLength="1"
        strokeDasharray="1"
        className="motion-safe:animate-draw-stroke"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
```

3. **Split the terminal wrapper by outcome.** Replace the wrapper class at line
   303 (keep the existing comment, update it to describe the sequence):

```tsx
{terminal ? (
  <div
    className={cn(
      "flex flex-col gap-3",
      state.status === "completed"
        ? "motion-safe:animate-fade-in"
        : "motion-safe:animate-slide-up-fade"
    )}
  >
```

4. **Stagger the four stats.** Add to each of the four `StatItem`s (lines
   308-331) — only when completed; since `state.metrics` is only set on
   completion (`run-source` contract, and both adapters null it otherwise),
   applying it unconditionally inside `state.metrics ? …` is equivalent. Give
   the n-th stat (n = 0..3):

```tsx
<StatItem
  size="sm"
  className="min-w-[6.5rem] motion-safe:animate-slide-up-fade"
  style={{ animationDelay: `${n * 60}ms`, animationFillMode: "backwards" }}
  label="Sharpe"
  value={state.metrics.sharpe.toFixed(2)}
/>
```

   If `StatItem` does not forward a `style` prop (check
   `packages/ui/src/components/stat.tsx`), wrap each in a `<div>` carrying the
   animation class + style instead — do not modify `stat.tsx`.

5. **Action row last.** On the buttons row div (line 335), completed runs only:

```tsx
<div
  className={cn(
    "flex flex-wrap items-center justify-end gap-2",
    state.status === "completed" && "motion-safe:animate-slide-up-fade"
  )}
  style={
    state.status === "completed"
      ? { animationDelay: "240ms", animationFillMode: "backwards" }
      : undefined
  }
>
```

## Boundaries

- Only `apps/web/components/dashboard/live-run/live-run-dialog.tsx` may change.
- Do NOT touch `progress.tsx`, `message-scroller.tsx`, `stat.tsx`, `badge.tsx`,
  `globals.css`, `real-run.ts`, `simulated-run.ts`, or the feed rendering.
- Do NOT add keyframes, tokens, or dependencies.
- Do NOT animate the failed/disconnected path beyond its current single
  slide-up-fade, and do NOT add motion to the error block.
- If line numbers or code excerpts don't match (drift since commit b1de3cb),
  STOP and report instead of improvising.

## Verification

- **Mechanical**: `pnpm --filter web typecheck` and `pnpm --filter web lint`
  both pass with zero warnings (web lints with `--max-warnings 0`).
- **Feel check**: `pnpm dev`, open http://localhost:3000/demo, press "New run"
  → "Start run", and watch the scripted run finish (~seconds):
  - The badge flips to green "Completed" with a small scale-pop, and the check
    draws in just after the pop — not before, not simultaneously.
  - The four stats arrive left-to-right as a cascade, not as one slab; the
    buttons land last. Nothing blocks interaction — clicking "Run again"
    mid-cascade must work immediately.
  - Queued→Running badge flips get the same subtle pop and it does NOT read as
    noisy (it's once per run; if it feels busy at 10% playback that's fine —
    judge at full speed).
  - In DevTools → Animations panel at 10% speed: no element starts visible then
    jumps to hidden (that means a missing `animationFillMode: "backwards"`).
  - Rendering panel → emulate `prefers-reduced-motion: reduce`: the completion
    result appears instantly with no movement and the check is fully drawn.
  - Run a **failed** run if reachable (or temporarily force
    `status: "failed"`): the result block must behave exactly as before —
    single slide-up-fade, no stagger, no check.
- **Done when**: all feel checks pass on `/demo` (simulated) and, if a real
  engine environment is available, on `/dashboard` (real source) — both paths
  share `Replay`, so demo coverage is structurally sufficient.
