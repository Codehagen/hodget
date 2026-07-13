import { notFound } from "next/navigation"

import { ALL_RUNS, getRunDetail } from "@/components/dashboard/demo-data"
import { RunDetailView } from "@/components/dashboard/run-detail-view"

// Prerender every fixture run; `dynamicParams = false` makes any other id a
// static 404 so the public demo never falls back to on-demand rendering.
export const dynamicParams = false

export function generateStaticParams() {
  return ALL_RUNS.map((run) => ({ id: run.id }))
}

export default async function DemoRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = getRunDetail(id)
  if (!detail) notFound()

  return <RunDetailView basePath="/demo" detail={detail} />
}
