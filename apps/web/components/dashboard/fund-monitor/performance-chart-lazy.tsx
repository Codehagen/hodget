"use client"

import dynamic from "next/dynamic"

/**
 * Client wrapper for the lazy performance chart (plan 010). `ssr: false` is
 * only legal in a client component, and it's what keeps the recharts chunk
 * out of the route's initial scripts — the card itself stays a server
 * component and renders this tiny island instead.
 */
export const PerformanceChartLazy = dynamic(
  () => import("../equity-chart").then((m) => m.PerformanceChart),
  {
    ssr: false,
    loading: () => (
      <div aria-hidden className="h-56 w-full animate-pulse bg-muted/40" />
    ),
  }
)
