import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card"

import {
  NEEDS_ATTENTION,
  NEEDS_ATTENTION_COUNTS,
  type NeedsAttentionItem,
  type NeedsAttentionSeverity,
} from "../demo-data"

const SEVERITY_META: Record<
  NeedsAttentionSeverity,
  { label: string; icon: typeof Alert02Icon; tone: string }
> = {
  act: { label: "Act now", icon: Alert02Icon, tone: "text-warning" },
  review: { label: "Review", icon: InformationCircleIcon, tone: "text-info" },
}

function AttentionRow({ item }: { item: NeedsAttentionItem }) {
  const meta = SEVERITY_META[item.severity]
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors duration-[var(--duration-instant)] hover:bg-muted/50 focus-visible:bg-muted/60"
    >
      <HugeiconsIcon
        icon={meta.icon}
        size={16}
        className={cn("mt-0.5 shrink-0", meta.tone)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{item.title}</p>
        <p className="text-[11px] text-muted-foreground">{item.detail}</p>
        {item.because ? (
          <p className="text-[11px] text-muted-foreground">{item.because}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[11px] text-muted-foreground">{item.region}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {item.time}
        </span>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={14}
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
    </button>
  )
}

function GroupHeading({
  severity,
  count,
}: {
  severity: NeedsAttentionSeverity
  count: number
}) {
  const meta = SEVERITY_META[severity]
  return (
    <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
      <HugeiconsIcon
        icon={meta.icon}
        size={14}
        className={cn("shrink-0", meta.tone)}
      />
      <span className={cn("text-xs font-semibold", meta.tone)}>
        {meta.label} ({count})
      </span>
    </div>
  )
}

/**
 * "Needs attention" — the exceptions worth a human's eyes, in plain language.
 * Two groups: amber "Act now" items (each a titled, two-line explanation) and
 * blue "Review" items, every row tagged with its region and time and opening to
 * detail. Rows are real <button>s (keyboard-accessible, 44px targets).
 */
export function AttentionPanel() {
  const act = NEEDS_ATTENTION.filter((i) => i.severity === "act")
  const review = NEEDS_ATTENTION.filter((i) => i.severity === "review")

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="px-4 pt-4 pb-1">
        <CardTitle>Needs attention</CardTitle>
      </CardHeader>

      <GroupHeading severity="act" count={NEEDS_ATTENTION_COUNTS.act} />
      <div className="flex flex-col">
        {act.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </div>

      <GroupHeading severity="review" count={NEEDS_ATTENTION_COUNTS.review} />
      <div className="flex flex-col pb-2">
        {review.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </div>
    </Card>
  )
}
