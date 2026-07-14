import type { ReactNode } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"

import { ENGINE_OPS } from "../demo-data"

function OpRow({
  label,
  value,
  tone,
}: {
  label: string
  value: ReactNode
  tone?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("font-mono font-medium tabular-nums text-foreground", tone)}
      >
        {value}
      </span>
    </div>
  )
}

export function EngineOpsCard({ basePath }: { basePath: string }) {
  const { lastCycle, running, queued, failed, activeRun } = ENGINE_OPS
  return (
    <Card>
      <CardHeader className="px-3 pb-0">
        <CardTitle>Engine operations</CardTitle>
      </CardHeader>

      <div className="flex flex-col gap-2 px-3">
        <OpRow label="Last cycle" value={lastCycle} />
        <OpRow label="Running" value={running} tone="text-info" />
        <OpRow label="Queued" value={queued} />
        <OpRow
          label="Failed"
          value={failed}
          tone={failed > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border px-3 pt-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-mono text-foreground">
            {activeRun.id} · {activeRun.stage}
          </span>
          <span className="font-mono font-medium text-foreground tabular-nums">
            {activeRun.progressPct}%
          </span>
        </div>
        <Progress value={activeRun.progressPct} aria-label="Active run progress" />
      </div>

      <div className="flex justify-end px-3">
        <Link
          href={`${basePath}/runs`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:underline"
        >
          Open runs
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
        </Link>
      </div>
    </Card>
  )
}
