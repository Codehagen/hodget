import type { RowData } from "@tanstack/react-table"

/**
 * Cross-cutting per-column config, attached via `column.meta`. Read by the
 * generic DataTable's header/body/skeleton. Trimmed to what our
 * (non-virtualized, non-reorderable) table needs.
 *
 * Lives as `.tsx` so the `@workspace/ui/components/*` export alias resolves it.
 */
export type DataTableColumnMeta = {
  /** Server sort field; its presence makes the header a sort button. */
  sortField?: string
  /** Horizontal alignment for this column's header + cells. */
  align?: "left" | "right" | "center"
  /** Extra classes applied to both the header cell and every body cell. */
  className?: string
  /** Loading-skeleton hint for this column. */
  skeleton?: { variant?: "text" | "badge" | "pill" | "checkbox"; width?: string }
}

declare module "@tanstack/react-table" {
  // Declaration merge so `column.meta` is typed everywhere. The generic
  // signature must match the base declaration; the params are unused here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface ColumnMeta<TData extends RowData, TValue>
    extends DataTableColumnMeta {}
}
