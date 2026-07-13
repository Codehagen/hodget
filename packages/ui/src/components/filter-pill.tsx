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
      {/* The remove icon reserves its 14px so the reveal is transform-only —
          animating width from zero would relayout the label on every hover. */}
      <span className="flex w-3.5 origin-left scale-x-0 items-center justify-center overflow-hidden opacity-0 transition-[transform,opacity] duration-[var(--duration-base)] ease-out-quart pointer-coarse:scale-x-100 pointer-coarse:opacity-100 pointer-fine:group-hover/pill:scale-x-100 pointer-fine:group-hover/pill:opacity-100">
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
