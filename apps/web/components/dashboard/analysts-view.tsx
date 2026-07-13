import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { ScoreRing } from "@workspace/ui/components/score-meter"

import { ANALYSTS, type Analyst } from "./demo-data"
import { AnalystKindBadge, ConvictionBar, SectionHeader } from "./primitives"

const signalDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

function AnalystStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}

function AnalystCard({ analyst }: { analyst: Analyst }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <AnalystKindBadge kind={analyst.kind} />
              <span className="font-mono">{analyst.id}</span>
            </CardTitle>
            <CardDescription>{analyst.method}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <ScoreRing score={analyst.stats.hitRate} size={84} stroke={8}>
            <div className="flex flex-col items-center">
              <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
                {analyst.stats.hitRate}%
              </span>
              <span className="text-[10px] text-muted-foreground">hit rate</span>
            </div>
          </ScoreRing>
          <div className="flex flex-1 flex-col gap-3">
            <AnalystStat
              label="Signals emitted"
              value={analyst.stats.signalsEmitted.toLocaleString("en-US")}
            />
            <AnalystStat
              label="Avg conviction"
              value={`${analyst.stats.avgConviction}/100`}
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Recent signals
          </span>
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {analyst.recentSignals.map((signal) => (
              <div
                key={`${signal.security}-${signal.date}`}
                className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {signal.security}
                  </span>
                  <ConvictionBar value={signal.conviction} className="ml-auto" />
                  <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {signal.horizonDays}d
                  </span>
                </div>
                <p className="text-xs/relaxed text-muted-foreground">
                  {signal.thesis}
                </p>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {signalDate.format(new Date(signal.date))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AnalystsView() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Analysts"
        description="The roster that emits signals — quant models and LLM personas the committee weighs."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ANALYSTS.map((analyst) => (
          <AnalystCard key={analyst.id} analyst={analyst} />
        ))}
      </div>
    </div>
  )
}
