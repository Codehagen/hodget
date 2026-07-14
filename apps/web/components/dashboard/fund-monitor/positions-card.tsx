"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Card, CardTitle } from "@workspace/ui/components/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  POSITIONS,
  POSITIONS_TOTALS,
  type Position,
  type PositionSide,
  type StrategyTag,
} from "../demo-data"
import {
  formatBps,
  formatCurrencyCompact,
  formatSignedCurrencyCompact,
  pnlToneClass,
} from "../format"
import { ConvictionBar, StatusPill } from "../primitives"

/* Local, view-only enrichment: a sector per security, so the "Sectors" tab has
 * something real to aggregate without touching the shared fixtures. */
const SECTOR_BY_SECURITY: Record<string, string> = {
  NVDA: "Semiconductors",
  AAPL: "Tech hardware",
  EQNR: "Energy",
  DNB: "Financials",
  MSFT: "Software",
  CASH: "Cash",
}

const SIDE_LABEL: Record<PositionSide, string> = {
  long: "Long",
  short: "Short",
  cash: "Cash",
}
const SIDE_TONE: Record<PositionSide, string> = {
  long: "text-foreground",
  short: "text-destructive",
  cash: "text-muted-foreground",
}

const STRATEGY_LABEL: Record<StrategyTag, string> = {
  fundamental: "Fundamental",
  quant: "Quant",
  macro: "Macro",
  event: "Event",
}

const NUM = "text-right font-mono tabular-nums"

/* ---- Positions tab (the full dense book) ---------------------------------- */

function PositionRow({ p }: { p: Position }) {
  return (
    <TableRow>
      <TableCell className="font-mono font-medium text-foreground">
        {p.security}
      </TableCell>
      <TableCell>
        {p.strategyTag ? (
          <StatusPill status={p.strategyTag} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn("text-xs font-medium", SIDE_TONE[p.side])}>
        {SIDE_LABEL[p.side]}
      </TableCell>
      <TableCell className={cn(NUM, "text-foreground")}>
        {p.marketValueLabel}
      </TableCell>
      <TableCell className={cn(NUM, "text-foreground")}>{p.weightPct}%</TableCell>
      <TableCell className={cn(NUM, pnlToneClass(p.dayPnl), "font-medium")}>
        {p.dayPnlLabel}
      </TableCell>
      <TableCell
        className={cn(NUM, pnlToneClass(p.contributionBp), "font-medium")}
      >
        {formatBps(p.contributionBp)}
      </TableCell>
      <TableCell>
        {p.conviction == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">−</span>
            <ConvictionBar value={p.conviction} showValue={false} />
            <span className="text-[11px] text-muted-foreground">+</span>
          </div>
        )}
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

function PositionsTable() {
  return (
    <div className="flex flex-col">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Security</TableHead>
            <TableHead>Strategy</TableHead>
            <TableHead>Position</TableHead>
            <TableHead className="text-right">Position (MV)</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead className="text-right">Day P&amp;L</TableHead>
            <TableHead className="text-right">Contribution</TableHead>
            <TableHead>Conviction</TableHead>
            <TableHead className="text-center">Risk flag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {POSITIONS.map((p) => (
            <PositionRow key={p.security} p={p} />
          ))}
        </TableBody>
      </Table>
      <TotalsRow />
    </div>
  )
}

function TotalsRow() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 border-t border-border px-3 py-3 text-xs">
      <TotalStat label="Gross" value={POSITIONS_TOTALS.gross} />
      <TotalStat label="Net" value={POSITIONS_TOTALS.net} />
      <TotalStat
        label="Day P&L"
        value={POSITIONS_TOTALS.dayPnl}
        className="text-success"
      />
    </div>
  )
}

function TotalStat({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono font-medium tabular-nums text-foreground",
          className
        )}
      >
        {value}
      </span>
    </span>
  )
}

/* ---- Strategies / Sectors tabs (aggregated) ------------------------------- */

type Group = {
  key: string
  label: React.ReactNode
  marketValue: number
  weightPct: number
  dayPnl: number
  contributionBp: number
}

function aggregate(
  groupOf: (p: Position) => { key: string; label: React.ReactNode }
): Group[] {
  const map = new Map<string, Group>()
  for (const p of POSITIONS) {
    const { key, label } = groupOf(p)
    const g =
      map.get(key) ??
      ({
        key,
        label,
        marketValue: 0,
        weightPct: 0,
        dayPnl: 0,
        contributionBp: 0,
      } satisfies Group)
    g.marketValue += p.marketValue
    g.weightPct += p.weightPct
    g.dayPnl += p.dayPnl
    g.contributionBp += p.contributionBp
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) => b.contributionBp - a.contributionBp)
}

function GroupTable({ groups }: { groups: Group[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Group</TableHead>
          <TableHead className="text-right">Net MV</TableHead>
          <TableHead className="text-right">Weight</TableHead>
          <TableHead className="text-right">Day P&amp;L</TableHead>
          <TableHead className="text-right">Contribution</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => (
          <TableRow key={g.key}>
            <TableCell className="font-medium text-foreground">
              {g.label}
            </TableCell>
            <TableCell className={cn(NUM, "text-foreground")}>
              {g.marketValue < 0
                ? formatSignedCurrencyCompact(g.marketValue)
                : formatCurrencyCompact(g.marketValue)}
            </TableCell>
            <TableCell className={cn(NUM, "text-foreground")}>
              {g.weightPct.toFixed(1)}%
            </TableCell>
            <TableCell className={cn(NUM, pnlToneClass(g.dayPnl), "font-medium")}>
              {formatSignedCurrencyCompact(g.dayPnl)}
            </TableCell>
            <TableCell
              className={cn(NUM, pnlToneClass(g.contributionBp), "font-medium")}
            >
              {formatBps(g.contributionBp)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const STRATEGY_GROUPS = aggregate((p) => ({
  key: p.strategyTag ?? "cash",
  label: p.strategyTag ? STRATEGY_LABEL[p.strategyTag] : "Cash",
}))
const SECTOR_GROUPS = aggregate((p) => {
  const sector = SECTOR_BY_SECURITY[p.security] ?? "Other"
  return { key: sector, label: sector }
})

/* ---- Card ----------------------------------------------------------------- */

export function PositionsCard() {
  return (
    <Card className="gap-0 py-0">
      <Tabs defaultValue="positions" className="gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-3 pb-3">
          <CardTitle>Positions &amp; contribution</CardTitle>
          <TabsList variant="line">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="sectors">Sectors</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="positions">
          <PositionsTable />
        </TabsContent>
        <TabsContent value="strategies">
          <GroupTable groups={STRATEGY_GROUPS} />
        </TabsContent>
        <TabsContent value="sectors">
          <GroupTable groups={SECTOR_GROUPS} />
        </TabsContent>
      </Tabs>
    </Card>
  )
}
