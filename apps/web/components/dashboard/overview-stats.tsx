import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { StatBar, StatItem } from "@workspace/ui/components/stat"

import { FUND_STATUS } from "./demo-data"

/**
 * Status strip — the full-width "how is the fund doing?" summary that tops the
 * Fund overview. A single hairline-ringed {@link StatBar}: a wide status cell (a
 * green/amber badge + plain-language headline and one-line detail) followed by
 * NAV, Today, and Risk-budget figures. Purely presentational; every value comes
 * from the deterministic `FUND_STATUS` fixture.
 */

const TONE: Record<
  (typeof FUND_STATUS)["tone"],
  { icon: typeof Tick02Icon; badge: string }
> = {
  normal: { icon: Tick02Icon, badge: "bg-success text-success-foreground" },
  attention: { icon: Alert02Icon, badge: "bg-warning text-warning-foreground" },
  critical: {
    icon: Alert02Icon,
    badge: "bg-destructive text-destructive-foreground",
  },
}

export function StatusStrip({ status = FUND_STATUS }: { status?: typeof FUND_STATUS }) {
  const tone = TONE[status.tone]
  return (
    <StatBar>
      {/* Status cell — wider, custom content (no numeric value). */}
      <div className="flex min-w-[18rem] flex-[2.4] items-center gap-3 px-4 py-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            tone.badge
          )}
        >
          <HugeiconsIcon icon={tone.icon} size={20} strokeWidth={2.5} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {status.headline}
          </span>
          <span className="text-xs text-muted-foreground">{status.detail}</span>
        </span>
      </div>

      <StatItem label="NAV" value={status.nav} size="sm" />
      <StatItem
        label="Today"
        value={status.today.value}
        delta={{ label: status.today.change, direction: status.today.direction }}
        valueClassName="text-success"
        size="sm"
      />
      <StatItem label="Risk budget" value={status.riskBudget} size="sm" />
    </StatBar>
  )
}
