import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardContent } from "@workspace/ui/components/card"

import type { OverviewStat } from "./demo-data"

const DELTA_META = {
  up: { icon: ArrowUp01Icon, className: "text-chart-2" },
  down: { icon: ArrowDown01Icon, className: "text-chart-5" },
  flat: { icon: MinusSignIcon, className: "text-muted-foreground" },
} as const

/** A single KPI tile. Values render in tabular figures so a row of them stays
 * vertically aligned regardless of digit widths. */
export function StatCard({ stat }: { stat: OverviewStat }) {
  const delta = stat.delta ? DELTA_META[stat.delta.direction] : null

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {stat.label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
            {stat.value}
          </span>
          {stat.delta && delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums",
                delta.className
              )}
            >
              <HugeiconsIcon icon={delta.icon} size={12} strokeWidth={2} />
              {stat.delta.label}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{stat.hint}</span>
      </CardContent>
    </Card>
  )
}

export function OverviewStats({ stats }: { stats: OverviewStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </div>
  )
}
