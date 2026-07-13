"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Active-filter pill. Warm gray via the `--secondary` token (flips in dark
 * mode). The remove ✕ is hidden until hover, then expands in with our easing.
 */
function FilterPill({
  label,
  onRemove,
  className,
}: {
  label: React.ReactNode
  onRemove?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "group/pill flex h-8 items-center gap-1 rounded-none bg-secondary px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <span className="flex w-0 scale-75 opacity-0 items-center overflow-hidden transition-[width,transform,opacity] duration-200 ease-out-quart pointer-coarse:w-3.5 pointer-coarse:scale-100 pointer-coarse:opacity-100 pointer-fine:group-hover/pill:w-3.5 pointer-fine:group-hover/pill:scale-100 pointer-fine:group-hover/pill:opacity-100">
        <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden>
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}

export { FilterPill }
