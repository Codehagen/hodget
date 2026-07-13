# 011 — Draw the checkbox checkmark with the existing draw-stroke keyframe (opportunity)

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: LOW (missed opportunity — additive)
- **Category**: Missed opportunities
- **Estimated scope**: 2 files (checkbox.tsx, globals.css), ~15 lines

## Problem

Checking a checkbox snaps: the fill/border appear instantly
(`data-[checked]:bg-primary data-[checked]:border-primary`) and the SVG check
pops in whole (`data-[unchecked]:hidden` on the Indicator). Meanwhile
`globals.css:132-135` defines a `draw-stroke` keyframe (`stroke-dashoffset:
1 → 0`) clearly built for a check-draw — and nothing references it (verified by
grep). Checkbox toggles are deliberate, occasional interactions where a brief
confirming animation reads as quality; the asset already exists.

```tsx
// packages/ui/src/components/checkbox.tsx:21-29 — current (Indicator)
<CheckboxPrimitive.Indicator className="flex items-center justify-center text-current data-[unchecked]:hidden">
  <svg viewBox="0 0 14 14" fill="none" className="size-3" aria-hidden>
    <path
      d="M11.5 4L5.75 10L2.5 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
```

```css
/* packages/ui/src/styles/globals.css:132-135 — current, unused */
@keyframes draw-stroke {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
```

## Target

1. **Fill/border ease in**: extend the Root's transition (checkbox.tsx:16) to
   include colors so the primary fill fades in over `--duration-fast`:
   `transition-shadow` → `transition-[box-shadow,background-color,border-color]`
   (plan 005 adds `duration-[var(--duration-fast)] ease-out-quart` to this same
   element — if 005 has run, just extend its property list; if not, add
   duration+easing here too).
2. **Check draws itself**: the path animates `stroke-dashoffset` from its full
   length to 0 when checked, using pathLength normalization so the keyframe's
   `1 → 0` values work directly:

```tsx
// target — Indicator subtree
<svg viewBox="0 0 14 14" fill="none" className="size-3" aria-hidden>
  <path
    d="M11.5 4L5.75 10L2.5 7"
    pathLength="1"
    strokeDasharray="1"
    className="motion-safe:animate-[draw-stroke_150ms_var(--ease-out-quart)]"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
</svg>
```

Because the Indicator unmounts/hides when unchecked (`data-[unchecked]:hidden`),
the keyframe replays on each check — correct here (each check is a fresh
confirmation; interruptibility is not a concern for a 150ms one-shot on a
deliberate action). Unchecking stays instant (removal feedback shouldn't
linger).

Reduced motion: `motion-safe:` gates the draw; the global layer also flattens
keyframes — under reduce, the check appears instantly (fine: the fill fade is
also stripped to instant by the transition-property allowlist? No — background-color
IS in the allowed list, so the fill still fades under reduce. Good: gentle,
non-positional feedback survives).

## Repo conventions to follow

- Keyframe reference form: `animate-[draw-stroke_150ms_var(--ease-out-quart)]`
  (arbitrary animation utility; the named `--animate-*` theme entries in
  globals.css:85-91 are the alternative — you may instead add
  `--animate-draw-stroke: draw-stroke 150ms var(--ease-out-quart);` to the
  `@theme` block and use `animate-draw-stroke`, which matches how the other
  house animations are exposed. Prefer this second form.)
- Duration: 150ms (`--duration-fast` scale point; keyframe shorthand takes the
  literal).

## Steps

1. Add `--animate-draw-stroke: draw-stroke 150ms var(--ease-out-quart);` to the
   `@theme` block in globals.css (next to the other `--animate-*` entries at
   :85-91).
2. Update the checkbox Indicator SVG path per Target (pathLength, dasharray,
   `motion-safe:animate-draw-stroke`).
3. Extend the Root transition per Target 1.
4. Check the indeterminate state (`data-[indeterminate]`) — if it renders a
   different glyph (minus bar), leave it unanimated.

## Boundaries

- Do NOT change the checkmark geometry, size, or colors.
- Do NOT animate unchecking.
- Do NOT touch switch/radio (checkbox only).

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui lint && pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` → form controls: click a checkbox —
  the box fills with a quick fade while the check **draws** from tail to tip in
  ~150ms; at 10% speed the stroke visibly draws left-to-right along the path.
  Uncheck: instant. Reduced-motion emulation: check appears instantly, fill
  still fades gently.
- **Done when**: the draw plays on check, nothing on uncheck, and the
  previously dead `draw-stroke` keyframe has a consumer.
