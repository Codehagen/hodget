import { Suspense } from "react"

import { ALL_RUNS } from "@/components/dashboard/demo-data"
import { RunsView } from "@/components/dashboard/runs-view"

// Session-guarded by the /dashboard layout; sample fixtures for now. RunsView
// reads URL filter state via nuqs, so it lives under a Suspense boundary.
export default function DashboardRunsPage() {
  return (
    <Suspense>
      <RunsView basePath="/dashboard" runs={ALL_RUNS} />
    </Suspense>
  )
}
