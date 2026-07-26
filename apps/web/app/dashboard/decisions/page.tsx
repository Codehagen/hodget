import { Suspense } from "react"

import { DecisionsView } from "@/components/dashboard/decision-map/decisions-view"

// Session-guarded by the /dashboard layout; sample fixtures for now.
// DecisionsView reads the selected decision from the URL (`?d=`) via nuqs, so it
// lives under a Suspense boundary.
export default function DashboardDecisionsPage() {
  return (
    <Suspense>
      <DecisionsView />
    </Suspense>
  )
}
