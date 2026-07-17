import { Badge } from "@workspace/ui/components/badge"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { DEMO_DASHBOARD } from "@/components/dashboard/demo-data"

// The overview aggregates are still sample data; real runs live under
// /dashboard/runs (see plans/README.md direction options for wiring the
// overview). The requireSession guard stays in the layout, so this route is
// still auth-only.
export default function DashboardPage() {
  return (
    <DashboardView
      data={DEMO_DASHBOARD}
      basePath="/dashboard"
      source="real"
      notice={
        <Badge variant="neutral" className="font-normal">
          Sample overview · your real runs are under Runs
        </Badge>
      }
    />
  )
}
