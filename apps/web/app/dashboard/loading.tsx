import { Skeleton } from "@workspace/ui/components/skeleton"

/**
 * Route-level fallback for every /dashboard/* page while its server data
 * loads. Rough silhouette of the shared page shape — header row, stat band,
 * main panel — so the shell doesn't sit empty on slow DAL reads.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}
