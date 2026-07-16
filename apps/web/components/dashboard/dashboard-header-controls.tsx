"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon, Refresh01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { LiveRunDialog } from "./live-run/live-run-dialog"

// Deterministic — the engine reports UTC, and a mocked timestamp must never vary
// between server and client render (keeps the /demo page prerenderable). The
// mock's 2026 clock is the mock's own; the fixtures keep the 2025-05-15 clock.
const AS_OF = "2025-05-15 14:32 UTC"

const PORTFOLIOS = [
  "Paper portfolio",
  "Live portfolio",
  "Backtest sandbox",
] as const

/**
 * The Fund-overview header's interactive island (plan 010): the portfolio
 * select, refresh, and the New run dialog. Split out so DashboardView itself
 * can be a server component — everything else on the page is static
 * presentation over fixtures.
 *
 * The portfolio select and the frozen "as of" timestamp belong to the mock
 * fixtures, so they render only for the simulated source; the signed-in
 * dashboard hides them until real portfolios exist.
 */
export function DashboardHeaderControls({
  basePath,
  source = "simulated",
}: {
  basePath: string
  source?: "simulated" | "real"
}) {
  const router = useRouter()
  const [portfolio, setPortfolio] = React.useState<string>(PORTFOLIOS[0])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {source === "simulated" ? (
        <>
          <Select
            value={portfolio}
            onValueChange={(next) => next && setPortfolio(next)}
          >
            <SelectTrigger aria-label="Select portfolio" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PORTFOLIOS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline">
            {AS_OF}
          </span>
        </>
      ) : null}
      <Button
        variant="outline"
        size="icon"
        aria-label="Refresh"
        onClick={() => router.refresh()}
      >
        <HugeiconsIcon icon={Refresh01Icon} size={16} />
      </Button>
      <LiveRunDialog
        basePath={basePath}
        source={source}
        trigger={
          <Button>
            <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} />
            New run
          </Button>
        }
      />
    </div>
  )
}
