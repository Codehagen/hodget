# 005 — Route every duration and easing through the token scale

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: ~14 files, mechanical class swaps

## Problem

The house defines `--duration-instant/fast/base/slow/page/drawer`
(100/150/200/300/400/450ms) in `packages/ui/src/styles/globals.css:165-170`,
and part of the codebase references them (`drawer.tsx:75,125`, `tree.tsx:364`,
`progress.tsx:48`, `dialog.tsx:35,59`, `alert-dialog.tsx:33,55`). The majority,
however, hardcode numeric `duration-NNN` utilities that happen to match today's
values but silently detach from the scale if a token is ever retuned. Three
components also fall back to non-house easing defaults, and the menu's exit
timing diverges from its siblings.

## Target

### A. Numeric durations → tokens (same milliseconds, token-routed)

| File:line | Current | Target |
| --- | --- | --- |
| popover.tsx:40 | `duration-150` + `data-ending-style:duration-100` | `duration-[var(--duration-fast)]` + `data-ending-style:duration-[var(--duration-instant)]` |
| menu.tsx:20 | `duration-150` | `duration-[var(--duration-fast)]` |
| select.tsx:87 | `duration-150` + `data-ending-style:duration-100` | tokens as popover |
| tooltip.tsx:53 | `duration-150` + `data-ending-style:duration-100` | tokens as popover |
| sheet.tsx:32 | `duration-150` | `duration-[var(--duration-fast)]` |
| sheet.tsx:57 | `duration-200` + `data-ending-style:duration-150` | `duration-[var(--duration-base)]` + `data-ending-style:duration-[var(--duration-fast)]` |
| dropzone.tsx:120 | `duration-150` | `duration-[var(--duration-fast)]` |
| accordion.tsx:58 | `duration-200` | `duration-[var(--duration-base)]` |
| filter-pill.tsx:29 | `duration-200` | `duration-[var(--duration-base)]` |
| drawer.tsx:92 | `duration-200` | `duration-[var(--duration-base)]` |
| drawer.tsx:156 | `duration-300` | `duration-[var(--duration-slow)]` |
| table.tsx:63 | `duration-100` | `duration-[var(--duration-instant)]` |
| tree.tsx:263 | `duration-100` | `duration-[var(--duration-instant)]` |
| item.tsx:38 | `duration-100` | `duration-[var(--duration-instant)]` |
| sidebar.tsx:222,234,404 | `duration-200` | `duration-[var(--duration-base)]` |

Do NOT touch: `duration-0` (drawer.tsx swipe interrupt) and
`duration-[calc(var(--drawer-swipe-strength)*400ms)]` — deliberate,
velocity-scaled values.

### B. Non-house easing defaults → tokens

```tsx
// packages/ui/src/components/dropzone.tsx:120 — current
"... transition-[border-color,background-color] duration-150 ease-out ..."
// target: replace the raw built-in `ease-out` with `ease-out-quart`
```

```tsx
// packages/ui/src/components/sheet.tsx:32 — current (overlay, no easing → CSS default `ease`)
"fixed inset-0 z-50 bg-black/10 text-xs/relaxed transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
// target: add `ease-out-quart` (matching the sheet panel on line 57)
```

```tsx
// packages/ui/src/components/checkbox.tsx:16 — current: `transition-shadow` (default 150ms + default ease-in-out curve)
// target: `transition-shadow duration-[var(--duration-fast)] ease-out-quart`

// packages/ui/src/components/switch.tsx:16 — current: `transition-colors`
// target: `transition-colors duration-[var(--duration-fast)] ease-out-quart`

// packages/ui/src/components/switch.tsx:21 (Thumb) — current: `transition-transform`
// target: `transition-transform duration-[var(--duration-fast)] ease-out-quart`
```

```tsx
// packages/ui/src/components/drawer.tsx:92 — grab handle, no easing
// target: add `ease-out-quart` alongside the duration token swap
```

Also check `sidebar.tsx:428,479,568` — bare `transition-transform` /
`transition-[width,height,padding]` with no duration/easing: add
`duration-[var(--duration-base)] ease-in-out-quart` (in-out because these are
on-screen morphs, matching sidebar.tsx:222's existing choice).

### C. Menu exit matches its siblings

```tsx
// packages/ui/src/components/menu.tsx:20-22 — current: no ending-style duration → exits at full 150ms
// target: add `data-ending-style:duration-[var(--duration-instant)]`
//         (popover/select/tooltip all exit at 100ms; menu must match)
// Also normalize menu.tsx:19 `origin-[var(--transform-origin)]`
// → `origin-(--transform-origin)` (the v4 shorthand its siblings use).
```

## Repo conventions to follow

- Token exemplar: `packages/ui/src/components/tree.tsx:364` —
  `transition-transform duration-[var(--duration-fast)] ease-out-quad motion-reduce:transition-none`.
- Duration tokens live in `globals.css:165-170`; do not add new tokens.
- Easing utilities (`ease-out-quart` etc.) come from the `@theme` block in
  globals.css — use utility form, not arbitrary `ease-[var(...)]`.

## Steps

1. Apply table A swaps file by file (mechanical; keep every other class intact).
2. Apply the B fixes (dropzone, sheet overlay, checkbox, switch ×2, drawer
   handle, sidebar bare transitions).
3. Apply the C menu fixes.
4. Grep for leftovers: `grep -rnE 'duration-(100|150|200|300|500)\b' packages/ui/src` — expect zero hits (numeric `duration-75`/others should not exist either; report any stragglers found).

## Boundaries

- Do NOT change which properties are transitioned (plan 002 owns that) except
  where a B-item explicitly adds easing/duration to an existing transition.
- Do NOT touch dialog/alert-dialog animation classes (plan 004 owns them).
- Do NOT retune any token value in globals.css.
- If a cited class string has drifted, STOP and report.

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui lint && pnpm --filter web build` — green; the leftover-grep in step 4 returns nothing.
- **Feel check**: `localhost:3000/playbook`: open menu, popover, select, tooltip
  side by side — all four enter in 150ms and exit visibly faster (100ms); the
  switch thumb slides with a crisp ease-out rather than the default in-out;
  nothing else looks different at normal speed (this change is numerically
  identity-preserving).
- **Done when**: every duration in packages/ui routes through a `--duration-*`
  token, every transition has an explicit house easing, and the playbook feels
  unchanged.
