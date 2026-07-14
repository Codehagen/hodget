import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons"

import { Card, CardTitle } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { RECENT_DECISIONS } from "../demo-data"
import { StatusPill } from "../primitives"

export function RecentDecisionsCard({ basePath }: { basePath: string }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
        <CardTitle>Recent decisions</CardTitle>
        <Link
          href={`${basePath}/runs`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-[var(--duration-instant)] hover:underline"
        >
          View decision log
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} />
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Time (UTC)</TableHead>
            <TableHead>Security</TableHead>
            <TableHead>Committee view</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead>Gate</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="w-8" aria-label="Open" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {RECENT_DECISIONS.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                {d.time}
              </TableCell>
              <TableCell className="font-mono text-xs font-medium text-foreground">
                {d.security}
              </TableCell>
              <TableCell className="max-w-[18rem] truncate text-xs text-foreground">
                {d.committeeView}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-foreground tabular-nums">
                {d.target}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {d.gate}
              </TableCell>
              <TableCell>
                <StatusPill status={d.result} />
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                {d.note}
              </TableCell>
              <TableCell className="text-right">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={14}
                  className="inline text-muted-foreground"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
