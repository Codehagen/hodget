import { Badge } from "@workspace/ui/components/badge"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { DEMO_DASHBOARD } from "@/components/dashboard/demo-data"

// Sample data for now — live run data is wired in from the runs API next. The
// requireSession guard stays in the layout, so this route is still auth-only.
export default function DashboardPage() {
  return (
    <DashboardView
      data={DEMO_DASHBOARD}
      basePath="/dashboard"
      notice={
        <Badge variant="neutral" className="font-normal">
          Sample data · live wiring coming
        </Badge>
      }
    />
  )
}
