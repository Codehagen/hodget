import { cn } from "@workspace/ui/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // 1.5s, not the 2s default — a slightly quicker pulse reads as loading,
      // not idling.
      className={cn(
        "animate-pulse rounded-none bg-muted [animation-duration:1.5s]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
