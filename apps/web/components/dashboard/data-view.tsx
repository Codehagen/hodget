import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building06Icon,
  Coins01Icon,
  GlobeIcon,
  ServerStack01Icon,
} from "@hugeicons/core-free-icons"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  CORPORATE_ACTIONS,
  COVERAGE,
  PIT_POLICY,
  PROVIDERS,
  type Provider,
} from "./demo-data"
import { CoverageBadge, SectionHeader } from "./primitives"

const exDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

function ProviderCard({ provider }: { provider: Provider }) {
  const usEquities = provider.role === "US equities"
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={usEquities ? Building06Icon : GlobeIcon}
              size={16}
              className="text-muted-foreground"
            />
            {provider.name}
          </CardTitle>
          <Badge variant="neutral">{provider.role}</Badge>
        </div>
        <CardDescription>{provider.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Routed MICs</span>
          <div className="flex flex-wrap gap-1.5">
            {provider.mics.map((mic) => (
              <Badge key={mic} variant="secondary" className="font-mono">
                {mic}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Datasets</span>
          <div className="flex flex-wrap gap-1.5">
            {provider.datasets.map((dataset) => (
              <Badge key={dataset} variant="outline">
                {dataset}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DataView() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Data"
        description="Market data providers, routed by MIC, under a strict point-in-time policy."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {PROVIDERS.map((provider) => (
          <ProviderCard key={provider.name} provider={provider} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={ServerStack01Icon}
              size={16}
              className="text-muted-foreground"
            />
            Point-in-time policy
          </CardTitle>
          <CardDescription>
            What a run can see is governed by when the data became knowable — no
            lookahead, ever.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PIT_POLICY.map((point) => (
              <div
                key={point.title}
                className="flex flex-col gap-1.5 border border-border bg-muted/30 p-3"
              >
                <span className="font-mono text-sm font-medium text-foreground">
                  {point.title}
                </span>
                <p className="text-xs/relaxed text-muted-foreground">
                  {point.body}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage</CardTitle>
          <CardDescription>
            Per-security coverage state across prices, fundamentals, and
            estimates. Fail-loud: a missing dataset reads as not-covered, never
            as zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>MIC</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Prices</TableHead>
                  <TableHead>Fundamentals</TableHead>
                  <TableHead>Estimates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COVERAGE.map((row) => (
                  <TableRow key={row.ticker}>
                    <TableCell className="font-mono text-sm font-medium text-foreground">
                      {row.ticker}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.mic}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.provider}
                    </TableCell>
                    <TableCell>
                      <CoverageBadge state={row.prices} />
                    </TableCell>
                    <TableCell>
                      <CoverageBadge state={row.fundamentals} />
                    </TableCell>
                    <TableCell>
                      <CoverageBadge state={row.estimates} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Coins01Icon}
              size={16}
              className="text-muted-foreground"
            />
            Corporate actions
          </CardTitle>
          <CardDescription>
            Splits and dividends adjust prices at the ex-date, point-in-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {CORPORATE_ACTIONS.map((action) => (
              <div
                key={`${action.ticker}-${action.exDate}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="w-20 shrink-0 font-mono text-sm font-medium text-foreground">
                  {action.ticker}
                </span>
                <Badge variant={action.type === "split" ? "sky" : "green"}>
                  {action.type === "split" ? "Split" : "Dividend"}
                </Badge>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {action.detail}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  ex {exDate.format(new Date(action.exDate))}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
