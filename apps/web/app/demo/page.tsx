import { DashboardView } from "@/components/dashboard/dashboard-view"
import { DEMO_DASHBOARD } from "@/components/dashboard/demo-data"

// Public demo — the exact dashboard UI, backed entirely by mock fixtures. No
// session, no database, so it prerenders statically and serves 200 to anyone.
export default function DemoPage() {
  return <DashboardView data={DEMO_DASHBOARD} />
}
