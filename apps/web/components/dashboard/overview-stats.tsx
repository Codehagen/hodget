import { StatBar, StatItem } from "@workspace/ui/components/stat"

import { FUND_KPIS, type Kpi, type ValueTone } from "./demo-data"

/**
 * The Fund-monitor KPI strip: NAV, Day P&L, YTD, Gross, Net, Cash, Drawdown in a
 * single hairline-ringed StatBar. Values are preformatted upstream and render in
 * mono tabular figures; a semantic tone tints only the P&L-style cells (green up,
 * red down) so the neutral exposure figures stay foreground.
 */
const TONE_CLASS: Record<ValueTone, string | undefined> = {
  positive: "text-success",
  negative: "text-destructive",
  muted: "text-muted-foreground",
  neutral: undefined,
}

export function OverviewStats({ kpis = FUND_KPIS }: { kpis?: Kpi[] }) {
  return (
    <StatBar>
      {kpis.map((kpi) => (
        <StatItem
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          delta={kpi.delta}
          valueClassName={kpi.tone ? TONE_CLASS[kpi.tone] : undefined}
        />
      ))}
    </StatBar>
  )
}
