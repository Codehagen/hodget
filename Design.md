# Design.md — hodget Design & Animation Engineering

The single source of truth for how we build interfaces and motion at hodget. Read
the relevant section before writing UI or animation code; enforce the checklists in
review.

**Credit & provenance.** This guide is inspiration distilled from **Emil Kowalski's**
design-engineering principles — his skill at <https://emilkowal.ski/skill> and his paid
course [_Animations on the Web_](https://animations.dev/) (all 45 lessons), plus the
`web-animation-design` and `emil-design-engineering` skills installed in this repo. The
ideas, easing values, and component techniques here are his; we've only adapted them to
our stack. **If you build UI at hodget, do the course — it's genuinely worth it:**
<https://animations.dev/>. When something here disagrees with a random blog post, this
doc wins.

**Our stack.** Next.js 16 (App Router, `webpack` build — see `apps/web/package.json`'s
`dev`/`build` scripts) · React 19 · TypeScript · Tailwind CSS v4 · Base UI
(`@base-ui/react`) · `next-themes` (`disableTransitionOnChange` already set on the
`ThemeProvider`, so a theme flip never animates every element) · **CSS-only motion** —
`motion`/`framer-motion` is **not installed** in this repo (verified against every
`package.json`). Every animation here runs on Tailwind-generated CSS transitions and
`@keyframes`, driven by a shared token system. The drawer is a Base UI vaul-style
component whose drag/swipe physics are expressed as CSS custom properties
(`--drawer-swipe-progress`, `--drawer-swipe-movement-*`), not a JS gesture library.
Design tokens live in `packages/ui/src/styles/globals.css` (OKLCH, `.dark` class).

---

## Table of contents

1. [The philosophy (read this first)](#1-the-philosophy-read-this-first)
2. [Motion tokens for this repo](#2-motion-tokens-for-this-repo)
3. [The Easing Blueprint](#3-the-easing-blueprint)
4. [Timing & duration](#4-timing--duration)
5. [CSS animation toolkit](#5-css-animation-toolkit)
6. [Component recipes (current stack)](#6-component-recipes-current-stack)
7. [Charts & data visualization](#7-charts--data-visualization)
8. [When we add a JS motion library (future)](#8-when-we-add-a-js-motion-library-future)
9. [Good → Great: the details](#9-good--great-the-details)
10. [Performance](#10-performance)
11. [Accessibility & reduced motion](#11-accessibility--reduced-motion)
12. [Design engineering beyond motion](#12-design-engineering-beyond-motion)
13. [Design rules — right vs wrong](#13-design-rules--right-vs-wrong)
14. [Review checklists](#14-review-checklists)
15. [Animation vocabulary (glossary)](#15-animation-vocabulary-glossary)
16. [Quick-reference numbers](#16-quick-reference-numbers)

---

## 1. The philosophy (read this first)

An animation feels right when it passes **three tests**:

1. **Natural** — it mirrors real-world physics. Nothing in nature moves at a constant
   speed, so almost nothing in our UI should either.
2. **Purposeful** — you and the user both understand why it exists.
3. **Tasteful** — it follows learnable rules, not gut feeling. Taste is a trainable
   skill, not a personal preference.

> **The point is not to animate — it's to build great interfaces. Sometimes the best
> animation is no animation.** The more you animate, the less each animation is worth.
> Pace them through the experience.

**Valid purposes for an animation:**
- Explain something a static asset can't.
- Give responsiveness feedback (a button press).
- Maintain spatial consistency (a drawer that enters and leaves the same way makes
  swipe-to-dismiss intuitive).
- Occasionally, pure delight — but only on elements seen rarely.

**Speed over delight in product UI.** hodget is a finance dashboard: product surfaces
must feel fast and never annoying. Marketing pages are the product's packaging; they're
seen less often, so they can be slower and more expressive. Even there: if everything
animates, nothing stands out, and intro animations should run **only once** (never
replay on back-nav).

### Decision flowchart: should I animate this?

```
Will users see this 100+ times/day?  (a tab switch, arrow-key list nav, frequent hover)
├── Yes → DON'T animate (or drastically reduce). Friction compounds; delight fades.
└── No
    ├── Keyboard-initiated action? → DON'T animate (feels laggy, disconnected).
    ├── User-initiated (click/tap/hover)? → Animate, ease-out, 150–250ms.
    └── Page transition? → Animate, 300–400ms max.
```

### Decision flowchart: which easing?

```
Is the element ENTERING or EXITING the screen?
├── Yes → ease-out               (dropdowns, dialogs, tooltips, drawers)
└── No
    ├── Already on screen, MOVING/MORPHING? → ease-in-out   (tabs indicator, resizes)
    ├── Hover / color change? → ease
    └── Constant/continuous motion? → linear   (marquee, spinner, progress)
```

Everything below is the detail behind these two flowcharts.

---

## 2. Motion tokens for this repo

These motion tokens are **already applied** in `packages/ui/src/styles/globals.css` so
easings and durations are named and consistent. Easing curves live in a `@theme` block
(which generates Tailwind utilities like `ease-out-quart`); durations live in `:root` as
CSS variables; named keyframe animations live in a second `@theme` block (generating
`animate-*` utilities like `animate-fade-in`). The curves come straight from Emil's
easing blueprint.

```css
/* Easing curves → Tailwind `ease-*` utilities (ease-out-quart, ease-ios-sheet, …) */
@theme {
  --ease-out-quad:  cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
  --ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ease-out-quint: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-out-expo:  cubic-bezier(0.19, 1, 0.22, 1);
  --ease-in-out-cubic: cubic-bezier(0.645, 0.045, 0.355, 1);
  --ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-ios-sheet: cubic-bezier(0.32, 0.72, 0, 1);   /* drawer sheet feel */
}

/* Durations → var(--duration-base), or Tailwind's duration-[var(--duration-base)] */
:root {
  --duration-instant: 100ms;   /* micro-interactions, hover, fast exits */
  --duration-fast: 150ms;      /* button press, tooltips, dialog enter/exit */
  --duration-base: 200ms;      /* standard UI: dropdowns, popovers, tabs indicator */
  --duration-slow: 300ms;      /* modals, score-ring sweeps (ceiling for product UI) */
  --duration-page: 400ms;      /* page transitions (max) */
  --duration-drawer: 450ms;    /* vaul-style sheets; pairs with --ease-ios-sheet */
}

/* Named keyframe animations → `animate-*` utilities */
@theme {
  --animate-fade-in:          fade-in var(--duration-base) var(--ease-out-quart);
  --animate-scale-in:         scale-in var(--duration-base) var(--ease-out-quart);
  --animate-fade-in-blur:     fade-in-blur var(--duration-slow) var(--ease-out-quart);
  --animate-slide-up-fade:    slide-up-fade var(--duration-page) var(--ease-out-quart);
  --animate-slide-right-fade: slide-right-fade var(--duration-page) var(--ease-out-quart);
  --animate-wiggle:           wiggle 0.75s var(--ease-in-out-cubic) infinite;
  --animate-blink:            blink 1.4s var(--ease-out-cubic) infinite;
  --animate-draw-stroke:      draw-stroke 150ms var(--ease-out-quart);
}
```

`fade-in`, `scale-in`, `fade-in-blur`, `slide-up-fade`, and `slide-right-fade` are enter
animations for mount-once surfaces (toasts, empty states, marketing sections). `wiggle`
and `blink` are attention loops — use sparingly, always paired with
`motion-reduce:animate-none` (Tailwind's reduced-motion variant). `draw-stroke` is the
self-drawing-line primitive (see the checkbox recipe in §6).

Three accessibility layers sit at the bottom of the same file — `prefers-reduced-motion`,
`prefers-reduced-transparency`, and `prefers-contrast` — covered in full in §11.

### Conventions this codebase enforces

- **Token form only.** Write `duration-[var(--duration-base)]`, never a numeric
  Tailwind duration like `duration-200`. A raw number can't be swapped by a future
  token change and doesn't communicate *why* that speed was chosen.
- **Scoped transition-property lists, never `transition-all`.** Every component in
  `packages/ui` writes an explicit property list — e.g. checkbox:
  `transition-[box-shadow,background-color,border-color]`, tabs indicator:
  `transition-transform`, drawer popup: `transition-[transform,height,opacity,filter]`.
  `transition-all` silently animates properties added later and can trigger layout.
- **`data-starting-style` / `data-ending-style` is the Base UI transition idiom** for
  floating surfaces (dialog, drawer, tooltip, popover). Base UI adds these data
  attributes around mount/unmount so you write plain CSS transitions keyed off them
  instead of an imperative animate-out step — see `dialog.tsx`'s
  `data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0
  data-ending-style:scale-95`.
- **Exits are faster than entrances (fast in / instant out).** Dialog content enters at
  `--duration-fast` (150ms) and exits at `--duration-instant` (100ms) — see
  `dialog.tsx`'s `data-ending-style:duration-[var(--duration-instant)]`.
- **`origin-(--transform-origin)` on trigger-anchored surfaces.** Popovers/tooltips
  scale from the point on the trigger Base UI computes, not the CSS default center —
  see `tooltip.tsx`'s `origin-(--transform-origin)`.
- **Tooltips are instant within a group.** Once one tooltip in a group has shown, the
  next one skips its enter animation via a `data-instant` attribute Base UI sets:
  `data-instant:transition-none data-instant:data-starting-style:scale-100
  data-instant:data-starting-style:opacity-100` (`tooltip.tsx`). This mirrors OS tooltip
  behavior — you don't wait through a fade for every item as you sweep a menu.
- **The command palette never animates.** `command.tsx` sets `overlayClassName=
  "transition-none"` and `transition-none` on the popup itself. A palette is
  keyboard-driven and opened dozens of times a day — the flowchart in §1 says don't
  animate frequent, keyboard-initiated surfaces, and this component takes that
  literally.

---

## 3. The Easing Blueprint

Easing is the **rate of change over time** and the single most important lever you
have. It can make a bad animation look great and a great one look bad. It also drives
**perceived speed** — the same 300ms feels slower with `ease-in` than with `ease-out`.

| Easing | Use for | Why |
|---|---|---|
| **ease-out** | Default. Anything **entering or exiting** (dialogs, drawers, tooltips, popovers). Marketing intros. | Fast start = instant responsiveness; settles at the end like the real world. |
| **ease-in-out** | Elements **already on screen** that move or morph (the tabs indicator, resizing containers). | Accelerate + brake, like a car. |
| **ease** | Small, gentle hover transitions (`color`, `background-color`, `opacity`). | Asymmetric, elegant for subtle effects. It's the CSS default. |
| **linear** | Constant motion only: marquees, spinners, "hold to delete" progress. | Represents linear time; robotic for anything interactive. |
| **ease-in** | **Avoid.** | Slow start feels sluggish; accelerates at the end, the opposite of how things settle. |

**Rules:**
- Entries **decelerate** (ease-out); they never accelerate (ease-in).
- **Built-in CSS curves are almost never strong enough** — they feel flat. Reach for
  the custom `cubic-bezier()` curves in §2. The only built-in worth using is `ease` on
  hover.
- **Asymmetric curves feel more alive than symmetric ones.** If motion feels flat, the
  curve is too weak.
- **Paired elements share easing + duration.** Dialog + overlay, tooltip + arrow,
  drawer + backdrop: if they move as a unit, they must feel like one. `dialog.tsx`'s
  overlay and popup both use `duration-[var(--duration-fast)] ease-out-quart` on enter.

```css
/* House style */
.button {
  transition: 0.2s ease;
  transition-property: color, background-color, border-color; /* be explicit */
}
```

---

## 4. Timing & duration

| Element | Duration |
|---|---|
| Micro-interactions, hover | 100–150ms |
| Standard UI (tooltips, dropdowns, tabs indicator) | 150–250ms |
| Dialogs | 150ms enter, 100ms exit |
| Drawers (sheet) | 450ms (`--duration-drawer`, paired with `ease-ios-sheet`/`ease-out-quint`) |
| Page transitions | 300–400ms (max) |

**Rules:**
- **Product UI stays under 300ms.** 180ms feels snappy; 400ms feels sluggish.
- **Exits are shorter and simpler than entries** — hodget's dialog literally halves
  its duration on exit (150ms → 100ms).
- **Too fast is as bad as too slow** — there's a *trackability threshold* below which
  the eye can't follow the motion.
- **Duration scales with size and distance.** A full-height drawer is "heavier" than a
  150ms tooltip and gets the slowest token in the scale (`--duration-drawer`).
- **Duration is coupled to easing.** A steep custom curve (like `ease-ios-sheet`) lets
  you run a longer duration while still feeling snappy. **Pick the easing first, then
  tune the duration.**

**Frequency is the deciding factor.** Something used 50–100×/day benefits most from
**no animation at all** — see the command palette in §2. Never animate
keyboard-initiated actions (arrow-key list nav, shortcuts) — motion disconnects them
from the keypress.

---

## 5. CSS animation toolkit

Every animation in this repo today is CSS: a `transition` for interruptible,
user-triggered state changes, or a `@keyframes` animation for enter/exit and loops.
There is no JS animation runtime installed — see §8 for when that changes and why.

### Transitions (interruptible)

`transition` interpolates between the current and target state. It's shorthand for
`property duration timing-function delay`.

```css
.button {
  transition: 0.2s ease;
  transition-property: color, background-color, border-color; /* be explicit */
}
```

- **Always write the easing explicitly.** Many assume the default is `linear` — it
  isn't (it's `ease`), but relying on the implicit default hides intent.
- **Never use `transition: all`** — it silently animates properties you add later and
  can trigger layout. List exact properties (§2's conventions).
- **Keep delay on its own line** (`transition-delay: 1s;`) so intent is obvious.
- **Transitions are interruptible** — hover then un-hover mid-transition and it
  reverses smoothly from the current value. This is why they're right for
  user-triggered changes and for surfaces whose end state can change mid-flight (the
  drawer re-targets its transform every frame while dragging via
  `data-swiping:duration-0`, then re-enables the timed transition on release).

### Transforms (cheap, no layout impact)

`transform` changes appearance without affecting document flow.

- **Translate percentages are relative to the element's own size.**
  `translateY(100%)` offsets an element by exactly its height — the drawer's closed
  state is exactly this: `[--closed-transform:translate3d(0,calc(100%+var(--drawer-
  inset,0px)+2px),0)]`. Works at any content height.
- **Scale multiplies, and scales children too** (font, icons) — desirable for buttons.
  - Button press: `active:scale-[0.97]` (Tailwind). `0.9` is too much.
  - **Never animate from `scale(0)`** — things don't pop out of nothing. Start at
    `0.9`+ (0.85–0.95) with an opacity fade — the dialog's `data-starting-style:
    scale-95` follows this.
- **Rotation looks best with `ease-in-out`.**
- **`transform-origin` defaults to `center`.** Set it deliberately — popovers/tooltips
  scale **from their trigger**, exposed by Base UI as `--transform-origin`
  (`origin-(--transform-origin)` in `tooltip.tsx`).
- **Order matters:** `rotate() translateX()` ≠ `translateX() rotate()`.

### Keyframes (not interruptible)

```css
@keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
.el { animation: fade-in 1s ease; }  /* shorthand: name duration timing only */
```

- Keyframes for: infinite loops (`wiggle`, `blink`); auto-running intros; multi-step;
  simple enter/exit that won't be interrupted (`draw-stroke` on the checkbox).
  Transitions for: user-triggered + interruptible.
- **`animation-fill-mode: forwards`** keeps the end state. **`backwards`** applies the
  first keyframe *before* start — great for delayed enters.
- Omit `0%`/`100%` to fall back to the element's natural values (`blink` is just
  `@keyframes blink { 0% {...} 20% {...} 100% {...} }` around the element's own
  opacity).
- **Replay in React** by bumping a counter used as the element's `key` (forces
  remount) — the same technique the chart chapter (§7) relies on for the opposite
  reason (avoiding an unwanted replay).

### clip-path (hardware-accelerated reveals, no layout shift)

`clip-path: inset(top right bottom left)` hides everything outside the region. Like
`transform`, it doesn't affect layout and is GPU-composited. Not yet used in hodget's
component library, but it's the right primitive the day we need an image reveal,
before/after slider, or scroll-triggered reveal without a JS library.

```css
.image-reveal {
  clip-path: inset(0 0 100% 0);
  animation: reveal 1s forwards cubic-bezier(0.77, 0, 0.175, 1);
}
@keyframes reveal { to { clip-path: inset(0 0 0 0); } }
```

---

## 6. Component recipes (current stack)

Real, currently-shipping hodget components built entirely with CSS transitions/
keyframes + Base UI's transition idiom. Read the cited file before touching the
pattern — the class strings are dense and every token in them is deliberate.

### Tabs — sliding indicator (`packages/ui/src/components/tabs.tsx`)

`TabsIndicator` renders `Base UI`'s `<Tabs.Indicator>`, which exposes the active tab's
geometry as CSS variables (`--active-tab-width`, `--active-tab-left`,
`--active-tab-height`, `--active-tab-top`). The indicator is one `absolute`-positioned
element that transitions its `transform` toward those variables:

```
transition-transform duration-[var(--duration-base)] ease-out-quart
motion-reduce:transition-none
```

No JS measurement, no `layoutId` morph library — Base UI already tells you the target
rect, and a plain `transition-transform` on that target rect *is* the sliding-indicator
effect. This is the reference pattern for "should this need a JS motion library?" —
usually not, if the primitive exposes the geometry.

### Drawer — swipe system (`packages/ui/src/components/drawer.tsx`)

The whole drag/dismiss interaction is CSS custom properties Base UI's `Drawer`
primitive writes during a pointer gesture: `--drawer-swipe-progress`,
`--drawer-swipe-movement-x`/`-y`, `--drawer-swipe-strength`, plus per-direction
`--closed-transform` values. The popup reads them into its `transform`:

- While swiping: `data-swiping:duration-0` — the transition is switched off so the
  transform tracks the pointer 1:1, frame by frame (no lag, no interpolation fighting
  the gesture).
- On release: the timed transition (`duration-[var(--duration-drawer)]
  ease-out-quint`, 450ms) takes back over to animate to the resting position.
- Closing duration scales with how hard you swiped:
  `duration-[calc(var(--drawer-swipe-strength)*400ms)]` on `data-ending-style` — a
  harder flick closes faster, a soft release closes slower. This is the CSS
  equivalent of spring interruptibility: no JS physics engine, but the exit timing
  still reads the gesture's energy.
- The overlay dims via `opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(
  --drawer-swipe-progress)))]` and shares the drawer's paired easing (`ease-ios-sheet`,
  `--duration-drawer`) — overlay and popup move as one entity, per §3's pairing rule.
- Nested/stacked drawers scale and peek via `--stack-scale`/`--stack-peek-offset`
  computed from `--nested-drawers` and swipe progress — the "genie into a stack" feel
  the reference course reserves for a JS shared-layout library, done here with pure
  custom-property math.

### Checkbox — self-drawing checkmark (`packages/ui/src/components/checkbox.tsx`)

The check path uses `pathLength="1"` + `strokeDasharray="1"` and the shared
`animate-draw-stroke` keyframe (150ms, `ease-out-quart`) applied via
`motion-safe:animate-draw-stroke` — the exact self-drawing-line primitive from §5,
gated on `prefers-reduced-motion` at the Tailwind-variant level rather than a
JS `useReducedMotion()` hook.

### Score-ring sweep (`packages/ui/src/components/score-meter.tsx`)

The gauge's `strokeDashoffset` transitions with
`transition-[stroke-dashoffset] duration-[var(--duration-slow)] ease-out-quart
motion-reduce:transition-none` so the ring sweeps to a new score exactly like its
sibling linear indicator, `progress.tsx`'s `transition-[width] duration-[var(
--duration-slow)] ease-out-quart`. Two different visual encodings of the same value
must animate identically — a lesson learned from a real inconsistency (the ring used
to jump while the bar swept) and now enforced as a matched pair, same as dialog +
overlay.

### Dialog — Base UI transition idiom (`packages/ui/src/components/dialog.tsx`)

The canonical example of the `data-starting-style`/`data-ending-style` convention from
§2: overlay and popup both declare `transition-[opacity(,transform)]
duration-[var(--duration-fast)] ease-out-quart`, both zero out on
`data-starting-style`/`data-ending-style`, and the popup's exit additionally overrides
to `duration-[var(--duration-instant)]` — fast in, instant out. No `AnimatePresence`,
no exit-animation library: Base UI keeps the popup mounted (with these data
attributes flipped) for exactly as long as the CSS transition needs to finish, then
unmounts it.

### Tooltip — instant-within-group (`packages/ui/src/components/tooltip.tsx`)

Covered in §2's conventions: `data-instant` skips the enter transition for the 2nd+
tooltip in a hover sweep. Cite this whenever a reviewer asks "why doesn't this tooltip
fade in every time" — it's deliberate.

### Command palette — the "never animate" case (`packages/ui/src/components/command.tsx`)

`transition-none` on both overlay and popup. The palette flowchart answer (§1, §4):
opened via keyboard, used dozens of times a day, so it gets zero motion by design, not
by omission.

### Dropped from the reference

The reference guide's navigation-menu CSS recipe (`data-motion`-driven crossfade
between menu panels) is **not included** here — hodget has no navigation-menu
component (`@base-ui/react` nav-menu primitive isn't in use yet, confirmed by search).
Add it back once that primitive actually ships.

---

## 7. Charts & data visualization

hodget renders charts with **Recharts**, wrapped by `packages/ui/src/components/
chart.tsx`. This is new territory the reference guide doesn't cover, and it has one
hard rule that isn't optional.

### The hard rule: `isAnimationActive` + remount key must move together

`chart.tsx` exports `useChartAnimation()`:

```tsx
// Returns whether Recharts mount animations should run. `false` during SSR
// and on first render (avoids a hydration mismatch), then reflects
// `prefers-reduced-motion` once mounted.
function useChartAnimation(): boolean { /* … */ }
```

Every Recharts series (`<Line>`, `<Bar>`, `<Area>`, …) must receive
`isAnimationActive={useChartAnimation()}`, **and** the chart's root element must be
keyed on that same value:

```tsx
const isAnimationActive = useChartAnimation()

<ChartContainer key={isAnimationActive ? "animated" : "static"} config={config}>
  <LineChart data={data}>
    <Line dataKey="value" isAnimationActive={isAnimationActive} />
  </LineChart>
</ChartContainer>
```

**Why this is a hard rule, not a style preference:** Recharts' mount animation is a
one-shot rAF tween that plays once when a series first mounts with
`isAnimationActive={true}`. If `isAnimationActive` flips from `true` to `false` (or
back) on an *already-mounted* chart — for instance because `prefers-reduced-motion`
resolves asynchronously after first paint — Recharts does not replay or reset the
tween; the series' geometry is stranded wherever the interrupted animation left it,
which can mean **invisible or partially-drawn series**. Keying the container on the
same value forces a full remount whenever the animation mode changes, so the series
always mounts fresh with the `isAnimationActive` value it will keep. This is the CSS
`key`-prop-remount trick from §5, applied for the opposite reason: forcing a *correct*
replay instead of preventing an unwanted one.

### Reduced motion

Reduced-motion users get **fully static charts**, not slowed-down ones — `useChartAnimation()`
returns `false` under `prefers-reduced-motion: reduce`, which is the same "remove, don't
just reduce" posture as §11 (a modal that scales open just fades; here, a chart that
draws in just appears drawn).

### Crisp-finance-dashboard restraint

- **Single-hue series** per chart where possible; reach for the house `--chart-1`
  through `--chart-5` OKLCH tokens (`globals.css`) rather than ad hoc colors — they're
  already tuned for both light and dark via the `.dark` overrides.
- **No decorative chart junk** — no drop shadows on bars, no 3D, no gratuitous
  gradients. A finance dashboard's credibility rests on the numbers reading as exact.
- **Tabular numerals everywhere numbers change.** `chart.tsx`'s `ChartTooltipContent`
  already sets `font-mono font-medium text-foreground tabular-nums` on tooltip values —
  match that in any custom label/legend you add so digits don't jitter as the pointer
  moves.
- **Label demo data honestly.** If a chart ships with placeholder/mock data (e.g. the
  public `/demo` dashboard), label it as such in the UI copy — don't let a mocked
  series imply a live feed.

---

## 8. When we add a JS motion library (future)

**Today's rule:** everything is CSS transitions/keyframes through the token system in
§2, plus whatever a primitive (Base UI) already exposes as CSS variables or data
attributes (§6). hodget may adopt a JS motion library (`motion`, the successor to
framer-motion, is the natural candidate given Emil Kowalski's course this guide is
built on) once a task genuinely needs one of the things CSS cannot do:

- **Interruptible springs with velocity carry-through.** CSS transitions are
  interruptible but always re-linearize from the current value along the same easing
  curve — they can't preserve a gesture's *velocity* into a new target the way a
  spring can. The drawer's swipe system (§6) gets close with `--drawer-swipe-strength`
  scaling the closing duration, but that's a scripted approximation, not physics.
- **Shared-layout morphs** (`layoutId`-style: one element morphing into a differently
  positioned/sized one across a state or route change) — the tabs indicator (§6) works
  without this only because Base UI hands you the target rect directly; a
  card-expands-into-a-modal or trash-style "throw into a bin" interaction has no CSS
  equivalent.
- **Direction-aware, height-animated multi-step flows** where content crossfades while
  a container's height animates to a *measured* (not fixed) value — CSS can't measure
  `auto` and animate to it in one step.
- **Rich, multi-element SVG scenes** coordinated imperatively across hover/click/idle
  states (a hero illustration), where declarative CSS keyframes would require dozens of
  named animations to express what one `useAnimate()` call does with `await`.

**If a task looks like one of these, raise it — don't hand-roll a fragile JS approximation
in place of a real library, and don't reach for `motion` casually for something CSS
already does well** (a hover fade, a dialog fade/scale, a sliding indicator). The
following patterns are recorded here as **reference for that future decision**, adapted
from the same course, so the eventual integration follows house conventions from day
one rather than reinventing them:

- **Springs.** Configure via `{ type: "spring", duration, bounce }` (perceptual
  duration + designer-friendly bounce) or `{ stiffness, damping, mass }` (physics).
  Default **bounce to 0**; only add bounce (0.1–0.3) after a force-based gesture
  (drag-to-dismiss), never on a plain press-to-close.
- **`AnimatePresence`** for exit animations: always give children a stable `key`
  (missing key = no exit, the #1 bug); `mode="popLayout"` pops the exiting element out
  of layout flow so siblings settle immediately — usually the right mode.
- **`layout`/`layoutId`** for shared-layout morphs (tab indicators without a
  CSS-exposed rect, card expands, trash interactions) — remember the border-radius
  correction only auto-applies when the radius is in `px`, not Tailwind's `rem`-based
  `rounded-*`.
- **Motion values** (`useMotionValue`/`useSpring`/`useTransform`) for gesture-mapped or
  cursor-following values that must update outside React's render cycle.
- **`MotionConfig reducedMotion="user"`** at the app root, mirroring the CSS
  `prefers-reduced-motion` posture in §11, so a future integration doesn't regress
  accessibility.
- Recipes that would need this stack when we build them: a **Dynamic-Island-style**
  morphing pill (springs + duplicated-view morph trick), a **feedback popover** that
  morphs button → form → success card via shared `layoutId`, and a full **family-drawer**
  height-animates/content-crossfades combo (today's CSS drawer in §6 covers the
  swipe/dismiss mechanics; it does not crossfade multi-view content on a measured
  height).

---

## 9. Good → Great: the details

**Animation is brand.** Speed and easing convey feeling like fonts and color do:
- **Slow + `ease`** → premium, elegant.
- **Fast / no animation** → speed-focused product — this is hodget's default lane as a
  finance dashboard (§1).
- **Edgy `ease-in-out`** → young, forward-thinking.

**Orchestration.** Staggering children into a "wave" feels far nicer than everything at
once. Pure CSS: index-driven `animation-delay: calc(var(--index) * 60ms)`. The exact
delay is trial-and-error.

**Blur is polish.** A small `blur()` (with opacity/translate) on enter/exit creates a
better sense of motion and masks small imperfections — hodget's `fade-in-blur` keyframe
(§2) is exactly this pattern productionized as a token. When two states swap and it
still feels off, add ~2px blur during the transition to bridge the gap. **Never exceed
~20px** (very expensive, especially Safari).

**Review before shipping.** Great animations take time to *review*, not just to code.
Give a new animation **at least a day** and replay it with fresh eyes. Record it and
scrub frame-by-frame when something feels off but you can't name why.

**Proof of care** (guest lesson). Animations are the purest signal of care precisely
because they're optional and invisible in screenshots/Figma — they exist only in use.
Taking one more pass past where most people stop is what moves work from good to
great — the score-ring sweep (§6) exists because someone noticed the ring/bar
inconsistency and closed it, not because a spec demanded it.

---

## 10. Performance

**Performant = 60fps** — each frame must render in **~16.7ms** (1000/60).

**Render pipeline:** Layout (size/position) → Paint (draw layers) → Composite (draw
layers to screen).

**The golden rule: animate `transform` and `opacity` only.** They trigger just the
Composite step (GPU). `padding`/`margin`/`height`/`width` trigger all three and can drop
frames. Do a scale via `transform: scale()`, not by animating `padding`. The drawer's
height changes are the one deliberate exception in this codebase — `transition-
[transform,height,opacity,filter]` — because the height genuinely needs to reach an
open value; it's paired with `[interpolate-size:allow-keywords]` and only runs at
`--duration-drawer`, never on a hot path.

- **`clip-path` and `transform` are hardware-accelerated**; CSS/WAAPI can run off the
  main thread, which is precisely why the CSS-only approach in this repo doesn't cost a
  main-thread budget the way a JS `requestAnimationFrame` library would.
- **CSS variable inheritance gotcha.** A variable used for a transform on a
  deeply-nested tree recalculates styles for **all** descendants when it changes —
  watch this in the drawer's stack math (`--stack-scale`, `--stack-height`), which is
  written on the popup itself, not inherited arbitrarily deep.
- **Virtualize long lists** (`@tanstack/react-virtual`). **Pause looping animations
  off-screen** (IntersectionObserver) — relevant to `wiggle`/`blink`. **Preload**
  critical images and fonts. **Prevent layout shift** with hardcoded dimensions,
  skeletons, and `tabular-nums`.
- **Charts (§7):** Recharts' animation is a main-thread rAF tween, unlike the
  GPU-composited CSS elsewhere in this guide — a reason on its own to keep it strictly
  opt-out-able via `useChartAnimation()`, and to avoid animating many series/points
  simultaneously on a dashboard with several charts on screen.

---

## 11. Accessibility & reduced motion

Animations can make some users sick or distracted. Respect `prefers-reduced-motion`.

> `reduce` does **not** mean "no animation." Animations aid understanding. **Remove,
> reduce, or replace** — typically: disable autoplay, and animate only
> `opacity`/`color` (nothing should *move*). A modal that scales open should just fade.

hodget implements this as **three layered `@media` rules** at the bottom of
`packages/ui/src/styles/globals.css`, plus Tailwind's `motion-safe:`/`motion-reduce:`
variants used per-component:

### 1. `prefers-reduced-motion: reduce` — the transition-property allowlist

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-property: color, background-color, border-color, outline-color,
      text-decoration-color, fill, stroke, opacity, box-shadow !important;
    scroll-behavior: auto !important;
  }

  /* The drawer's entrance is transform-only, which the rule above strips —
     re-opt it into a fade so it never teleports. */
  [data-slot="drawer-popup"][data-open],
  [data-slot="drawer-overlay"][data-open] {
    animation: fade-in var(--duration-fast) var(--ease-out-quad) !important;
  }
}
```

Rather than zeroing every transition, this **flattens all keyframe animations** (they
mostly encode movement, including third-party components we don't hand-author) and
**restricts every transition's `transition-property`** to a fixed allowlist of
non-movement properties — opacity/color feedback that aids comprehension keeps
running, while transform/translate/width/height changes snap instantly. Because
dialogs already transition `opacity` as part of the Base UI idiom (§6), the base rule
alone preserves their fade with **no re-opt-in needed**. The drawer is the one
exception: its entrance is transform-only, so it gets an explicit re-opt-in `fade-in`
keyframe so it fades in instead of teleporting.

### 2. `prefers-reduced-transparency: reduce` — frosted scrims go solid

```css
@media (prefers-reduced-transparency: reduce) {
  [data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"],
  [data-slot="sheet-overlay"], [data-slot="drawer-overlay"] {
    backdrop-filter: none !important;
    background-color: rgb(0 0 0 / 0.6) !important;
  }
}
```

The blur comes off and the scrim darkens enough to separate layers on its own, since
blur was doing part of that separation work.

### 3. `prefers-contrast: more` — floating surfaces get real borders

```css
@media (prefers-contrast: more) {
  [data-slot="dialog-content"], [data-slot="alert-dialog-content"],
  [data-slot="popover-content"], [data-slot="sheet-content"],
  [data-slot="drawer-popup"] {
    --tw-ring-color: var(--foreground);
    border-color: var(--foreground);
  }
  [data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"],
  [data-slot="sheet-overlay"], [data-slot="drawer-overlay"] {
    background-color: rgb(0 0 0 / 0.6) !important;
  }
}
```

Floating surfaces trade their soft `foreground/10` ring for a fully contrasting one so
their edges stay defined under the OS "Increase contrast" setting, and scrims darken
for clearer layer separation.

### Per-component conventions

- Tailwind v4 ships `motion-safe:`/`motion-reduce:` variants — used directly on
  components whose animation isn't purely a `transition` (e.g. the checkbox's
  `motion-safe:animate-draw-stroke`, the tabs indicator's
  `motion-reduce:transition-none`).
- **Charts get their own handling** (§7) because the reduced-motion CSS layer above
  cannot reach into Recharts' internal rAF tweens — `useChartAnimation()` is the
  JS-side equivalent of this section's CSS rules.
- Every animated element needs its own reduced-motion handling. No exceptions for
  opacity — but for reduced motion, opacity/color are the *only* things that may
  change.
- **Icon buttons need an `aria-label`.** Interactive elements need real focus states
  (never `outline: none` without a replacement). Dialogs trap focus and restore it to
  the trigger on close. Provide a "Skip to content" link. 44px minimum tap targets.

---

## 12. Design engineering beyond motion

From the `emil-design-engineering` skill. The non-motion craft that makes UI feel
built, not assembled.

### Core principles
1. **No layout shift.** Hardcoded dimensions for dynamic areas, `tabular-nums` for
   changing numbers, never change font weight on hover/selected.
2. **Touch-first, hover-enhanced.** Design for touch, then add hover. Disable hover on
   touch. 44px minimum targets. Never rely on hover for core functionality.
3. **Keyboard navigation** works consistently; only tab through visible elements;
   scroll focused elements into view.
4. **Accessibility by default.** Reduced-motion support, aria labels on icon buttons,
   real focus states.
5. **Speed over delight** in product; marketing can be elaborate.

### Typography

hodget loads three families in `apps/web/app/layout.tsx` via `next/font/google`:

```tsx
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
```

- **Geist** (`--font-heading`, aliased from `--font-geist` in `globals.css`'s
  `@theme inline` block) — display headings.
- **Inter** (`--font-sans`) — UI chrome and body copy; the default (`font-sans` is set
  on `<html>`).
- **Geist Mono** (`--font-mono`) — code and numerals. Every changing number
  (tooltip values, score displays, timers) pairs `font-mono` with `tabular-nums` — see
  `chart.tsx`'s `ChartTooltipContent`: `font-mono font-medium text-foreground
  tabular-nums`.
- `-webkit-font-smoothing: antialiased` is set via the `antialiased` class on `<html>`.
- **Never change font weight on hover/selected** — it shifts layout. Change color
  instead.
- `text-wrap: balance` on headings. Larger text → tighter letter-spacing; smaller text
  → looser. Cap body at ~65ch.
- Proper glyphs: `…` not `...`, curly quotes/apostrophes.

### Color, shadows, dark mode
- **Borders as shadows:** `box-shadow: 0 0 0 1px rgba(0,0,0,0.08)` blends better than a
  solid border. Use alpha, not solid hex, for borders in both modes.
- **Hairline borders:** `0.5px` on retina via a `--border-hairline` variable.
- **Stacked shadows** (2–3 at different blur/opacity) read as physically real; one big
  drop shadow looks pasted on.
- **Dark mode via variable flips**, not Tailwind `dark:` overrides — hodget's `.dark`
  class in `globals.css` flips every semantic OKLCH token (`--background`,
  `--foreground`, `--card`, `--primary`, …) rather than sprinkling `dark:` utilities
  through components. Chart tokens (`--chart-1`…`--chart-5`) intentionally keep the
  same values in both modes in this file today — revisit if a series reads as too
  saturated in dark mode.
- **Eased gradients** over 2-stop linear gradients (linear gradients between solid
  colors band visibly). Prefer `mask-image` over gradients for fades. Never fade
  scrollable lists.
- **Focus outlines** stay grey/black/white. **Don't replace page scrollbars** (only
  small elements like code blocks).

### Layout
- **Inner radius = outer radius − padding** (matching radii leave a wrong-looking gap).
- **`gap` on the parent**, not `margin-bottom` on children (margin leaves a trailing
  gap).
- **Fixed z-index scale** (`--z-dropdown/modal/tooltip/toast`), or avoid z-index with
  `isolation: isolate`. Never `z-index: 9999`.
- **Safe areas:** `env(safe-area-inset-*)`. `scroll-margin-top` for anchor targets
  under a sticky header. Breakpoints where content breaks, not at device widths.
- Decorative elements: `pointer-events: none`; code illustrations: `user-select: none`.

### Forms & controls
- Associate every `<label>` with its input (`for`/`id` or wrapping). Use correct
  `type`. Inputs **≥ 16px** to prevent iOS zoom on focus.
- Wrap inputs in a `<form>` so Enter submits; support Cmd/Ctrl+Enter for textareas.
- Autofocus on modal open (but **not** on touch devices — it opens the keyboard).
- A button is a `<button>`, never a `<div onClick>`. Disable after submit to prevent
  duplicate requests. Show keyboard shortcuts in the button's tooltip. `active:scale-97`.
- Checkboxes: the whole row (label + control) is clickable, no dead zones.
- Colocate errors next to the field. Destructive actions require confirmation.
- Prefill forms from the logged-in user / request context when possible.

### Component design (API)
- **Compound components** for multi-part UI that shares state (`<Dialog.Trigger>`,
  `<Dialog.Content>`, `<Drawer.Root>`) — not prop drilling. Every hodget primitive in
  `packages/ui/src/components` follows Base UI's compound-component anatomy.
- **Variants + size + `className` escape hatch + `asChild`/`render`.** Not a boolean
  soup (`primary large rounded`) and not 30 style props.
- Consistent prop names (`disabled`, not `isDisabled`/`readonly`), positive booleans,
  `on*` event handlers. Forward refs, spread remaining props, sensible defaults
  (`type="button"`).
- Support controlled **and** uncontrolled. **Don't abstract until you've copy-pasted
  2–3 times.**

---

## 13. Design rules — right vs wrong

Fast paired calls to apply in review. (Full set in the `emil-design-engineering`
`design-rules` reference.)

**Iconography** — thin the stroke when scaling an icon down; snap to whole pixels;
6–8px gap between icon and label; one icon = one meaning; don't distinguish a pair by
rotation alone.

**Typography** — cap line length ~65ch; `tabular-nums` for number columns; bold (not
italic or underline) for UI emphasis; load only the weights you use; `…` via
unicode/CSS.

**Color** — alpha borders, not solid hex; stacked shadows; desaturate brand in dark
mode; semantic tokens, not raw hex; tinted neutrals over pure `#808080`; a distinct
success color if green is already the brand.

**Layout** — `gap` not `margin`; inner radius = outer − padding; cap container width;
break at content, not device widths; account for safe areas.

**Information architecture** — progressive disclosure over a flat 40-item page;
separate destructive actions with whitespace; name things by the user's mental model;
specific empty states with a next step; persistent primary action.

**Interaction** — replace removed focus rings; press/active states; skeletons over
spinners; optimistic updates; debounce search ~300ms; 44px targets; fire on `mouseup`
not `mousedown`; inline errors next to the field; label toggles the control.

**Timing/transitions** — hover ~150ms not 400ms; stagger lists ~40ms; ease-out for
enter/exit (never ease-in); asymmetric enter/exit; no `transition: all`; disable
transitions during theme change (we do, via `disableTransitionOnChange`);
`prefers-reduced-motion` on everything, including charts (§7, §11).

**Accessibility** — `aria-label` describes the *action*; state via more than color;
real `<button>`; skip link; associated labels; focus trap in dialogs; DOM order =
visual order.

**Copywriting** — "Save changes" not "Submit"; errors that say how to fix it;
persistent labels over placeholder-only; specific empty states; sentence case;
front-load the important word; own the ask ("Confirm", not "Please confirm…").

**Components** — one clear primary action per group; visually distinct input states;
tooltips can't hold interactive elements (use a popover); right-align tabular numbers;
toast duration scales with length; don't wrap a whole card in one `<a>`.

---

## 14. Review checklists

### Animation review
- [ ] Correct easing (ease-out enter/exit; ease-in-out on-screen movement; never
      ease-in). Custom curve from §2's `@theme` block, not a weak built-in.
- [ ] Duration from the `--duration-*` scale, written as `duration-[var(--duration-*)]`
      — not a numeric Tailwind duration.
- [ ] Exit shorter/simpler than enter (match the dialog's fast-in/instant-out pattern).
- [ ] Would a frequent-use element be better with **no** animation (command palette
      precedent)?
- [ ] Only `transform`/`opacity`/`clip-path` animated (no layout properties), unless
      it's the drawer's deliberate, rate-limited height exception.
- [ ] Enters start from `scale(0.9+)`, never `scale(0)`.
- [ ] Paired elements share easing + duration (overlay + content, ring + bar).
- [ ] Transition-property list is explicit — never `transition-all`.
- [ ] `prefers-reduced-motion` handled (remove/reduce/replace, not just delete); charts
      checked separately via `useChartAnimation()`.
- [ ] If it's a chart: `isAnimationActive` and the container `key` change together.
- [ ] Reviewed with fresh eyes / scrubbed frame-by-frame.

### UI review
- [ ] No layout shift on dynamic content (dimensions, `tabular-nums`, stable weights).
- [ ] Touch targets ≥ 44px; hover disabled on touch; no hover-only functionality.
- [ ] Keyboard nav works; icon buttons have `aria-label`; focus states present.
- [ ] Inputs ≥ 16px; forms submit on Enter / Cmd+Enter; errors colocated.
- [ ] No `transition: all`; z-index on a fixed scale (no `9999`).
- [ ] Dark mode via token flips in `globals.css`, not `dark:` utility sprinkling;
      borders use alpha; gradients eased.
- [ ] Headings use Geist, body/UI uses Inter, code/numerals use Geist Mono +
      `tabular-nums`.

---

## 15. Animation vocabulary (glossary)

Shared terminology so "make it feel right" becomes a specific, nameable request.

### Core terms (apply to hodget's CSS-only stack today)

| Term | Definition |
|---|---|
| **60fps / 16.7ms budget** | Performant = 60 frames/sec; each frame must render within ~16.7ms (1000/60) to read as fluid. |
| **animation-fill-mode** | How an animation applies styles outside its run: `forwards` keeps the end state, `backwards` applies the first keyframe before start (delayed enters), `both`. |
| **animation-play-state** | Keyframe-only `running`/`paused` — transitions can't pause/resume. |
| **Big little details** | Small, optional animated touches that push past where most people stop, making UI feel crafted. |
| **Border-radius distortion** | Rounded corners warping during transform-based layout changes; correct with a pixel-based radius, not a `rem`-based one. |
| **clip-path `inset()`** | Clip shape by top/right/bottom/left offsets; `inset(100%)` hides all; animating offsets reveals/hides parts with no layout shift. |
| **Composite / Paint / Layout** | The three browser render steps. Animating only `transform`/`opacity` triggers just Composite (cheapest); layout properties trigger all three. |
| **Compound component** | A component made of cooperating sub-components (Root, Trigger, Content, Popup…); Base UI documents this as each primitive's "anatomy." |
| **cubic-bezier()** | CSS function taking four control-point values to define a custom easing curve. |
| **Custom easing curve** | A cubic-bezier with stronger acceleration than the (usually too weak) built-ins; asymmetric curves feel more alive. |
| **`data-starting-style` / `data-ending-style`** | Base UI's transition idiom: data attributes present around mount/unmount so a plain CSS transition can key off them instead of an imperative exit-animation library. |
| **`data-instant`** | Attribute Base UI's tooltip sets on the 2nd+ tooltip shown within a group, skipping the enter transition so a hover sweep doesn't refade every item. |
| **ease** | The CSS default timing function; asymmetric (faster start, slower end). Reserved for small gentle hover transitions. |
| **ease-in** | Slow start, fast end. Avoided in UI — feels sluggish and settles unnaturally. |
| **ease-in-out** | Accelerate then decelerate, like a car. For elements already on screen that move/morph. |
| **ease-out** | Fast start, decelerate to settle. The UI default; for anything entering or exiting. |
| **Eased gradient** | Many intermediate color stops positioned along an easing curve, replacing a 2-stop linear gradient to remove visible banding. |
| **Easing** | The function describing the rate a value changes over time — the single most important part of an animation. |
| **Easing-first process** | Pick the easing before tuning duration, because the right duration depends on the easing. |
| **Fast in / instant out** | hodget's dialog convention: enter at `--duration-fast` (150ms), exit at `--duration-instant` (100ms) — exits read as snappier than entries. |
| **Hardware-accelerated animation** | One the browser offloads to the GPU (typically `transform`/`opacity`/`clip-path`), staying smooth regardless of main-thread load. |
| **Interruptibility** | The ability to re-target an in-flight animation without jumping. CSS transitions are interruptible along their curve; keyframes are not. |
| **key-prop remount** | Replaying a CSS animation in React by changing the `key` (via a counter or a derived value) to force a remount — used both to intentionally replay (§5) and to force correct chart re-mounts when the animation mode flips (§7). |
| **Origin-aware animation** | Scaling a popover/tooltip from its trigger (via `--transform-origin`) instead of the CSS-default center. |
| **pathLength** | Overrides a path's real pixel length for stroke math, letting you normalize to 1 and share values across paths — used by the checkbox's `draw-stroke` animation. |
| **Perceived performance** | How fast an interface *feels* vs. actually is; well-chosen easing and instant feedback make it feel quicker at equal timing. |
| **prefers-contrast** | OS accessibility preference (`more`) hodget uses to swap floating surfaces' soft rings for fully contrasting borders. |
| **prefers-reduced-motion** | OS motion preference: `no-preference` (animate normally) or `reduce` (remove, reduce, or replace — typically animate only opacity/color). |
| **prefers-reduced-transparency** | OS accessibility preference (`reduce`) hodget uses to turn frosted/blurred scrims into solid ones. |
| **Proof of care** | The idea that optional, screenshot-invisible animations are the purest signal of how much a maker cared — a trust-builder and differentiator. |
| **Purposeful animation** | One whose reason to exist is obvious to designer and user (explanation, feedback, spatial consistency, rare delight), not decoration. |
| **Self-drawing line** | `strokeDasharray`/`strokeDashoffset` animated from full-length to 0 with `pathLength="1"`, producing a line that appears to draw itself — hodget's checkbox check. |
| **Spatial consistency** | Designing motion so elements enter/exit from consistent directions/origins, so the UI feels like one coherent space. |
| **Swipe custom properties** | CSS custom properties a gesture-aware primitive (hodget's `Drawer`) writes live during a drag (`--drawer-swipe-progress`, `--drawer-swipe-movement-*`) so pure CSS can track a pointer without a JS physics engine. |
| **tabular-nums** | A `font-variant-numeric` making digits equal-width so a changing countdown, tooltip value, or score doesn't jitter. |
| **Trackability threshold** | The point below which an animation is too fast for the eye to follow — too fast is as bad as too slow. |
| **transform-origin** | The anchor transforms execute from (default center); set to the trigger edge so popovers/tooltips scale out of their trigger. |
| **transition (CSS shorthand)** | `property duration timing-function delay`, e.g. `transform 200ms ease 100ms`. |
| **Unstyled primitive** | An accessible library (Base UI, in this repo) providing keyboard nav, focus management, and a11y with no styling. |

### JS-motion-only terms (relevant only once §8 is adopted)

| Term | Definition |
|---|---|
| **AnimatePresence** | A `motion`-style component that lets children play an `exit` animation before unmount; children need stable `key`s. |
| **AnimatePresence mode** | Timing strategy: `wait` (exit fully finishes before enter), `popLayout` (exiting element popped out of layout flow so siblings settle immediately), `sync`. |
| **Bounce** | A spring's overshoot-and-settle quality (0–1). Default 0; only appropriate after a force gesture, and then small. |
| **`custom` prop** | Passes live data (e.g. slide direction) to variants; set on both `AnimatePresence` and the child so exiting elements use current, not stale, data. |
| **Declarative vs imperative** | Declarative = `initial`/`animate`/`exit` props (~90% of the time); imperative = `useAnimate()` + scope selectors (more power, harder to maintain). |
| **Dynamic opacity duration** | Computing a fade's duration from how much a container's height changed (clamped) so small changes fade less than large ones. |
| **Fluid interface** | A seamless UI where elements morph into one another instead of swapping via static transitions. |
| **Layout animation (`layout`)** | Adding `layout` makes the library animate any size/position/flex change, including CSS-unanimatable properties. |
| **layoutId (shared layout)** | Two elements sharing a `layoutId` are morphed into one another — the basis of card expands and trash interactions when a primitive doesn't already expose the target geometry. |
| **Morph effect** | Transitioning between two content-rich states while the container changes both width and height. |
| **Motion value** | A primitive (`useMotionValue`) that updates outside React's render cycle, so changing it doesn't re-render. `.get()`/`.set()`. |
| **MotionConfig** | Provider setting a default transition and `reducedMotion` for all descendant components. |
| **Spring animation** | Motion modeled on a physical spring; no fixed duration, so it feels natural by definition. Configured via stiffness/damping/mass or duration/bounce. |
| **Stagger** | An incremental delay applied automatically to each child in a list. |
| **useTransform** | Derives a motion value by mapping inputs via range or a function. |
| **Variants** | Named target sets (`{hidden, visible}`) referenced by string in `initial`/`animate`/`exit`; can be functions of a `custom` value for direction-awareness. |
| **whileTap** | A prop defining the target state while pressed, giving buttons a tactile feel. |

---

## 16. Quick-reference numbers

| Thing | Value |
|---|---|
| Product UI duration ceiling | < 300ms (180ms snappy, 400ms slow) |
| Hover transitions | 100–150ms; hover scale 1–2% max |
| Button press scale | `active:scale-[0.97]`, ~150ms |
| Enter/exit initial scale | 0.9+ (0.85–0.95), never `scale(0)` |
| Dialog | enter `--duration-fast` (150ms), exit `--duration-instant` (100ms), `ease-out-quart` |
| Drawer (sheet) | `--duration-drawer` (450ms), `ease-out-quint` content / `ease-ios-sheet` overlay |
| Tabs indicator | `--duration-base` (200ms), `ease-out-quart` |
| Score-ring sweep | `--duration-slow` (300ms), `ease-out-quart` |
| Checkbox draw-stroke | 150ms, `ease-out-quart` |
| Page transitions | 300–400ms max |
| Stagger interval | ~40–60ms |
| iOS-sheet curve | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Blur mask / cap | ~2px to mask; never exceed ~20px (Safari) |
| Minimum tap target | 44px |
| Input font size | ≥ 16px (prevents iOS zoom) |
| Frame budget | 16.7ms (60fps) |

---

### Sources & credit

Every idea and technique here is **Emil Kowalski's** — full credit to him:

- **Emil Kowalski** — <https://emilkowal.ski> · skill: <https://emilkowal.ski/skill>
- **animations.dev — _Animations on the Web_** (the paid course, all 45 lessons across
  Animation Theory, CSS Animations, Framer Motion, Good vs Great, Family Drawer, Dynamic
  Island, Navigation Menu, Hero Illustration, and the guest lesson). **Recommended** —
  <https://animations.dev/>.
- `web-animation-design` skill (from the same course).
- `emil-design-engineering` skill (UI polish, forms, touch/a11y, component design,
  performance, design rules).
