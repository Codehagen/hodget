import { Suspense } from "react"

import { RunsView } from "@/components/dashboard/runs-view"

// Session-guarded by the /dashboard layout; sample fixtures for now. RunsView
// reads URL filter state via nuqs, so it lives under a Suspense boundary.
export default function DashboardRunsPage() {
  return (
    <Suspense>
      <RunsView basePath="/dashboard" />
    </Suspense>
  )
}
