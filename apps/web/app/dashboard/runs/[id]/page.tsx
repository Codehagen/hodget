import { notFound } from "next/navigation"

import { getRunDetail as getDemoRunDetail } from "@/components/dashboard/demo-data"
import { RunDetailView } from "@/components/dashboard/run-detail-view"
import { RealRunDetailView } from "@/components/dashboard/run-detail/real-run-detail"
import { getRunDetail } from "@/lib/dal"

/**
 * A run's detail page. Real runs (the user's own, keyed by UUID) resolve through
 * the DAL and render the DB-backed {@link RealRunDetailView}; everything else falls
 * back to the shared sample-fixture experience. The DAL is session-scoped, so a run
 * that isn't the user's is indistinguishable from a fixture id and drops to the
 * fallback. A DB outage must not break the fixture pages, so a load failure also
 * falls back.
 */
export default async function DashboardRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let real: Awaited<ReturnType<typeof getRunDetail>> = null
  try {
    real = await getRunDetail(id)
  } catch {
    real = null
  }
  if (real) {
    return <RealRunDetailView basePath="/dashboard" detail={real} />
  }

  const detail = getDemoRunDetail(id)
  if (!detail) notFound()
  return <RunDetailView basePath="/dashboard" detail={detail} />
}
