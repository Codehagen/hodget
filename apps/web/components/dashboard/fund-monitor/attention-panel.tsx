import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card"

import {
  ATTENTION_COUNTS,
  ATTENTION_ITEMS,
  type AttentionItem,
  type AttentionSeverity,
} from "../demo-data"

const SEVERITY_META: Record<
  AttentionSeverity,
  { label: string; icon: typeof Alert02Icon; tone: string }
> = {
  action: { label: "Action required", icon: Alert02Icon, tone: "text-warning" },
  review: { label: "Review", icon: InformationCircleIcon, tone: "text-info" },
  healthy: {
    label: "Healthy",
    icon: CheckmarkCircle02Icon,
    tone: "text-muted-foreground",
  },
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const meta = SEVERITY_META[item.severity]
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 motion-reduce:transition-none"
    >
      <HugeiconsIcon
        icon={meta.icon}
        size={16}
        className={cn("mt-0.5 shrink-0 self-start", meta.tone)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {item.title}
        </p>
        {item.subtitle ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {item.subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-[11px] text-muted-foreground">{item.scope}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {item.time}
        </span>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={14}
        className="shrink-0 text-muted-foreground"
      />
    </button>
  )
}

function GroupHeading({
  severity,
  count,
}: {
  severity: AttentionSeverity
  count: number
}) {
  const meta = SEVERITY_META[severity]
  return (
    <div className="px-3 pt-3 pb-1">
      <span className={cn("text-xs font-semibold", meta.tone)}>
        {meta.label} ({count})
      </span>
    </div>
  )
}

export function AttentionPanel() {
  const action = ATTENTION_ITEMS.filter((i) => i.severity === "action")
  const review = ATTENTION_ITEMS.filter((i) => i.severity === "review")
  const total = ATTENTION_ITEMS.length

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-3 pt-3 pb-2">
        <CardTitle>Attention</CardTitle>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {total} items
        </span>
      </CardHeader>

      <GroupHeading severity="action" count={ATTENTION_COUNTS.action} />
      <div className="flex flex-col">
        {action.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </div>

      <GroupHeading severity="review" count={ATTENTION_COUNTS.review} />
      <div className="flex flex-col">
        {review.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </div>

      <button
        type="button"
        className="flex min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 motion-reduce:transition-none"
      >
        <span className="flex items-center gap-2">
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          <span className="text-xs font-semibold text-muted-foreground">
            Healthy ({ATTENTION_COUNTS.healthy})
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          className="shrink-0 text-muted-foreground"
        />
      </button>
    </Card>
  )
}
