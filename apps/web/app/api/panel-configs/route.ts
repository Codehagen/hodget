import { badRequest, unauthorized, unprocessable } from "@/lib/api"
import { createPanelConfig, listPanelConfigs, panelConfigInputSchema } from "@/lib/dal"
import { getSession } from "@/lib/session"

/**
 * GET /api/panel-configs — the current user's saved analyst panels.
 * POST /api/panel-configs — create one (validated { name, panel }).
 * Both 401 without a session.
 */

export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()
  return Response.json(await listPanelConfigs())
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("expected a JSON body")
  }

  const parsed = panelConfigInputSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable("invalid panel config", parsed.error.issues)
  }

  const created = await createPanelConfig(parsed.data)
  return Response.json(created, { status: 201 })
}
