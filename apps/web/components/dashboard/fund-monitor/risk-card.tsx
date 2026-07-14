import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { RISK_LIMITS, RISK_STRESS, type RiskLimit } from "../demo-data"

const FILL_TONE: Record<RiskLimit["status"], string> = {
  ok: "bg-success",
  watch: "bg-warning",
  breach: "bg-destructive",
}
const CURRENT_TONE: Record<RiskLimit["status"], string> = {
  ok: "text-foreground",
  watch: "text-warning",
  breach: "text-destructive",
}

const ROW = "grid grid-cols-[6.5rem_2.75rem_1fr_2.75rem] items-center gap-2.5"

function LimitRow({ limit }: { limit: RiskLimit }) {
  return (
    <div className={ROW}>
      <span className="text-xs text-foreground">{limit.metric}</span>
      <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
        {limit.limitLabel}
      </span>
      <div className="h-1.5 w-full overflow-hidden bg-muted" aria-hidden>
        <span
          className={cn("block h-full", FILL_TONE[limit.status])}
          style={{ width: `${Math.min(100, limit.utilizationPct)}%` }}
        />
      </div>
      <span
        className={cn(
          "text-right font-mono text-xs font-medium tabular-nums",
          CURRENT_TONE[limit.status]
        )}
      >
        {limit.currentLabel}
      </span>
    </div>
  )
}

export function RiskCard({ basePath }: { basePath: string }) {
  return (
    <Card>
      <CardHeader className="px-3 pb-0">
        <CardTitle>Risk</CardTitle>
      </CardHeader>

      <div className="flex flex-col gap-2.5 px-3">
        <div className={cn(ROW, "text-[11px] text-muted-foreground")}>
          <span>Metric</span>
          <span className="text-right">Limit</span>
          <span />
          <span className="text-right">Current</span>
        </div>
        {RISK_LIMITS.map((limit) => (
          <LimitRow key={limit.metric} limit={limit} />
        ))}
      </div>

      <div className="mx-3 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">{RISK_STRESS.label}</span>
        <span className="font-mono font-medium text-destructive tabular-nums">
          {RISK_STRESS.value}
        </span>
      </div>

      <div className="flex justify-end px-3">
        <Link
          href={`${basePath}/strategies`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:underline"
        >
          View risk
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
        </Link>
      </div>
    </Card>
  )
}
