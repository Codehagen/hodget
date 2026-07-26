import { notFound } from "next/navigation"

import { getDecisionMap, DECISION_MAP_IDS } from "@/components/dashboard/decision-map/data"
import { DecisionMapView } from "@/components/dashboard/decision-map/decision-map-view"
import { ALL_RUNS, getRunById } from "@/components/dashboard/demo-data"

// Prerender every (run, decision) pair the demo can reach; any other id becomes
// a static 404 so the public demo never renders on demand.
export const dynamicParams = false

export function generateStaticParams() {
  return ALL_RUNS.flatMap((run) =>
    DECISION_MAP_IDS.map((decisionId) => ({ id: run.id, decisionId }))
  )
}

export default async function DemoDecisionMapPage({
  params,
}: {
  params: Promise<{ id: string; decisionId: string }>
}) {
  const { id, decisionId } = await params
  if (!getRunById(id)) notFound()
  const map = getDecisionMap(decisionId, id)
  if (!map) notFound()

  return <DecisionMapView basePath="/demo" map={map} />
}
