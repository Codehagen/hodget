import { badRequest, unauthorized, unprocessable } from "@/lib/api"
import { createRun, listRuns, runConfigSchema } from "@/lib/dal"
import { getSession } from "@/lib/session"

/**
 * POST /api/runs — validate the body, create a run, launch it in the background,
 * and return the queued run (201). GET /api/runs — the current user's runs.
 * Both 401 without a session. All data access goes through lib/dal.
 */

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("expected a JSON body")
  }

  const parsed = runConfigSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable("invalid run config", parsed.error.issues)
  }

  const run = await createRun(parsed.data)
  return Response.json(run, { status: 201 })
}

export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()
  return Response.json(await listRuns())
}
