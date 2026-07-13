# 002 — Replace transition-all with scoped transition properties

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 5 files, one class-string edit each

## Problem

`transition: all` animates every changing property off-GPU — always a finding
(audit rule: animate `transform` and `opacity` only; `all` sweeps layout and
paint properties along). Five components declare `transition-all`, and they are
among the highest-frequency elements in the system:

```tsx
// packages/ui/src/components/button.tsx:7 — current (excerpt)
"... whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px ..."
```

```tsx
// packages/ui/src/components/badge.tsx:8 — current (excerpt)
"... whitespace-nowrap transition-all focus-visible:border-ring ..."
```

```tsx
// packages/ui/src/components/tabs.tsx:61 — current (excerpt)
"... text-foreground/60 transition-all group-data-vertical/tabs:w-full ..."
```

(The tabs trigger also toggles `w-full` in vertical mode — `transition-all`
animates that width change, a layout property.)

```tsx
// packages/ui/src/components/accordion.tsx:37 — current (excerpt)
"... py-2.5 text-left text-xs font-medium transition-all outline-none hover:underline ..."
```

```tsx
// packages/ui/src/components/sidebar.tsx:293 — current (excerpt)
"absolute inset-y-0 z-20 hidden w-4 transition-all ease-in-out-quart group-data-[side=left]:-right-4 ..."
```

(The rail only changes `::after` background color on hover; `transition-all`
with no duration also inherits the default duration.)

## Target

Each component transitions only the properties that actually change on its
states:

| File:line | Replace `transition-all` with |
| --- | --- |
| button.tsx:7 | `transition-[color,background-color,border-color,box-shadow,transform]` |
| badge.tsx:8 | `transition-[color,background-color,border-color,box-shadow]` |
| tabs.tsx:61 | `transition-[color,background-color,border-color,box-shadow]` |
| accordion.tsx:37 | `transition-[color,border-color,box-shadow]` |
| sidebar.tsx:293 | `transition-colors` (keep the existing `ease-in-out-quart`) |

The button keeps `transform` in the list because of its press feedback
(`active:...:translate-y-px`). The tabs trigger deliberately does NOT get
`width` in the list — the vertical-mode `w-full` toggle should snap, not
animate through layout.

Before finalizing each list, check the component's variant strings for other
transitioned properties (e.g. hover/focus states in `buttonVariants`) and
include any property that visibly changes on hover/focus/active/checked. Do not
include `width`, `height`, `margin`, or `padding` anywhere.

## Repo conventions to follow

- Scoped transition lists already exist in the repo — exemplar:
  `packages/ui/src/components/popover.tsx:40` uses
  `transition-[opacity,transform]`, and `packages/ui/src/components/filter-pill.tsx:29`
  uses `transition-[width,transform,opacity]`.
- Tailwind v4 arbitrary-property syntax: `transition-[color,box-shadow]`.
- Keep every other class in the string byte-identical.

## Steps

1. Edit `packages/ui/src/components/button.tsx:7`: swap `transition-all` for the scoped list above.
2. Edit `packages/ui/src/components/badge.tsx:8`: same pattern.
3. Edit `packages/ui/src/components/tabs.tsx:61`: same pattern.
4. Edit `packages/ui/src/components/accordion.tsx:37`: same pattern.
5. Edit `packages/ui/src/components/sidebar.tsx:293`: swap `transition-all` for `transition-colors`.
6. Grep `packages/ui/src` and `apps/web/app` for any remaining `transition-all` — the result must be zero.

## Boundaries

- Do NOT touch durations, easings, or any other class in these strings (a
  separate plan, 005, handles duration tokens).
- Do NOT change component markup or props.
- Do NOT add new dependencies.
- If a cited line has drifted from the excerpt, STOP and report.

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui lint && pnpm --filter web build` — green. `grep -rn 'transition-all' packages/ui/src apps/web/app` — zero hits.
- **Feel check**: `pnpm --filter web dev` → `localhost:3000/playbook`:
  - Buttons: hover and press — color fades and the 1px press-down still animate identically.
  - Badges: hover/focus — ring/color feedback unchanged.
  - Tabs: switch tabs — active state changes look identical; in DevTools set Animations panel to 10% and confirm no width animation plays on the trigger.
  - Accordion: hover a trigger — underline/color unchanged.
- **Done when**: zero `transition-all` remains and all hover/press/focus feedback looks unchanged at normal speed.
