import { Suspense } from "react"

import { ALL_RUNS } from "@/components/dashboard/demo-data"
import { RunsView } from "@/components/dashboard/runs-view"

// Public demo — fixtures only, so it prerenders statically. RunsView reads URL
// filter state via nuqs, so it lives under a Suspense boundary.
export default function DemoRunsPage() {
  return (
    <Suspense>
      <RunsView basePath="/demo" runs={ALL_RUNS} />
    </Suspense>
  )
}
