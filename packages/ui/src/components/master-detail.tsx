import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Master–detail shell used by Runs, Strategies, and Analysts: a scrolling
 * list/table on the left and a bordered inspector panel on the right. Below the
 * `lg` breakpoint the two stack.
 *
 * Deliberately just layout — the grid template is the one thing pages differ on
 * (a narrow right inspector on Runs vs. a narrow left registry on Strategies),
 * so override it through `className` (e.g. `lg:grid-cols-[1fr_340px]`). The
 * default is an even split.
 */
function MasterDetail({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="master-detail"
      className={cn(
        "grid grid-cols-1 items-start gap-4 lg:grid-cols-2",
        className
      )}
      {...props}
    />
  )
}

/** Left column — the list/table region. Transparent wrapper by default. */
function MasterDetailList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="master-detail-list"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

/**
 * Right column — the inspector. Hairline-ringed card that sticks below a header
 * on large screens so it stays in view while the list scrolls. `sticky` is
 * opt-out via `className` for pages that don't want it.
 */
function MasterDetailPanel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="master-detail-panel"
      className={cn(
        "min-w-0 rounded-none bg-card p-4 text-card-foreground ring-1 ring-foreground/10 lg:sticky lg:top-4",
        className
      )}
      {...props}
    />
  )
}

export { MasterDetail, MasterDetailList, MasterDetailPanel }
