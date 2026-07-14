# 014 — Tokenize transitions on ui primitives (tabs, select, button, badge)

- **Status**: TODO
- **Commit**: 2526020
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 4 files (packages/ui/src/components/{tabs,select,button,badge}.tsx), 4 class-string edits

## Problem

Four ui primitives declare transitions without a duration/easing token, so
they run at the browser/Tailwind default instead of the house scale. The app
components already do this right (see exemplar below); the primitives they sit
next to don't, so a tab trigger and the segment control beside it settle at
different speeds. One primitive (badge) transitions for no reason at all.

```tsx
// packages/ui/src/components/tabs.tsx:82 — current (TabsTrigger, first class line)
"relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-none border border-transparent px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground/60 transition-[color,background-color,border-color,box-shadow] group-data-vertical/tabs:w-full ..."
```

- No duration/easing; and `box-shadow` is in the property list although the
  trigger's focus ring is a Tailwind `ring` (box-shadow) that should snap, not
  ease — animating focus rings makes keyboard navigation feel laggy.

```tsx
// packages/ui/src/components/select.tsx:45 — current (SelectTrigger, excerpt)
"flex w-fit items-center justify-between gap-1.5 rounded-none border border-input bg-transparent py-2 pr-2 pl-2.5 text-xs whitespace-nowrap transition-colors outline-none select-none ..."
```

- `transition-colors` with no duration/easing.

```tsx
// packages/ui/src/components/button.tsx:7 — current (buttonVariants base, excerpt)
"group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent bg-clip-padding text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px ..."
```

- No duration/easing; `box-shadow` in the list eases the focus ring (same
  problem as tabs). `transform` stays — it drives the
  `active:not-aria-[haspopup]:translate-y-px` press feedback.

```tsx
// packages/ui/src/components/badge.tsx:8 — current (badgeVariants base, excerpt)
"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] focus-visible:border-ring ..."
```

- Badges are static labels. A few variants have `[a]:hover:` styles, but a
  label's hover tint needs no easing — this transition is purposeless
  inheritance from upstream shadcn.

## Target

Exact class-string changes (only the shown fragment changes; everything
around it stays byte-identical):

1. `packages/ui/src/components/tabs.tsx:82` — replace
   `transition-[color,background-color,border-color,box-shadow]` with
   `transition-[color,background-color,border-color] duration-[var(--duration-instant)] ease-out-quad`.
   Rationale: tab switches happen 100+ times a day, so they get the
   frequency-scaled instant tier (100ms) — matching the app's hand-rolled
   segment controls (exemplar below).
2. `packages/ui/src/components/select.tsx:45` — replace `transition-colors`
   with `transition-colors duration-[var(--duration-instant)] ease-out-quad`.
3. `packages/ui/src/components/button.tsx:7` — replace
   `transition-[color,background-color,border-color,box-shadow,transform]` with
   `transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] ease-out-quad`.
   Rationale: press feedback tier per Design.md §16 ("Button press scale …
   ~150ms") — `--duration-fast` is 150ms.
4. `packages/ui/src/components/badge.tsx:8` — delete
   `transition-[color,background-color,border-color,box-shadow]` entirely
   (and the space it leaves). No replacement.

## Repo conventions to follow

- Motion tokens live in `packages/ui/src/styles/globals.css`: easings at
  lines 75-77 (`--ease-out-quad`, `--ease-out-quart`, exposed as Tailwind
  `ease-out-quad` / `ease-out-quart` utilities) and durations at lines 191-195
  (`--duration-instant: 100ms; --duration-fast: 150ms; --duration-base: 200ms;
  --duration-slow: 300ms; --duration-page: 400ms`). Durations are written as
  `duration-[var(--duration-*)]` — never numeric Tailwind durations like
  `duration-150`.
- Explicit transition-property lists, never `transition-all`.
- Exemplar of a correctly tokenized hover:
  `apps/web/components/dashboard/fund-monitor/attention-panel.tsx:38` —
  `transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 …`.
- Design.md is the canonical motion guide (§2 tokens, §16 quick-reference
  numbers).

## Steps

1. Edit `packages/ui/src/components/tabs.tsx:82` per Target item 1.
2. Edit `packages/ui/src/components/select.tsx:45` per Target item 2.
3. Edit `packages/ui/src/components/button.tsx:7` per Target item 3.
4. Edit `packages/ui/src/components/badge.tsx:8` per Target item 4.
5. Sanity-sweep consumers: `grep -rn "TabsTrigger\|SelectTrigger" apps/web`
   and skim the playbook page (`localhost:3000/playbook`) plus the dashboard
   to confirm no consumer relied on the removed `box-shadow` easing or the
   badge transition (none should — these are hover/focus color effects).

## Boundaries

- Class-string edits only — do NOT change markup, props, variants, or
  component APIs.
- Do NOT touch the `TabsIndicator` (`tabs.tsx:65`) — its
  `transition-transform … motion-reduce:transition-none` is correct and owned
  by no plan here.
- Do NOT touch any other primitive in `packages/ui`.
- Note: these are color-only transitions after the edit, so do NOT add
  `motion-reduce:transition-none` — the global reduced-motion layer
  (`globals.css:273-282`) already restricts transitions to a color/opacity
  allowlist. Button's `transform` entry is auto-stripped by the same layer.
- If a cited line has drifted from the excerpts above, STOP and report.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
- **Feel check**: run `pnpm --filter web dev`:
  - `localhost:3000/demo` → Strategies view uses `Tabs`: switching tabs, the
    trigger text/background tint changes near-instantly (100ms) and the focus
    ring appears with zero lag when tabbing with the keyboard.
  - Runs view toolbar uses `Select`: hovering/focusing the trigger eases its
    colors quickly; opening feels unchanged.
  - Any `Button` (e.g. "New run"): hover tint eases at ~150ms; pressing still
    nudges down 1px; the focus ring snaps on instantly when tabbing.
  - `localhost:3000/playbook`: badges render identically; hovering linked
    badges changes color instantly with no easing — acceptable and intended.
  - In DevTools, force `:hover` on a TabsTrigger and scrub the transition in
    the Animations panel at 10%: the curve decelerates (quad), no box-shadow
    animating.
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel): hover tints
    still ease (color allowlist), button press translate snaps — both correct.
- **Done when**: all four class strings match the Target exactly, the
  playbook and dashboard look unchanged at rest, and typecheck is green.
