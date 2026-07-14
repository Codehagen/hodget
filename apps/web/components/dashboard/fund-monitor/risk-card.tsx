import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { FORWARD_RISK, type RiskScenario } from "../demo-data"
import { formatSignedPercent } from "../format"

const MAX_LOSS = Math.max(...FORWARD_RISK.scenarios.map((s) => Math.abs(s.loss)))

function ScenarioRow({ scenario }: { scenario: RiskScenario }) {
  const width = (Math.abs(scenario.loss) / MAX_LOSS) * 100
  return (
    <div className="grid grid-cols-[6.5rem_1fr_2.75rem] items-center gap-2">
      <span className="truncate text-xs text-foreground">{scenario.label}</span>
      <div className="h-2.5" aria-hidden>
        <span
          className="block h-full bg-destructive"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-right font-mono text-xs font-medium text-destructive tabular-nums">
        {formatSignedPercent(scenario.loss, 1)}
      </span>
    </div>
  )
}

/**
 * "Forward risk" — the fund's single largest exposure, how much of the risk
 * budget it uses (a green meter on a 0/50/100 axis), and the modelled loss under
 * stress scenarios (red bars). Static bars, semantic red only. `basePath` keeps
 * the "Explore risk" link correct on both /dashboard and /demo.
 */
export function RiskCard({ basePath }: { basePath: string }) {
  const { largestRisk, riskBudgetPct, riskBudgetLabel, scenarios } = FORWARD_RISK
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Forward risk</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Largest risk:{" "}
          <span className="font-medium text-foreground">{largestRisk}</span>
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Risk budget meter */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Risk budget</span>
            <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
              {riskBudgetLabel}
            </span>
            <div
              className="h-2 w-full overflow-hidden bg-muted"
              role="meter"
              aria-valuenow={riskBudgetPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Risk budget used"
            >
              <span
                className={cn("block h-full", "bg-success")}
                style={{ width: `${riskBudgetPct}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
              <span>0</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Scenario losses */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs text-muted-foreground">
              Scenario loss (current holdings)
            </span>
            {scenarios.map((s) => (
              <ScenarioRow key={s.label} scenario={s} />
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href={`${basePath}/strategies`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:underline"
          >
            Explore risk
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
