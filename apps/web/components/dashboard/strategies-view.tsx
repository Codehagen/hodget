import { HugeiconsIcon } from "@hugeicons/react"
import { Location01Icon } from "@hugeicons/core-free-icons"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"

import {
  analystName,
  STRATEGIES_WITH_STATS,
  type StrategyWithStats,
} from "./demo-data"
import { SectionHeader, WeightBar } from "./primitives"
import { RunStatusBadge } from "./runs-table"

function StrategyCard({ strategy }: { strategy: StrategyWithStats }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="font-mono">{strategy.name}</CardTitle>
          <Badge variant="neutral" className="gap-1">
            <HugeiconsIcon icon={Location01Icon} size={11} />
            {strategy.universeLabel}
          </Badge>
        </div>
        <CardDescription>{strategy.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Committee lineup
          </span>
          <div className="flex flex-col gap-2">
            {strategy.lineup.map((entry) => (
              <WeightBar
                key={entry.analystId}
                label={analystName(entry.analystId)}
                weight={entry.weight}
              />
            ))}
          </div>
        </div>

        <Separator />

        <dl className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Runs</dt>
            <dd className="font-mono text-sm font-semibold text-foreground tabular-nums">
              {strategy.runCount}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Best Sharpe</dt>
            <dd className="font-mono text-sm font-semibold text-foreground tabular-nums">
              {strategy.bestSharpe != null
                ? strategy.bestSharpe.toFixed(2)
                : "—"}
            </dd>
          </div>
          <div className="flex flex-col items-start gap-1">
            <dt className="text-xs text-muted-foreground">Last run</dt>
            <dd>
              {strategy.lastRunStatus ? (
                <RunStatusBadge status={strategy.lastRunStatus} />
              ) : (
                <span className="font-mono text-sm text-muted-foreground">—</span>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

export function StrategiesView() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Strategies"
        description="Committee panels — each pairs an analyst lineup with a fixed universe."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STRATEGIES_WITH_STATS.map((strategy) => (
          <StrategyCard key={strategy.id} strategy={strategy} />
        ))}
      </div>
    </div>
  )
}
