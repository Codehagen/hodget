import { notFound } from "next/navigation"

import { getRunDetail } from "@/components/dashboard/demo-data"
import { RunDetailView } from "@/components/dashboard/run-detail-view"

export default async function DashboardRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = getRunDetail(id)
  if (!detail) notFound()

  return <RunDetailView basePath="/dashboard" detail={detail} />
}
