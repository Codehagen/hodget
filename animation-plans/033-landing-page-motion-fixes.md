# 033 — Landing page motion fixes (hero intro once-per-load, footer duration, canvas scroll-entrance)

- **Status**: DONE
- **Commit**: 9d9169e (base; work left uncommitted per task)
- **Severity**: MEDIUM (a) + LOW (b) + LOW (c)
- **Category**: Frequency / Cohesion / Missed opportunity
- **Estimated scope**: 8 files — page.tsx, decision-canvas.tsx, decision-flow.tsx
  (prop only), + new components/landing/{intro-gate,canvas-reveal}.{tsx,css}

Audit target: the marketing landing page (`apps/web/app/page.tsx`) and the
decision-map canvas it embeds. Verified in headless Chromium against
`http://localhost:3000/` and `/demo/decisions`, both the play and suppressed
states, zero app console errors.

## (a) Hero intro replays on back-nav — MEDIUM, Frequency

`page.tsx`'s hero wrapper carried `motion-safe:animate-slide-up-fade`, so the
`slide-up-fade` intro re-ran on every client navigation back to `/`. Design.md
§1 is explicit: marketing intros run **once**, never replay on back-nav.

Extracted the hero wrapper into a small `"use client"` component,
`components/landing/intro-gate.tsx`. A **module-scoped** `played` flag gates the
first play:

- Read in a `useState` initializer, so a re-mounted (back-nav) instance renders
  already-suppressed **before first paint** — no post-paint flash.
- Surfaced as `data-intro="seen"` which nulls `animation-name` via colocated
  `intro-gate.css` — mirroring the `data-entrance` precedent in
  `decisions-view.css` (null only the name so the Tailwind `animation` shorthand
  and the class stay in place).
- Flipped to `true` in a **`useEffect`**, not on `animationend`. The literal
  brief said `animationend`, but in dev the 400ms CSS animation finishes before
  hydration attaches a React handler, so `onAnimationEnd` is **missed** and the
  intro replays (verified — the flag never flipped). The effect always runs
  post-mount. It is deferred one tick and cleaned up (`setTimeout(0)` +
  `clearTimeout`) so React Strict-Mode's throwaway first mount does not mark it
  played early — otherwise the real mount would suppress the very first play.

**No hydration mismatch, no sessionStorage.** On the initial SSR + hydration the
flag is `false` on both server and first client render (fresh module), so the
markup matches. Module scope (not sessionStorage) is deliberate: it survives
client navigations but **resets on a full reload**, which is exactly the spec'd
behavior — `sessionStorage` survives a hard reload and would wrongly suppress
the intro there (and reading it in the initializer would mismatch on reload).

## (b) Footer link hover duration drift — LOW, Cohesion

`page.tsx`'s two footer links used `duration-[var(--duration-fast)]` (150ms) on
a `transition-colors` hover. The settled repo idiom for a color-only hover is
`--duration-instant` (100ms). Swapped both.

## (c) Landing canvas entrance wasted below the fold — LOW, Missed opportunity

The decision-map's one-time staggered entrance (plan 025) ran at page load. On
the landing page the canvas sits below the fold, so a visitor scrolls down to a
graph that has **already assembled** — the "pipeline assembling itself" story is
lost. Deferred it to first view.

- `DecisionFlow` and `DecisionCanvas` gained an optional `entrance?: boolean`
  prop (controlled/uncontrolled shape: **omit** = current behavior, no attribute,
  entrance plays on mount; `false`/`true` = render a `data-entrance` gate on the
  `.decision-map-canvas` wrapper). Default keeps `/demo/decisions` and the
  per-run pages untouched (verified: their canvas has **no** `data-entrance`
  attribute; decisions-view's own `.decisions-map[data-entrance]` ancestor gate
  is separate and unchanged).
- New `components/landing/canvas-reveal.tsx` wraps `DecisionCanvas`, runs a
  **one-shot IntersectionObserver** (`threshold: 0.25`) that flips `entrance`
  from `false` → `true` on first intersection, then disconnects. Above-the-fold
  viewports (canvas visible on load) trigger it immediately.
- New colocated `canvas-reveal.css` suppresses the keyframe while off
  (`.decision-map-canvas[data-entrance="off"] .react-flow__node, … .react-flow__edges
  { animation-name: none }`). The added `[data-entrance]` attribute raises
  specificity over `decision-flow.css`'s base rule; flipping to `"on"` restores
  `animation-name: fade-in`, which restarts the keyframe. Mirrors the
  consumer-side gate pattern of `decisions-view.css`.

Reduced motion is handled upstream — the entrance keyframe lives in a
`prefers-reduced-motion: no-preference` block (`decision-flow.css`) — so a static
canvas never depends on the scroll trigger.

## Repo conventions to follow

- Token durations/easings only; explicit `animation-name: none` gate, never
  `transition-all` (Design.md §2).
- Intros play once, never on back-nav; frequency rule (Design.md §1/§4).
- `data-*` attribute + CSS gate mirrors the `data-entrance` precedent
  (`decisions-view.css`), keeping animation classes static and grep-able.
- Server page renders client wrappers; `map` was already crossing the
  server/client boundary (DecisionCanvas is `"use client"`), so it stays
  serializable.

## Boundaries

- (a) Module flag, not sessionStorage (spec: hard reload replays). Effect +
  Strict-Mode-safe deferral, not `animationend` (hydration race).
- (c) `entrance` **default undefined** — do not render `data-entrance` when the
  prop is absent, so decisions/per-run pages are byte-for-byte unchanged.
- Did **not** touch `decisions-view.tsx`, `decisions-view.css`, `summary-tab.tsx`
  (owned by a concurrent agent) or `decision-flow.css` (the base keyframe rule).
  All new CSS lives in the two new colocated landing stylesheets.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green (4/4). `pnpm --filter web test`
  — green (59/59).
- **Feel check** (headless Chromium, 1440px, both above- and below-fold viewports):
  - (a) fresh load → `.hero-intro` `data-intro="play"`, computed
    `animation-name: slide-up-fade`. Soft-nav `/` → `/blog` → `/` (JS realm
    preserved, verified via a persisted `window` flag) → `data-intro="seen"`,
    `animation-name: none` (no replay). Hard reload → `data-intro="play"`,
    `slide-up-fade` (plays again). All three states confirmed.
  - (b) footer link computed `transition-duration: 0.1s`
    (`--duration-instant`), color-only property list.
  - (c) below fold (canvas top 581 > viewport 500): `.decision-map-canvas`
    `data-entrance="off"`, node `animation-name: none`. After scroll into view:
    `data-entrance="on"`, node `animation-name: fade-in` (stagger plays once).
    Above the fold (1440×900): `data-entrance` flips to `"on"` on load (plays).
    `/demo/decisions`: canvas has **no** `data-entrance` attribute; ancestor
    `.decisions-map[data-entrance="on"]` unchanged; no console errors.
  - Zero app console errors on `/` and `/demo/decisions` (only pre-existing
    Next.js font-preload warnings).
- **Done when**: hero intro plays once per full load and never on back-nav;
  footer hover uses `--duration-instant`; landing canvas entrance defers to first
  view and plays once; decisions/per-run pages untouched; typecheck + tests
  green. All met.
