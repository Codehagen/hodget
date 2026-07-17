import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { RealRunsSection } from "@/components/dashboard/runs/real-runs-section"
import { RunsView } from "@/components/dashboard/runs-view"

// Session-guarded by the /dashboard layout. The user's real runs load from the DAL
// at the top; the sample fixture history (shared with /demo) sits below it, clearly
// marked. New run here triggers the real engine (source="real"). RunsView owns its
// own padding (it also backs /demo) and reads URL filter state via nuqs, so it
// lives under a Suspense boundary; the real section matches its horizontal padding.
export default function DashboardRunsPage() {
  return (
    <>
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <Suspense fallback={<Skeleton className="h-40" />}>
          <RealRunsSection />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4 p-4 md:p-6">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-72" />
          </div>
        }
      >
        <RunsView basePath="/dashboard" source="real" />
      </Suspense>
    </>
  )
}
