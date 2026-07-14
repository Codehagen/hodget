# 021 — Converge strategies-view rows onto the shared TableRow treatment

- **Status**: TODO
- **Commit**: 2526020
- **Severity**: LOW
- **Category**: Cohesion
- **Estimated scope**: 1 file (apps/web/components/dashboard/strategies-view.tsx), ~15 lines

## Problem

The dashboard has the same selectable-row pattern implemented twice. The runs
page rides the shared table primitive; the strategies registry hand-rolls a
`<tr role="button">` with its own transition, hover, selection, and
reduced-motion classes. Motion code implemented twice drifts: the bespoke row
already carries a `motion-reduce:transition-none` the shared row doesn't
(plan 020 removes it), uses `data-selected` where the shared idiom is
`data-state="selected"`, and any future change to row motion will miss one of
the two.

The bespoke implementation:

```tsx
// apps/web/components/dashboard/strategies-view.tsx:131-150 — current
<tr
  key={row.id}
  role="button"
  tabIndex={0}
  aria-pressed={selected}
  onClick={() => onSelect(row.id)}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(row.id)
    }
  }}
  data-selected={selected || undefined}
  className={cn(
    "cursor-pointer border-b border-border outline-none transition-colors duration-[var(--duration-instant)] last:border-b-0 motion-reduce:transition-none",
    "hover:bg-muted/60 focus-visible:bg-muted/60",
    selected &&
      "bg-primary/5 shadow-[inset_2px_0_0_0_var(--primary)] hover:bg-primary/5"
  )}
>
```

The shared treatment it should ride — the primitive:

```tsx
// packages/ui/src/components/table.tsx:58-70 — the shared TableRow
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group border-b border-border transition-colors duration-[var(--duration-instant)]",
        "hover:bg-muted/60 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}
```

…and the consumer pattern to imitate:

```tsx
// apps/web/components/dashboard/runs/run-history-table.tsx:83-96 — exemplar
<TableRow
  key={row.id}
  data-state={selected ? "selected" : undefined}
  role="button"
  tabIndex={0}
  aria-pressed={selected}
  onClick={() => onSelect(row.id)}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(row.id)
    }
  }}
  className="h-11 cursor-pointer outline-none focus-visible:bg-muted/60"
>
```

## Target

Replace the raw `<tr>` with the shared `TableRow` component. `TableRow`
renders a plain `<tr>`, so it drops into the existing hand-built
`<table>/<tbody>` without converting the rest of the table. The row keeps its
distinctive selected look (`bg-primary/5` + inset primary edge — richer than
TableRow's default `bg-muted`) as `data-[state=selected]:` overrides, the
house idiom for that (exemplar:
`apps/web/components/dashboard/run-detail/decision-log.tsx:119` overrides the
same default with `data-[state=selected]:bg-primary/5`).

```tsx
// apps/web/components/dashboard/strategies-view.tsx — target
<TableRow
  key={row.id}
  data-state={selected ? "selected" : undefined}
  role="button"
  tabIndex={0}
  aria-pressed={selected}
  onClick={() => onSelect(row.id)}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(row.id)
    }
  }}
  className="cursor-pointer outline-none last:border-b-0 focus-visible:bg-muted/60 data-[state=selected]:bg-primary/5 data-[state=selected]:shadow-[inset_2px_0_0_0_var(--primary)] data-[state=selected]:hover:bg-primary/5"
>
```

What this changes, exactly:

- The bespoke motion string (`transition-colors
  duration-[var(--duration-instant)] motion-reduce:transition-none`) and the
  base `border-b border-border hover:bg-muted/60` now come from `TableRow` —
  one source of truth for row motion.
- `data-selected` → `data-state="selected"`, matching the shared idiom, with
  the selected visuals expressed as `data-[state=selected]:` variants instead
  of a `selected && …` conditional string.
- `focus-visible:bg-muted/60` and `last:border-b-0` are preserved as consumer
  classes (TableRow doesn't provide them).
- Everything else on the row — the `<td>` children (lines 151-174), the
  surrounding `<table>`, `<thead>` (lines 106-126) — is untouched.

## Repo conventions to follow

- Shared row motion lives in `packages/ui/src/components/table.tsx:63`; app
  tables consume `TableRow` and override with `data-[state=selected]:`
  variants (`run-history-table.tsx:83-96`, `decision-log.tsx:119`).
- Color-only transitions carry no `motion-reduce:` variant (Design.md §11;
  plan 020's sweep).
- Import from the workspace package:
  `import { TableRow } from "@workspace/ui/components/table"` — add it to the
  existing `@workspace/ui/components/*` import block near the top of
  strategies-view.tsx (the file already imports Button, Input, Card,
  MasterDetail, Tabs from there).

## Steps

**Ordering: run this AFTER plan 020 has landed** (both rewrite the same
class string at `strategies-view.tsx:145`). If 020 has not landed, either
land it first or note in your report that this plan's rewrite also completes
020's step 2 for this file.

1. Add `import { TableRow } from "@workspace/ui/components/table"` to
   `apps/web/components/dashboard/strategies-view.tsx` alongside the other
   `@workspace/ui/components/*` imports (lines 20-37).
2. Replace the `<tr …>` opening tag at lines 131-150 with the `<TableRow …>`
   target above, and the matching `</tr>` at line 175 with `</TableRow>`.
3. Confirm the removed conditional (`const selected = row.id === selectedId`,
   line 129) is still needed — it is (used by `data-state` and
   `aria-pressed`); leave it.

## Boundaries

- Do NOT convert the rest of the table to `Table`/`TableHeader`/`TableCell`
  primitives — the registry's header styling is intentionally custom; scope
  is the row only.
- Do NOT change selection behavior, keyboard handling, or any `<td>` content.
- Do NOT edit `packages/ui/src/components/table.tsx`.
- Visual contract: at rest, hover, focus, and selected, the row must look
  identical to before (same tint values, same inset edge). If TableRow's
  classes produce a visible difference you cannot resolve with consumer
  overrides, STOP and report.
- If the row block has drifted from the excerpt (beyond plan 020's deletion
  of `motion-reduce:transition-none`), STOP and report.

## Verification

- **Mechanical**: `pnpm turbo typecheck` — green.
  `grep -n "transition-colors" apps/web/components/dashboard/strategies-view.tsx`
  → no hit on the registry row (motion now inherited from TableRow).
- **Feel check**: run `pnpm --filter web dev`, open `localhost:3000/demo`,
  go to Strategies:
  - Rows hover with the same 100ms muted tint as the Runs history table.
  - Click a row: it shows the primary-tinted background with the 2px inset
    primary left edge, exactly as before; the last row still has no bottom
    border.
  - Keyboard: Tab reaches rows, focus shows the muted tint, Enter/Space
    selects.
  - Side-by-side with the Runs table: hover timing and feel are
    indistinguishable.
- **Done when**: the registry row renders via `TableRow` with zero visual
  regression, its bespoke transition string is gone, and typecheck is green.
