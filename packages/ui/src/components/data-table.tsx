"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type TableOptions,
} from "@tanstack/react-table"

import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

// Re-exported so the ColumnMeta augmentation is loaded wherever DataTable is used.
export type { DataTableColumnMeta } from "@workspace/ui/components/data-table-types"

export type DataTableSort = { field: string; dir: "asc" | "desc" }

type DataTableProps<TData, TValue> = {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  getRowId: (row: TData) => string
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  enableRowSelection?: boolean
  /** Current sort; `undefined` = unsorted. Drives header arrows. */
  sort?: DataTableSort
  /** Called with the column's `meta.sortField` when a sortable header is clicked. */
  onSortChange?: (field: string) => void
  isLoading?: boolean
  skeletonRows?: number
  empty?: React.ReactNode
  onRowClick?: (row: TData) => void
  /** Passed through to `table.options.meta` for shared cell callbacks. */
  meta?: TableOptions<TData>["meta"]
  className?: string
}

/**
 * Generic, server-authoritative table. It uses ONLY
 * `getCoreRowModel()` — the parent owns sort/filter/paginate (here via nuqs +
 * TanStack Query). Selection is controlled; sorting is external (header buttons
 * call `onSortChange` with the column's `meta.sortField`).
 */
function DataTable<TData, TValue>({
  data,
  columns,
  getRowId,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection = true,
  sort,
  onSortChange,
  isLoading = false,
  skeletonRows = 6,
  empty,
  onRowClick,
  meta,
  className,
}: DataTableProps<TData, TValue>) {
  // TanStack Table returns non-memoizable functions; React Compiler skips
  // memoizing this component, which is expected and safe here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection,
    state: { rowSelection: rowSelection ?? {} },
    onRowSelectionChange,
    meta,
  })

  const rows = table.getRowModel().rows
  const leafColumns = table.getAllLeafColumns()

  return (
    <div className={cn("w-full", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const colMeta = header.column.columnDef.meta
                const sortField = colMeta?.sortField
                const sortable = Boolean(sortField && onSortChange)
                const isSorted = Boolean(sort && sortField === sort.field)

                return (
                  <TableHead
                    key={header.id}
                    className={cn(colMeta?.className, alignClass(colMeta?.align))}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange?.(sortField as string)}
                        className={cn(
                          "inline-flex items-center gap-1 font-mono text-xs tracking-wide uppercase transition-colors hover:text-foreground",
                          isSorted ? "text-foreground" : "text-muted-foreground",
                          colMeta?.align === "right" && "flex-row-reverse"
                        )}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <SortIcon
                          active={isSorted}
                          dir={isSorted ? sort?.dir : undefined}
                        />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <SkeletonRows columns={leafColumns} rows={skeletonRows} />
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={leafColumns.length} className="h-auto p-0">
                {empty ?? <DefaultEmpty />}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const colMeta = cell.column.columnDef.meta
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(colMeta?.className, alignClass(colMeta?.align))}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function alignClass(align?: "left" | "right" | "center") {
  return align === "right"
    ? "text-right"
    : align === "center"
      ? "text-center"
      : "text-left"
}

function SortIcon({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={cn("size-3.5 shrink-0", active ? "text-foreground" : "text-muted-foreground/40")}
    >
      {dir === "asc" ? (
        <path
          d="M8 12V4M5 7l3-3 3 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 4v8M5 9l3 3 3-3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

function SkeletonRows<TData>({
  columns,
  rows,
}: {
  columns: Column<TData, unknown>[]
  rows: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {columns.map((col) => {
            const skeleton = col.columnDef.meta?.skeleton
            const width = skeleton?.width ?? "60%"
            const variant = skeleton?.variant
            return (
              <TableCell key={col.id} className={col.columnDef.meta?.className}>
                {variant === "checkbox" ? (
                  <span className="block size-4 animate-pulse bg-muted" />
                ) : (
                  <span
                    className={cn(
                      "block h-3.5 animate-pulse bg-muted",
                      (variant === "pill" || variant === "badge") && "rounded-full"
                    )}
                    style={{ width }}
                  />
                )}
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}

function DefaultEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="font-heading text-base font-semibold text-foreground">
        Nothing here yet
      </p>
      <p className="text-sm text-muted-foreground">
        No rows match the current filters.
      </p>
    </div>
  )
}

export { DataTable }
