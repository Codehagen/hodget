"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Floating selected-rows action bar (tokenized + dependency-free).
 * Portals to <body>, slides up with our `slide-up-fade` motion, and renders only
 * when `count > 0`. Consumers pass action buttons as children (use
 * `BulkActionButton` for the dark-bar styling). No motion/zustand dependency —
 * selection state lives in the parent as controlled React state.
 */
function BulkActionBar({
  count,
  label,
  onDeselect,
  children,
}: {
  count: number
  label?: React.ReactNode
  onDeselect: () => void
  children?: React.ReactNode
}) {
  // Guard SSR (createPortal needs document); on the client, render nothing when
  // there's no selection so first render matches the server (null).
  if (typeof document === "undefined" || count <= 0) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="animate-slide-up-fade pointer-events-auto flex items-center gap-2 rounded-none bg-primary py-2 pr-2 pl-4 text-primary-foreground shadow-lg">
        <span className="text-sm font-medium whitespace-nowrap">
          {label ?? `${count} selected`}
        </span>
        <div className="ml-2 flex items-center gap-1.5">
          {children}
          <button
            type="button"
            onClick={onDeselect}
            className="rounded-none px-2.5 py-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Deselect
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function BulkActionButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-none border border-primary-foreground/20 px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { BulkActionBar, BulkActionButton }
