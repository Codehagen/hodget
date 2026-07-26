import { notFound } from "next/navigation"

import { getDecisionMap } from "@/components/dashboard/decision-map/data"
import { DecisionMapView } from "@/components/dashboard/decision-map/decision-map-view"
import { getRunById } from "@/components/dashboard/demo-data"

export default async function DashboardDecisionMapPage({
  params,
}: {
  params: Promise<{ id: string; decisionId: string }>
}) {
  const { id, decisionId } = await params
  if (!getRunById(id)) notFound()
  const map = getDecisionMap(decisionId, id)
  if (!map) notFound()

  return <DecisionMapView basePath="/dashboard" map={map} />
}
