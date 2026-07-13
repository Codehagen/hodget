import { notFound, unauthorized } from "@/lib/api"
import { getRunDetail } from "@/lib/dal"
import { getSession } from "@/lib/session"

/**
 * GET /api/runs/[id] — a run's status, result and decision log. 401 without a
 * session; 404 if the run does not belong to the current user (the DAL scopes
 * ownership, so other users' runs are indistinguishable from missing).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  const detail = await getRunDetail(id)
  if (!detail) return notFound()

  return Response.json(detail)
}
