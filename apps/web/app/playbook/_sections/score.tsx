"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import {
  ScoreBadge,
  ScoreMeter,
  SignalBar,
} from "@workspace/ui/components/score-meter"

import { DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

const signals = [
  {
    key: "momentum",
    label: "Momentum",
    points: 22,
    max: 22,
    state: "12-month trend positive",
  },
  {
    key: "value",
    label: "Value",
    points: 17,
    max: 22,
    state: "P/E below sector median",
  },
  {
    key: "quality",
    label: "Quality",
    points: 6,
    max: 10,
    state: "ROIC 14%",
  },
]

export function ScoreSection() {
  return (
    <Section
      id="score"
      index="20"
      eyebrow="Components"
      title="Score"
      intro={
        <>
          Reusable score primitives for conviction and other scoring surfaces.
          Numbers use <code>font-mono tabular-nums</code>; colors draw only on the
          existing <code>--chart-*</code> tokens.
        </>
      }
    >
      <DemoGrid cols={2}>
        <DemoTile label="<ScoreMeter score={78} />">
          <div className="w-full max-w-sm">
            <ScoreMeter score={78} label="Conviction score" />
          </div>
        </DemoTile>

        <DemoTile label="<ScoreBadge /> — score band">
          <div className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={86} />
            <ScoreBadge score={54} />
            <ScoreBadge score={21} />
          </div>
        </DemoTile>

        <DemoTile label="<SignalBar /> — generic signal list">
          <div className="flex w-full max-w-sm flex-col gap-4">
            {signals.map((signal) => (
              <SignalBar
                key={signal.key}
                label={signal.label}
                points={signal.points}
                max={signal.max}
                state={signal.state}
              />
            ))}
          </div>
        </DemoTile>

        <DemoTile label="KpiTile pattern — Card + tabular numerals">
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <KpiTile label="Sharpe" value="2.14" sub="backtest" />
            <KpiTile label="Max DD" value="8.4%" sub="peak-to-trough" />
          </div>
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}

function KpiTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}
