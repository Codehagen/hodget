import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { listRuns, type EngineRun } from "@/lib/dal"

import { StatusPill } from "../primitives"

/**
 * The signed-in user's real engine runs (plan: real runs on /dashboard). A server
 * component that reads them through the DAL (session-scoped) and links each to its
 * DB-backed detail page — distinct from, and above, the sample fixture history the
 * demo shares. Honest labelling: these are "your runs"; the table below them is
 * clearly marked sample data.
 *
 * Defensive by design: the engine DB may be unreachable in some environments, and
 * a real runs panel should never take down the whole (otherwise fixture-backed)
 * page — so a load failure degrades to a quiet notice.
 */
export async function RealRunsSection() {
  let runs: EngineRun[] | null = null
  try {
    runs = await listRuns()
  } catch {
    runs = null
  }

  return (
    <Card className="gap-0">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Your runs</CardTitle>
          <CardDescription>
            Runs you have triggered on the real engine.
          </CardDescription>
        </div>
        <Badge variant="green" className="font-normal">
          Live data
        </Badge>
      </CardHeader>
      <CardContent className="px-0">
        {runs === null ? (
          <div className="px-4 pb-4">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Runs unavailable</EmptyTitle>
                <EmptyDescription>
                  Your runs could not be loaded right now. The sample history below
                  is unaffected.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : runs.length === 0 ? (
          <div className="px-4 pb-4">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No runs yet</EmptyTitle>
                <EmptyDescription>
                  Start one with New run — it executes the real engine backtest and
                  appears here when it completes.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <RealRunsTable runs={runs} />
        )}
      </CardContent>
    </Card>
  )
}

const HEAD =
  "h-9 font-sans text-xs font-medium tracking-normal normal-case text-muted-foreground"

/** ISO-8601 → "YYYY-MM-DD HH:MM UTC". */
function formatUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

function RealRunsTable({ runs }: { runs: EngineRun[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD} pl-4`}>Run</TableHead>
          <TableHead className={HEAD}>Mode</TableHead>
          <TableHead className={HEAD}>Status</TableHead>
          <TableHead className={`${HEAD} pr-4 text-right`}>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id} className="hover:bg-muted/40">
            <TableCell className="py-2.5 pl-4">
              <Link
                href={`/dashboard/runs/${run.id}`}
                className="font-mono text-xs text-foreground underline-offset-4 hover:underline"
              >
                {run.id}
              </Link>
            </TableCell>
            <TableCell className="py-2.5">
              <StatusPill status={run.mode} />
            </TableCell>
            <TableCell className="py-2.5">
              <StatusPill status={run.status} />
            </TableCell>
            <TableCell className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground tabular-nums">
              {formatUtc(run.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
