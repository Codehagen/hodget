import { cn } from "@workspace/ui/lib/utils"

function Timeline({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      role="list"
      data-slot="timeline"
      className={cn("flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  )
}

function TimelineItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="timeline-item"
      className={cn(
        "group/timeline-item relative flex w-full gap-3 pb-6 last:pb-0",
        className
      )}
      {...props}
    />
  )
}

function TimelineConnector({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="timeline-connector"
      className={cn(
        "absolute top-8 bottom-1 left-3.5 w-px border-l border-border group-last/timeline-item:hidden",
        className
      )}
      {...props}
    />
  )
}

function TimelineIcon({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-icon"
      className={cn(
        // Deliberate exception to rounded-none: circular media, like avatars.
        "relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

function TimelineContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5 pt-1", className)}
      {...props}
    />
  )
}

function TimelineTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-title"
      className={cn(
        "text-sm leading-5 text-foreground [&>strong]:font-medium",
        className
      )}
      {...props}
    />
  )
}

function TimelineDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="timeline-description"
      className={cn("text-xs/relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function TimelineTime({ className, ...props }: React.ComponentProps<"time">) {
  return (
    <time
      data-slot="timeline-time"
      className={cn("font-mono text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Timeline,
  TimelineItem,
  TimelineConnector,
  TimelineIcon,
  TimelineContent,
  TimelineTitle,
  TimelineDescription,
  TimelineTime,
}
