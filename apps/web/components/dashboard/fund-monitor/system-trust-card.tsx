import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { SYSTEM_TRUST, type SystemTrustStat } from "../demo-data"

function TrustCell({ stat }: { stat: SystemTrustStat }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{stat.label}</span>
      {stat.check ? (
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={22}
          className="text-success"
          aria-label="Enabled"
        />
      ) : (
        <span className="font-mono text-xl font-semibold text-foreground tabular-nums">
          {stat.value}
        </span>
      )}
    </div>
  )
}

/**
 * "System trust" — the four operational-integrity readouts that back every
 * decision on the page: how current the data is, how many advisors are healthy,
 * how reliably model outputs parse, and whether replay is enabled. Purely
 * presentational over the deterministic `SYSTEM_TRUST` fixture.
 */
export function SystemTrustCard() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <CardTitle>System trust</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {SYSTEM_TRUST.map((stat) => (
          <TrustCell key={stat.label} stat={stat} />
        ))}
      </CardContent>
    </Card>
  )
}
