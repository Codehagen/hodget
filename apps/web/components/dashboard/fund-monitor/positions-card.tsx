import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  PORTFOLIO_POSITIONS,
  PORTFOLIO_SUMMARY,
  type PortfolioPosition,
  type PortfolioView,
} from "../demo-data"
import { formatBps, pnlToneClass } from "../format"
import { SegmentBar } from "../primitives"

const NUM = "text-right font-mono tabular-nums"

// Current-view label → segmented-bar shape (tone + lit segments over 3).
const VIEW_BAR: Record<
  PortfolioView,
  { tone: "success" | "warning" | "muted"; filled: number }
> = {
  "strong-positive": { tone: "success", filled: 3 },
  positive: { tone: "success", filled: 2 },
  mixed: { tone: "warning", filled: 1 },
  neutral: { tone: "muted", filled: 0 },
}

function PositionRow({ p }: { p: PortfolioPosition }) {
  const view = VIEW_BAR[p.view]
  return (
    <TableRow>
      <TableCell className="font-mono font-medium text-foreground">
        {p.security}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {p.whyHeld}
      </TableCell>
      <TableCell className={cn(NUM, "text-foreground")}>
        <span className="inline-flex items-center justify-end gap-1.5">
          {p.short ? (
            <span className="font-sans text-[10px] font-medium tracking-wide text-destructive uppercase">
              short
            </span>
          ) : null}
          {p.weightPct}%
        </span>
      </TableCell>
      <TableCell className={cn(NUM, pnlToneClass(p.dayPnl), "font-medium")}>
        {p.dayPnlLabel}
      </TableCell>
      <TableCell
        className={cn(NUM, pnlToneClass(p.contributionBp), "font-medium")}
      >
        {formatBps(p.contributionBp)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="w-24 text-xs text-foreground">{p.viewLabel}</span>
          <SegmentBar filled={view.filled} total={3} tone={view.tone} />
        </div>
      </TableCell>
      <TableCell className="text-center">
        {p.riskFlag ? (
          <HugeiconsIcon
            icon={Alert02Icon}
            size={15}
            className="inline text-warning"
            aria-label="Risk flag"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

/**
 * "Portfolio now" — the book in plain language: what the fund holds, why it
 * holds it, today's P&L and contribution, the current view (a labelled
 * 3-segment strength bar), and a risk flag. Purely presentational over the
 * deterministic `PORTFOLIO_POSITIONS` fixture.
 */
export function PositionsCard() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle>Portfolio now</CardTitle>
        <CardDescription className="font-mono tabular-nums">
          {PORTFOLIO_SUMMARY.positions} positions · {PORTFOLIO_SUMMARY.gross}{" "}
          gross · {PORTFOLIO_SUMMARY.net} net
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Security</TableHead>
              <TableHead>Why held</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Today</TableHead>
              <TableHead className="text-right">Contribution</TableHead>
              <TableHead>Current view</TableHead>
              <TableHead className="pr-4 text-center">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PORTFOLIO_POSITIONS.map((p) => (
              <PositionRow key={p.security} p={p} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
