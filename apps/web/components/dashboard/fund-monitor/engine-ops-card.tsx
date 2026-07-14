import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { DECISION_FUNNEL, type FunnelStep } from "../demo-data"

function StepBox({ step }: { step: FunnelStep }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 border border-border bg-card px-1.5 py-2 text-center">
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
        {step.value}
      </span>
      <span className="text-[10px]/tight text-muted-foreground text-balance">
        {step.label}
      </span>
    </div>
  )
}

/**
 * "Why the system acted" — the decision funnel from raw analyst views down to
 * executed trades, as boxed stats joined by arrows. A static explanatory
 * diagram (no motion — it's read, not interacted with). `basePath` keeps the
 * "Open Decisions" link correct on /dashboard and /demo.
 */
export function EngineOpsCard({ basePath }: { basePath: string }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Why the system acted</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-stretch gap-1">
          {DECISION_FUNNEL.map((step, i) => (
            <React.Fragment key={step.label}>
              <StepBox step={step} />
              {i < DECISION_FUNNEL.length - 1 ? (
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={12}
                  className="shrink-0 self-center text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>

        <div className="flex justify-end">
          <Link
            href={`${basePath}/decisions`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:underline"
          >
            Open Decisions
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
