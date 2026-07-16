"use client"

import { usePathname } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"

/**
 * Disclosure for the signed-in shell: most dashboard surfaces still render
 * deterministic fixtures, and fabricated fund data must never read as real.
 * Runs (and run detail) are backed by real engine runs, so the badge hides
 * there. Remove per-surface as tabs get wired to live data.
 */
export function SampleDataBadge() {
  const pathname = usePathname()

  if (pathname.startsWith("/dashboard/runs")) return null

  return (
    <Badge variant="amber" className="gap-1.5">
      Sample data — real runs live under Runs
    </Badge>
  )
}
