import { Suspense } from "react"

import { RunsView } from "@/components/dashboard/runs-view"

// Public demo — fixtures only, so it prerenders statically. RunsView reads URL
// filter state via nuqs, so it lives under a Suspense boundary.
export default function DemoRunsPage() {
  return (
    <Suspense>
      <RunsView basePath="/demo" />
    </Suspense>
  )
}
