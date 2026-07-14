import { Suspense } from "react"

import { DecisionsView } from "@/components/dashboard/decision-map/decisions-view"

// Public demo — fixtures only, so it prerenders statically. DecisionsView reads
// the selected decision from the URL (`?d=`) via nuqs, so it lives under a
// Suspense boundary.
export default function DemoDecisionsPage() {
  return (
    <Suspense>
      <DecisionsView basePath="/demo" />
    </Suspense>
  )
}
